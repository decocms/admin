import { z } from "zod";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import type { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { JwtIssuer } from "../../auth/jwt.ts";

const SELECT_API_KEY_QUERY = `
  id,
  name,
  workspace,
  enabled,
  policies,
  created_at,
  updated_at,
  deleted_at
` as const;

function mapApiKey(
  apiKey: QueryResult<"deco_chat_api_keys", typeof SELECT_API_KEY_QUERY>,
) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    workspace: apiKey.workspace,
    enabled: apiKey.enabled,
    policies: apiKey.policies,
    createdAt: apiKey.created_at,
    updatedAt: apiKey.updated_at,
    deletedAt: apiKey.deleted_at,
    // Never expose the actual key value for security
  };
}

const createTool = createToolGroup("APIKeys", {
  name: "API Key Management",
  description: "Create and manage API keys securely.",
  icon:
    "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
});

export const listApiKeys = createTool({
  name: "API_KEYS_LIST",
  description: "List all API keys",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      apiKeys: data.map(mapApiKey),
    };
  },
});

const StatementSchema = z.object({
  effect: z.enum(["allow", "deny"]),
  resource: z.string(),
});

const policiesSchema = z.array(StatementSchema).optional().describe(
  "Policies for the API key",
);

export const createApiKey = createTool({
  name: "API_KEYS_CREATE",
  description: "Create a new API key",
  inputSchema: z.object({
    name: z.string().describe("The name of the API key"),
    policies: policiesSchema,
  }),
  handler: async ({ name, policies }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const workspace = c.workspace.value;

    const db = c.db;

    // Insert the API key metadata
    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .insert({
        name,
        workspace,
        enabled: true,
        policies: policies || [],
      })
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const issuer = JwtIssuer.forSecret(c.envVars.ISSUER_JWT_SECRET);
    const value = await issuer.create({
      sub: `api-key:${apiKey.id}`,
      aud: workspace,
      iat: new Date().getTime(),
    });

    return { ...mapApiKey(apiKey), value };
  },
});

export const getApiKey = createTool({
  name: "API_KEYS_GET",
  description: "Get an API key by ID",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

export const updateApiKey = createTool({
  name: "API_KEYS_UPDATE",
  description: "Update an API key metadata",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key"),
    name: z.string().optional().describe("New name for the API key"),
    enabled: z.boolean().optional().describe("Whether the API key is enabled"),
    policies: policiesSchema,
  }),
  handler: async ({ id, name, enabled, policies }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    // deno-lint-ignore no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (policies !== undefined) updateData.policies = policies;
    updateData.updated_at = new Date().toISOString();

    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .update(updateData)
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const deleteApiKey = createTool({
  name: "API_KEYS_DELETE",
  description: "Delete an API key (soft delete)",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to delete"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    // Soft delete by setting deleted_at timestamp
    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      id: apiKey.id,
      deleted: true,
    };
  },
});

export const enableApiKey = createTool({
  name: "API_KEYS_ENABLE",
  description: "Enable an API key",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to enable"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const disableApiKey = createTool({
  name: "API_KEYS_DISABLE",
  description: "Disable an API key",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to disable"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const validateApiKey = createTool({
  name: "API_KEYS_VALIDATE",
  description: "Validate an API key by ID",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to validate"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db.from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .eq("enabled", true)
      .is("deleted_at", null)
      .single();

    if (error || !apiKey) {
      throw new NotFoundError("API key not found or invalid");
    }

    return {
      ...mapApiKey(apiKey),
      valid: true,
    };
  },
});
