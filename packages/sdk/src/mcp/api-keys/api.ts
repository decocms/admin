import { and, eq, isNull, or, getTableColumns, desc } from "drizzle-orm";
import { z } from "zod/v3";
import { userFromJWT } from "../../auth/user.ts";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { LocatorStructured } from "../../locator.ts";
import {
  policiesSchema,
  Statement,
  StatementSchema,
} from "../../models/index.ts";
import type { QueryResult } from "../../storage/index.ts";
import {
  apiKeySWRCache,
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";
import { getIntegration } from "../integrations/api.ts";
import { getProjectIdFromContext } from "../projects/util.ts";
import { getRegistryApp } from "../registry/api.ts";
import { apiKeys, organizations, projects } from "../schema.ts";
import {
  filterByWorkspaceOrLocator,
  filterByWorkspaceOrProjectId,
} from "../ownership.ts";

export const SELECT_API_KEY_QUERY = `
  id,
  name,
  workspace,
  project_id,
  enabled,
  policies,
  created_at,
  updated_at,
  deleted_at
` as const;

export function mapApiKey(
  apiKey: QueryResult<"deco_chat_api_keys", typeof SELECT_API_KEY_QUERY>,
) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    workspace: apiKey.workspace,
    projectId: apiKey.project_id,
    enabled: apiKey.enabled,
    policies: apiKey.policies as Statement[],
    createdAt: apiKey.created_at,
    updatedAt: apiKey.updated_at,
    deletedAt: apiKey.deleted_at,
    // Never expose the actual key value for security
  };
}

const createTool = createToolGroup("APIKeys", {
  name: "API Key Vault",
  description:
    "Secure vault for storing and managing third-party service API keys (Stripe, OpenAI, etc.) with policy-based access control.",
  icon: "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
});

/**
 * Returns a Drizzle OR condition that filters API keys by workspace or project locator.
 * This version works with queries that don't include the agents table.
 */
export const matchByWorkspaceOrProjectLocatorForApiKeys = (
  workspace: string,
  locator?: LocatorStructured,
) => {
  return or(
    eq(apiKeys.workspace, workspace),
    locator
      ? and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        )
      : undefined,
  );
};

const AppClaimsSchema = z.object({
  appName: z.string(),
  integrationId: z.string(),
  state: z.any(),
});

// Shared API key output schema
export const ApiKeySchema = z.object({
  id: z.string().describe("Unique identifier for the stored API key"),
  name: z
    .string()
    .describe(
      "Human-readable name describing which service this key is for (e.g., 'Stripe Production')",
    ),
  workspace: z
    .string()
    .nullable()
    .describe("Workspace ID if key is workspace-scoped"),
  enabled: z.boolean().describe("Whether this key can currently be used"),
  policies: z
    .array(StatementSchema)
    .describe(
      "Access control policies defining which users/roles can access this key",
    ),
  createdAt: z.string().describe("When the key was stored"),
  updatedAt: z.string().describe("When the key was last modified"),
  deletedAt: z
    .string()
    .nullable()
    .describe("When the key was deleted (null if active)"),
});

const ApiKeyWithValueSchema = ApiKeySchema.extend({
  value: z
    .string()
    .describe(
      "The encrypted API key value - only exposed once at creation/reissue for security",
    ),
});

export const listApiKeys = createTool({
  name: "API_KEYS_LIST",
  description:
    "List all stored API keys in the vault (does not expose actual key values)",
  inputSchema: z.object({}),
  outputSchema: z.object({
    apiKeys: z
      .array(ApiKeySchema)
      .describe("All stored API keys with metadata"),
  }),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const data = await c.drizzle
      .select(getTableColumns(apiKeys))
      .from(apiKeys)
      .leftJoin(projects, eq(apiKeys.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        and(
          filterByWorkspaceOrLocator({
            table: apiKeys,
            ctx: c,
          }),
          isNull(apiKeys.deleted_at),
        ),
      )
      .orderBy(desc(apiKeys.created_at));

    return {
      apiKeys: data.map(mapApiKey),
    };
  },
});

const ensureStateIsWellFormed = async (state: unknown) => {
  const promises: Promise<unknown>[] = [];

  for (const prop of Object.values(state ?? {})) {
    if (
      prop &&
      typeof prop === "object" &&
      "value" in prop &&
      typeof prop.value === "string"
    ) {
      promises.push(
        Promise.resolve(
          getIntegration.handler({
            id: prop.value,
          }),
        ).then((integration) => {
          // oxlint-disable-next-line no-explicit-any
          (prop as any)["__type"] = integration.appName; // ensure it's a binding object
        }),
      );
    }
  }

  await Promise.all(promises);

  return state;
};

export const createApiKey = createTool({
  name: "API_KEYS_CREATE",
  description:
    "Store a new third-party service API key in the vault with access control policies",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Descriptive name for the key (e.g., 'Stripe Production', 'OpenAI GPT-4')",
      ),
    policies: policiesSchema,
    claims: AppClaimsSchema.optional().describe(
      "Optional app-specific metadata and configuration state",
    ),
  }),
  outputSchema: ApiKeyWithValueSchema,
  handler: async ({ name, policies, claims }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    // this code ensures that we always validate stat against the app owner before issuing an JWT.
    if (claims?.appName) {
      // ensure app schema is well formed

      const [app, state] = await Promise.all([
        getRegistryApp.handler({
          name: claims.appName,
        }),
        ensureStateIsWellFormed(claims.state),
      ]);

      // get connection from registry

      const validated = (await MCPClient.INTEGRATIONS_CALL_TOOL({
        connection: app.connection,
        params: {
          name: "DECO_CHAT_STATE_VALIDATION",
          arguments: {
            state,
          },
        },
      })) as {
        structuredContent: { valid: boolean; reason?: string };
      };
      // call state validation tool.

      if (validated?.structuredContent?.valid === false) {
        // errors or not valid payloads are considered valid?
        throw new UserInputError(
          `Could not validate state ${validated.structuredContent.reason}`,
        );
      }
    }

    const projectId = await getProjectIdFromContext(c);

    // Insert the API key metadata
    const [apiKey] = await c.drizzle
      .insert(apiKeys)
      .values({
        name,
        workspace: projectId ? null : c.workspace?.value,
        project_id: projectId,
        enabled: true,
        policies: policies || [],
      })
      .returning();

    if (!apiKey) {
      throw new InternalServerError("Failed to create API key");
    }

    const issuer = await c.jwtIssuer();
    const value = await issuer.issue({
      ...claims,
      sub: `api-key:${apiKey.id}`,
      aud: c.locator.value,
      iat: new Date().getTime(),
    });

    return { ...mapApiKey(apiKey), value };
  },
});

export const reissueApiKey = createTool({
  name: "API_KEYS_REISSUE",
  description:
    "Generate a new encrypted token for an existing stored API key (e.g., after key rotation or policy updates)",
  inputSchema: z.object({
    id: z.string().describe("ID of the stored API key to reissue"),
    claims: z.any().optional().describe("Updated app-specific metadata"),
    policies: policiesSchema
      .optional()
      .describe("Updated access control policies"),
  }),
  outputSchema: ApiKeyWithValueSchema,
  handler: async ({ id, claims, policies }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const filters = [
      await filterByWorkspaceOrProjectId({
        table: apiKeys,
        ctx: c,
      }),
      eq(apiKeys.id, id),
      isNull(apiKeys.deleted_at),
    ];

    // First, verify the API key exists and is accessible
    const [apiKey] = await c.drizzle
      .select({
        ...getTableColumns(apiKeys),
        project_id: apiKeys.project_id,
        workspace: apiKeys.workspace,
      })
      .from(apiKeys)
      .where(and(...filters))
      .limit(1);

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    if (policies) {
      await c.drizzle
        .update(apiKeys)
        .set({
          policies,
          updated_at: new Date().toISOString(),
        })
        .where(and(...filters));
    }

    // Generate new JWT token with the provided claims
    const issuer = await c.jwtIssuer();
    const value = await issuer.issue({
      ...claims,
      sub: `api-key:${apiKey.id}`,
      aud: c.locator.value,
      iat: new Date().getTime(),
    });

    const cacheId = `${c.workspace.value}:${id}`;
    await apiKeySWRCache.delete(cacheId);

    // Return the API key with updated policies if they were provided
    const updatedApiKey = policies ? { ...apiKey, policies } : apiKey;
    return { ...mapApiKey(updatedApiKey), value };
  },
});

export const getApiKey = createTool({
  name: "API_KEYS_GET",
  description:
    "Retrieve metadata for a stored API key (does not expose the actual key value)",
  inputSchema: z.object({
    id: z.string().describe("ID of the stored API key"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const [apiKey] = await c.drizzle
      .select(getTableColumns(apiKeys))
      .from(apiKeys)
      .leftJoin(projects, eq(apiKeys.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        and(
          filterByWorkspaceOrLocator({
            table: apiKeys,
            ctx: c,
          }),
          eq(apiKeys.id, id),
          isNull(apiKeys.deleted_at),
        ),
      )
      .limit(1);

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

export const updateApiKey = createTool({
  name: "API_KEYS_UPDATE",
  description:
    "Update the name, enabled status, or access policies for a stored API key",
  inputSchema: z.object({
    id: z.string().describe("ID of the stored API key"),
    name: z.string().optional().describe("New descriptive name"),
    enabled: z.boolean().optional().describe("Whether the key can be used"),
    policies: policiesSchema,
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id, name, enabled, policies }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // oxlint-disable-next-line no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (policies !== undefined) updateData.policies = policies;
    updateData.updated_at = new Date().toISOString();

    const filter = await filterByWorkspaceOrProjectId({
      table: apiKeys,
      ctx: c,
    });

    const [apiKey] = await c.drizzle
      .update(apiKeys)
      .set(updateData)
      .where(and(eq(apiKeys.id, id), filter, isNull(apiKeys.deleted_at)))
      .returning();

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

export const deleteApiKey = createTool({
  name: "API_KEYS_DELETE",
  description:
    "Remove a stored API key from the vault (soft delete - can be recovered)",
  inputSchema: z.object({
    id: z.string().describe("ID of the API key to delete"),
  }),
  outputSchema: z.object({
    id: z.string().describe("ID of the deleted key"),
    deleted: z.boolean().describe("True if deletion succeeded"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const filter = await filterByWorkspaceOrProjectId({
      table: apiKeys,
      ctx: c,
    });

    // Soft delete by setting deleted_at timestamp
    const [apiKey] = await c.drizzle
      .update(apiKeys)
      .set({ deleted_at: new Date().toISOString() })
      .where(and(eq(apiKeys.id, id), filter, isNull(apiKeys.deleted_at)))
      .returning();

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return {
      id: apiKey.id,
      deleted: true,
    };
  },
});

export const enableApiKey = createTool({
  name: "API_KEYS_ENABLE",
  description: "Enable a stored API key to allow it to be used",
  inputSchema: z.object({
    id: z.string().describe("ID of the API key to enable"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const filter = await filterByWorkspaceOrProjectId({
      table: apiKeys,
      ctx: c,
    });

    const [apiKey] = await c.drizzle
      .update(apiKeys)
      .set({ enabled: true, updated_at: new Date().toISOString() })
      .where(and(eq(apiKeys.id, id), filter, isNull(apiKeys.deleted_at)))
      .returning();

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

export const disableApiKey = createTool({
  name: "API_KEYS_DISABLE",
  description: "Disable a stored API key to prevent it from being used",
  inputSchema: z.object({
    id: z.string().describe("ID of the API key to disable"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const filter = await filterByWorkspaceOrProjectId({
      table: apiKeys,
      ctx: c,
    });

    const [apiKey] = await c.drizzle
      .update(apiKeys)
      .set({ enabled: false, updated_at: new Date().toISOString() })
      .where(and(eq(apiKeys.id, id), filter, isNull(apiKeys.deleted_at)))
      .returning();

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

const CheckAccessInputSchema = z.object({
  key: z
    .string()
    .optional()
    .describe(
      "Optional API key to check - uses current context key if not provided",
    ),
  tools: z
    .array(z.string())
    .describe("List of tool names to check access permissions for"),
});

const CheckAccessOutputSchema = z.object({
  access: z
    .record(z.string(), z.boolean())
    .describe("Map of tool names to boolean access status"),
});

export const checkAccess = createTool({
  name: "API_KEYS_CHECK_ACCESS",
  description:
    "Check which tools an API key has permission to access based on its policies",
  inputSchema: CheckAccessInputSchema,
  outputSchema: CheckAccessOutputSchema,
  handler: async ({ key, tools }, c) => {
    assertHasWorkspace(c);
    c.resourceAccess.grant(); // this is public because it uses the current key from context

    // TODO(@mcandeia): remove this ignore
    // eslint-disable-next-line eslint/no-unused-vars
    let user = c.user;
    if (key) {
      const fromJWT = await userFromJWT(
        key,
        c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
          c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
          ? {
              public: c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
              private: c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
            }
          : undefined,
      );
      user = fromJWT ?? user;
    }
    const hasAccess = await Promise.all(
      tools.map(async (tool) => {
        return [
          tool,
          await assertWorkspaceResourceAccess(c, tool)
            .then(() => true)
            .catch(() => false),
        ];
      }),
    );
    return {
      access: Object.fromEntries(hasAccess),
    };
  },
});

export const validateApiKey = createTool({
  name: "API_KEYS_VALIDATE",
  description: "Check if a stored API key is valid and enabled",
  inputSchema: z.object({
    id: z.string().describe("ID of the API key to validate"),
  }),
  outputSchema: ApiKeySchema.extend({
    valid: z
      .boolean()
      .describe("True if the key exists, is enabled, and not deleted"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const [apiKey] = await c.drizzle
      .select(getTableColumns(apiKeys))
      .from(apiKeys)
      .leftJoin(projects, eq(apiKeys.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        and(
          filterByWorkspaceOrLocator({
            table: apiKeys,
            ctx: c,
          }),
          eq(apiKeys.id, id),
          eq(apiKeys.enabled, true),
          isNull(apiKeys.deleted_at),
        ),
      )
      .limit(1);

    if (!apiKey) {
      throw new NotFoundError("API key not found or invalid");
    }

    return {
      ...mapApiKey(apiKey),
      valid: true,
    };
  },
});
