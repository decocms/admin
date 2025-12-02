import { listToolsByConnectionType } from "@deco/ai/mcp";
import {
  CollectionGetInputSchema,
  CollectionListInputSchema,
  type OrderByExpression,
  type WhereExpression,
} from "@decocms/bindings/collections";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { AppName } from "../../common/index.ts";
import { UserInputError } from "../../errors.ts";
import { MCPConnectionSchema } from "../../models/mcp.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  getProjectIdFromContext,
  workspaceOrProjectIdConditions,
} from "../projects/util.ts";
import { registryApps, registryScopes, registryTools } from "../schema.ts";
import {
  RegistryAppSchema,
  RegistryScopeSchema,
  MCPRegistryListResponseSchema,
  MCPRegistryGetResponseSchema,
  type MCPRegistryServer,
  type MCPRegistryGetResponse,
} from "./schemas.ts";

export type { RegistryApp } from "./schemas.ts";

const DECO_CHAT_REGISTRY_SCOPES_TABLE = "deco_chat_registry_scopes" as const;
const DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE =
  "deco_chat_apps_registry_tools" as const;

// Deco Registry namespace in MCP Registry Spec
const DECO_REGISTRY_NAMESPACE = "cx.decocms.registry" as const;

// Apps to omit from marketplace/discover
const OMITTED_APPS = [
  "9cecc7d6-d114-44b4-96e3-d4d06faf2c2f",
  "4c5aeb03-6b3d-4b58-bb14-4a0d7ecd4d14",
  "f5fe9093-67a6-416c-8fac-b77d3edf52e0",
  "6bc2c3e3-8858-49cd-b603-ca183e4f4f19",
  "f2bd7ca4-61fb-4dff-9753-45e5b8a85693",
  "0696cdb3-e6da-46ea-93af-e6524cabaa75",
  "5bd518f9-21f6-477f-8fbc-927b1a03018b",
  "b0ae29d5-7220-423c-b57b-d0bbe3816120",
  "fc348403-4bb9-4b95-8cda-b73e8beac4fd",
  // TODO (Jonas Jesus): Remove once Agents Email is fixed
  "1e810c3c-9da2-4e5e-8312-8e54f125d6bf",
];

type DbTool = typeof registryTools.$inferSelect;

type DbApp = typeof registryApps.$inferSelect & { tools: DbTool[] } & {
  scope: Pick<typeof registryScopes.$inferSelect, "scope_name">;
};

const Mappers = {
  mapTool: (tool: DbTool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description ?? undefined,
    inputSchema: tool.input_schema ?? {},
    outputSchema: tool.output_schema ?? undefined,
    metadata: tool.metadata ?? undefined,
  }),

  mapApp: (app: DbApp) => ({
    id: app.id,
    workspace: app.workspace,
    scopeId: app.scope_id,
    scopeName: app.scope.scope_name,
    name: app.name,
    appName: AppName.build(app.scope.scope_name, app.name),
    description: app.description ?? undefined,
    icon: app.icon ?? undefined,
    connection: app.connection,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
    unlisted: app.unlisted,
    friendlyName: app.friendly_name ?? undefined,
    verified: app.verified ?? false,
    metadata: app.metadata ?? undefined,
    tools: app.tools.map(Mappers.mapTool),
  }),
};

const Filters = {
  searchApp: (query?: string) => {
    return query
      ? {
          OR: [
            { name: { ilike: `%${query}%` } },
            { description: { ilike: `%${query}%` } },
          ],
        }
      : {};
  },
};

/**
 * Map DbApp to RegistryAppCollectionEntity with title = friendlyName
 * 
 * Important: The timestamps (created_at, updated_at) from the database may be in various formats.
 * We convert them to valid ISO 8601 strings.
 * Database format: "2025-11-21 00:27:52.990737+00" needs conversion to ISO format
 */
const mapAppToCollectionEntity = (app: DbApp) => {
  // Ensure timestamps are valid ISO 8601 strings
  const ensureIsoString = (timestamp: unknown): string => {
    if (typeof timestamp === 'string') {
      // Try to parse and convert to ISO string
      try {
        const date = new Date(timestamp);
        // Check if it's a valid date
        if (isNaN(date.getTime())) {
          // If parsing failed, return current time
          return new Date().toISOString();
        }
        return date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    }
    return new Date().toISOString();
  };

  return {
    id: app.id,
    title: app.friendly_name ?? app.name ?? AppName.build(app.scope.scope_name, app.name),
    created_at: ensureIsoString(app.created_at),
    updated_at: ensureIsoString(app.updated_at),
    created_by: undefined,
    updated_by: undefined,
    workspace: app.workspace,
    scopeId: app.scope_id,
    scopeName: app.scope.scope_name,
    appName: AppName.build(app.scope.scope_name, app.name),
    name: app.name,
    description: app.description ?? undefined,
    icon: app.icon ?? undefined,
    connection: app.connection,
    unlisted: app.unlisted,
    friendlyName: app.friendly_name ?? undefined,
    verified: app.verified ?? false,
    metadata: app.metadata ?? undefined,
    tools: app.tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description ?? undefined,
      inputSchema: tool.input_schema ?? {},
      outputSchema: tool.output_schema ?? undefined,
      metadata: tool.metadata ?? undefined,
    })),
    projectId: app.project_id ?? undefined,
  };
};

/**
 * Evaluate a where expression against a registry app
 */
function evaluateWhereExpression(
  app: ReturnType<typeof mapAppToCollectionEntity>,
  where: WhereExpression,
): boolean {
  if ("conditions" in where) {
    // Logical operator
    const { operator, conditions } = where;
    switch (operator) {
      case "and":
        return conditions.every((c) => evaluateWhereExpression(app, c));
      case "or":
        return conditions.some((c) => evaluateWhereExpression(app, c));
      case "not":
        return !conditions.every((c) => evaluateWhereExpression(app, c));
      default:
        return true;
    }
  }

  // Comparison expression
  const { field, operator, value } = where;
  const fieldPath = field.join(".");
  const fieldValue = getFieldValue(app, fieldPath);

  switch (operator) {
    case "eq":
      return fieldValue === value;
    case "gt":
      return (fieldValue as number | string) > (value as number | string);
    case "gte":
      return (fieldValue as number | string) >= (value as number | string);
    case "lt":
      return (fieldValue as number | string) < (value as number | string);
    case "lte":
      return (fieldValue as number | string) <= (value as number | string);
    case "in":
      return Array.isArray(value) && value.includes(fieldValue);
    case "like":
      if (typeof fieldValue !== "string" || typeof value !== "string")
        return false;
      if (value.length > 100) return false;
      const pattern = value
        .split("")
        .map((char) => {
          if (char === "%") return ".*";
          if (char === "_") return ".";
          if (/[.*+?^${}()|[\]\\]/.test(char)) return "\\" + char;
          return char;
        })
        .join("");
      return new RegExp(`^${pattern}$`, "i").test(fieldValue);
    case "contains":
      if (typeof fieldValue !== "string" || typeof value !== "string")
        return false;
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    default:
      return true;
  }
}

/**
 * Get a field value from a registry app, handling nested paths
 */
function getFieldValue(app: ReturnType<typeof mapAppToCollectionEntity>, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let value: unknown = app;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Apply orderBy expressions to sort apps
 */
function applyOrderBy(
  apps: ReturnType<typeof mapAppToCollectionEntity>[],
  orderBy: OrderByExpression[],
): ReturnType<typeof mapAppToCollectionEntity>[] {
  return [...apps].sort((a, b) => {
    for (const order of orderBy) {
      const fieldPath = order.field.join(".");
      const aValue = getFieldValue(a, fieldPath);
      const bValue = getFieldValue(b, fieldPath);

      let comparison = 0;

      // Handle nulls
      if (aValue == null && bValue == null) continue;
      if (aValue == null) {
        comparison = order.nulls === "first" ? -1 : 1;
      } else if (bValue == null) {
        comparison = order.nulls === "first" ? 1 : -1;
      } else if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      if (comparison !== 0) {
        return order.direction === "desc" ? -comparison : comparison;
      }
    }
    return 0;
  });
}

const createTool = createToolGroup("Registry", {
  name: "App Registry",
  description: "Manage and discover published apps in the registry.",
  icon: "https://assets.decocache.com/mcp/09e44283-f47d-4046-955f-816d227c626f/app.png",
});

export const listRegistryScopes = createTool({
  name: "REGISTRY_LIST_SCOPES",
  description: "List all registry scopes",
  inputSchema: z.lazy(() =>
    z.object({
      search: z
        .string()
        .optional()
        .describe("Search term to filter scopes by name"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({ scopes: z.array(RegistryScopeSchema) }),
  ),
  handler: async ({ search }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const workspace = c.workspace.value;
    const projectId = await getProjectIdFromContext(c);

    const ownerFilter = projectId
      ? or(
          eq(registryScopes.project_id, projectId),
          eq(registryScopes.workspace, workspace),
        )
      : eq(registryScopes.workspace, workspace);

    const filter = and(
      ownerFilter,
      search ? ilike(registryScopes.scope_name, `%${search}%`) : undefined,
    );

    const scopes = await c.drizzle
      .select({
        id: registryScopes.id,
        scopeName: registryScopes.scope_name,
        workspace: registryScopes.workspace,
        projectId: registryScopes.project_id,
        createdAt: registryScopes.created_at,
        updatedAt: registryScopes.updated_at,
      })
      .from(registryScopes)
      .where(filter)
      .orderBy(desc(registryScopes.created_at));

    return { scopes };
  },
});

const MAX_SCOPES_PER_WORKSPACE = 5;
async function ensureScope({
  scopeName,
  ctx,
}: {
  scopeName: string;
  ctx: AppContext;
}): Promise<string> {
  assertHasWorkspace(ctx);
  const workspace = ctx.workspace.value;
  const projectId = await getProjectIdFromContext(ctx);
  const ownershipConditions = await workspaceOrProjectIdConditions(
    ctx,
    projectId,
  );

  // First, try to find existing scope
  const { data: existingScope, error: findError } = await ctx.db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id, workspace, project_id")
    .eq("scope_name", scopeName)
    .maybeSingle();

  if (findError) throw findError;

  if (existingScope) {
    // Check ownership - only the workspace that owns the scope can publish to it
    if (
      existingScope.project_id !== projectId &&
      existingScope.workspace !== workspace
    ) {
      throw new UserInputError(
        `Scope "${scopeName}" is owned by another project`,
      );
    }
    return existingScope.id;
  }

  // Check scope limit before creating new scope
  const { data: existingScopes, error: countError } = await ctx.db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id", { count: "exact" })
    .or(ownershipConditions);

  if (countError) throw countError;

  const scopeCount = existingScopes?.length ?? 0;
  if (scopeCount >= MAX_SCOPES_PER_WORKSPACE) {
    throw new UserInputError(
      `Cannot claim more than ${MAX_SCOPES_PER_WORKSPACE} scopes per workspace. Current count: ${scopeCount}`,
    );
  }

  // Create new scope (automatic claiming) if it doesn't exist
  const { data: newScope, error: createError } = await ctx.db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .insert({
      scope_name: scopeName,
      workspace,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError) throw createError;

  return newScope.id;
}

export const getRegistryApp = createTool({
  name: "REGISTRY_GET_APP",
  description: "Get an app from the registry",
  inputSchema: z.lazy(() =>
    z.object({
      name: z.string().describe("The name of the app to get").optional(),
      id: z.string().describe("The id of the app to get").optional(),
    }),
  ),
  outputSchema: z.lazy(() => RegistryAppSchema),
  handler: async (ctx, c) => {
    c.resourceAccess.grant(); // this method is public

    let app: DbApp | undefined = undefined;

    if ("id" in ctx && ctx.id) {
      app = await c.drizzle.query.registryApps.findFirst({
        where: {
          id: ctx.id,
        },
        with: {
          tools: true,
          scope: { columns: { scope_name: true } },
        },
      });
    } else if ("name" in ctx && ctx.name) {
      const { scopeName, name: appName } = AppName.parse(ctx.name);

      app = await c.drizzle.query.registryApps.findFirst({
        where: {
          name: appName,
          scope: {
            scope_name: scopeName,
          },
        },
        with: {
          tools: true,
          scope: {
            columns: { scope_name: true },
          },
        },
      });
    }

    if (!app) {
      throw new UserInputError("App not found");
    }

    return Mappers.mapApp(app);
  },
});

export const listRegistryApps = createTool({
  name: "REGISTRY_LIST_APPS",
  description: "List all apps in the registry for the current workspace",
  inputSchema: z.lazy(() =>
    z.object({
      search: z
        .string()
        .optional()
        .describe("Search term to filter apps by name or description"),
      scopeName: z.string().optional().describe("Filter apps by scope name"),
    }),
  ),
  outputSchema: z.lazy(() => z.object({ apps: z.array(RegistryAppSchema) })),
  handler: async ({ search, scopeName }, c) => {
    await assertWorkspaceResourceAccess(c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const projectId = await getProjectIdFromContext(c);

    const apps = await c.drizzle.query.registryApps.findMany({
      where: {
        AND: [
          Filters.searchApp(search),
          {
            OR: [
              { unlisted: false },
              {
                AND: [
                  { unlisted: true },
                  {
                    OR: projectId
                      ? [{ project_id: projectId }, { workspace }]
                      : [{ workspace }],
                  },
                ],
              },
            ],
          },
          scopeName
            ? {
                scope: { scope_name: scopeName },
              }
            : {},
        ],
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
      orderBy: (a, { desc }) => desc(a.created_at),
    });

    // Filter out omitted apps
    const filteredApps = apps.filter((app) => !OMITTED_APPS.includes(app.id));

    return {
      apps: filteredApps.map(Mappers.mapApp),
    };
  },
});

export const listPublishedApps = createTool({
  name: "REGISTRY_LIST_PUBLISHED_APPS",
  description: "List published apps by the current workspace",
  inputSchema: z.lazy(() =>
    z.object({
      search: z
        .string()
        .optional()
        .describe("Search term to filter apps by name or description"),
    }),
  ),
  outputSchema: z.lazy(() => z.object({ apps: z.array(RegistryAppSchema) })),
  handler: async ({ search }, c) => {
    c.resourceAccess.grant(); // Public tool, no policies needed

    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const projectId = await getProjectIdFromContext(c);

    const ownerFilter = projectId
      ? [{ project_id: projectId }, { workspace }]
      : [{ workspace }];

    const data = await c.drizzle.query.registryApps.findMany({
      where: {
        AND: [
          Filters.searchApp(search),
          {
            OR: ownerFilter,
          },
        ],
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Filter out omitted apps
    const filteredData = data.filter((app) => !OMITTED_APPS.includes(app.id));

    return { apps: filteredData.map(Mappers.mapApp) };
  },
});

export const publishApp = createTool({
  name: "REGISTRY_PUBLISH_APP",
  description:
    "Publish an app to the registry (automatically claims scope on first use)",
  inputSchema: z.lazy(() =>
    z.object({
      scopeName: z
        .string()
        .describe(
          "The scope to publish to (defaults to team slug, automatically claimed on first use)",
        ),
      name: z.string().describe("The name of the app"),
      friendlyName: z
        .string()
        .optional()
        .describe("A friendly name for the app"),
      description: z.string().optional().describe("A description of the app"),
      icon: z.string().optional().describe("URL to an icon for the app"),
      connection: MCPConnectionSchema.describe(
        "The MCP connection configuration for the app",
      ),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Metadata for the app"),
      unlisted: z
        .boolean()
        .optional()
        .describe("Whether the app should be unlisted"),
    }),
  ),
  outputSchema: z.lazy(() => RegistryAppSchema),
  handler: async (
    {
      scopeName: scope_name,
      name,
      description,
      icon,
      connection,
      unlisted,
      friendlyName,
      metadata,
    },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const projectId = await getProjectIdFromContext(c);

    if (!name.trim()) {
      throw new UserInputError("App name cannot be empty");
    }

    // Use team slug as default scope if none provided
    const scopeName = scope_name.trim();

    // Ensure scope exists (automatically claim if needed)
    const scopeId = await ensureScope({
      scopeName,
      ctx: c,
    });

    const now = new Date().toISOString();

    const values = {
      workspace,
      project_id: projectId,
      scope_id: scopeId,
      friendly_name: friendlyName?.trim() || null,
      name: name.trim(),
      metadata: metadata,
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      connection,
      updated_at: now,
      unlisted: unlisted ?? true,
    };

    const [{ id }] = await c.drizzle
      .insert(registryApps)
      .values(values)
      .onConflictDoUpdate({
        target: [registryApps.scope_id, registryApps.name],
        set: values,
      })
      .returning({
        id: registryApps.id,
      });

    const data = await c.drizzle.query.registryApps.findFirst({
      where: {
        id: id,
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
    });

    if (!data) {
      throw new Error("Failed to create app");
    }

    const { tools = [] } = await listToolsByConnectionType(
      connection,
      c,
      true,
    ).catch((e) => {
      console.error(e);
      return { tools: [] };
    });

    // Get current tools for this app to calculate diff
    const { data: currentTools, error: currentToolsError } = await c.db
      .from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE)
      .select("name")
      .eq("app_id", data.id);

    if (currentToolsError) throw currentToolsError;

    const currentToolNames = new Set(currentTools?.map((t) => t.name) || []);
    const newToolNames = new Set(tools.map((t) => t.name));

    // Find tools to delete (exist in DB but not in new tools)
    const toolsToDelete = Array.from(currentToolNames).filter(
      (name) => !newToolNames.has(name),
    );

    // Delete old tools that are no longer present
    if (toolsToDelete.length > 0) {
      const { error: deleteError } = await c.db
        .from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE)
        .delete()
        .eq("app_id", data.id)
        .in("name", toolsToDelete);

      if (deleteError) throw deleteError;
    }

    // Upsert new/updated tools
    await Promise.all(
      tools.map((tool) =>
        c.db.from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE).upsert(
          {
            // @ts-expect-error - this is a valid field
            app_id: data.id,
            name: tool.name,
            description: tool.description || null,
            input_schema: tool.inputSchema || null,
            output_schema: tool.outputSchema || null,
            metadata: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "app_id,name",
          },
        ),
      ),
    );

    return Mappers.mapApp(data);
  },
});

/**
 * PUBLIC COLLECTION TOOLS
 *
 * These tools expose public (unlisted: false) registry apps via the Collection pattern.
 * Used for external consumption via /registry/mcp public endpoint.
 */

/**
 * Get MIME type for icon URL based on file extension
 */
function getIconMimeType(url: string): string {
  if (url.endsWith(".svg")) return "image/svg+xml";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  if (url.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * Extract remote URL from connection object
 */
function getRemoteUrl(connection: ReturnType<typeof mapAppToCollectionEntity>["connection"]): string {
  if ("url" in connection && typeof connection.url === "string") {
    return connection.url;
  }
  return "http://localhost";
}

/**
 * Map connection type to MCP transport type
 */
function getTransportType(connectionType: string): "http" | "sse" | "websocket" {
  if (connectionType === "SSE") return "sse";
  if (connectionType === "Websocket") return "websocket";
  return "http";
}

/**
 * Build Deco registry metadata for _meta.cx.decocms.registry
 */
function buildDecoRegistryMeta(app: ReturnType<typeof mapAppToCollectionEntity>) {
  return {
    id: app.id,
    scopeId: app.scopeId,
    scopeName: app.scopeName,
    workspace: app.workspace,
    projectId: app.projectId,
    verified: app.verified,
    publishedAt: app.created_at,
    updatedAt: app.updated_at,
    tools: app.tools,
  };
}

/**
 * Map app to MCP Registry Spec Server format
 */
function mapAppToMCPRegistryServer(
  app: ReturnType<typeof mapAppToCollectionEntity>,
): MCPRegistryServer {
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json",
    name: app.appName,
    title: app.title,
    description: app.description,
    version: "1.0.0",
    icons: app.icon
      ? [{ src: app.icon, mimeType: getIconMimeType(app.icon) }]
      : undefined,
    remotes: [
      {
        type: getTransportType(app.connection.type),
        url: getRemoteUrl(app.connection),
      },
    ],
    _meta: {
      [DECO_REGISTRY_NAMESPACE]: buildDecoRegistryMeta(app),
    },
  };
}

/**
 * COLLECTION_REGISTRY_LIST
 *
 * List all public apps in the MCP registry with filtering, sorting, and pagination.
 * Only returns apps where unlisted: false (public apps).
 * Filters out apps in OMITTED_APPS list.
 * Returns apps in MCP Registry Spec format.
 */
export const COLLECTION_REGISTRY_LIST = createTool({
  name: "COLLECTION_REGISTRY_LIST",
  description: "List all public apps in the MCP registry",
  inputSchema: CollectionListInputSchema,
  outputSchema: MCPRegistryListResponseSchema,
  handler: async (input, c) => {
    // Public tool - grant access
    c.resourceAccess.grant();

    // Query all PUBLIC apps (unlisted: false)
    const apps = await c.drizzle.query.registryApps.findMany({
      where: {
        unlisted: false, // Only public apps
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
      orderBy: (a, { desc }) => desc(a.created_at),
    });

    // Filter out omitted apps
    let filteredApps = apps.filter((app) => !OMITTED_APPS.includes(app.id));

    // Map to collection entities
    let collectionApps = filteredApps.map(mapAppToCollectionEntity);

    // Apply where filter if specified
    if (input.where) {
      collectionApps = collectionApps.filter((app) =>
        evaluateWhereExpression(app, input.where!),
      );
    }

    // Apply orderBy if specified
    if (input.orderBy && input.orderBy.length > 0) {
      collectionApps = applyOrderBy(collectionApps, input.orderBy);
    }

    // Calculate pagination
    const totalCount = collectionApps.length;
    const offset = input.offset ?? 0;
    // If no limit specified, return all data; otherwise cap at 1000
    const limit = input.limit === undefined ? totalCount : Math.min(input.limit, 1000);
    const paginatedApps = collectionApps.slice(offset, offset + limit);

    // Map to MCP Registry Spec format
    const servers = paginatedApps.map((app) => ({
      _meta: { [DECO_REGISTRY_NAMESPACE]: buildDecoRegistryMeta(app) },
      server: mapAppToMCPRegistryServer(app),
    }));

    return {
      metadata: {
        count: paginatedApps.length,
        nextCursor:
          offset + limit < totalCount ? (offset + limit).toString() : undefined,
      },
      servers,
    };
  },
});

/**
 * COLLECTION_REGISTRY_GET
 *
 * Get a single public app from the registry by ID in MCP Registry Spec GET format.
 * Only returns apps where unlisted: false (public apps).
 * Returns item: null if app is not found or if it's private (unlisted: true).
 */
export const COLLECTION_REGISTRY_GET = createTool({
  name: "COLLECTION_REGISTRY_GET",
  description: "Get a public app from the MCP registry by ID",
  inputSchema: CollectionGetInputSchema,
  outputSchema: z.object({
    item: MCPRegistryGetResponseSchema.nullable(),
  }),
  handler: async (input, c) => {
    // Public tool - grant access
    c.resourceAccess.grant();

    // Query by id with public filter (unlisted: false)
    const app = await c.drizzle.query.registryApps.findFirst({
      where: {
        id: input.id,
        unlisted: false, // Only return public apps
      },
      with: {
        tools: true,
        scope: { columns: { scope_name: true } },
      },
    });

    if (!app) {
      return { item: null };
    }

    // Double-check it's public (extra security measure)
    if (app.unlisted) {
      return { item: null };
    }

    // Map to collection entity
    const collectionApp = mapAppToCollectionEntity(app);

    // Map to MCP Registry Spec GET format
    const response: MCPRegistryGetResponse = {
      _meta: {
        [DECO_REGISTRY_NAMESPACE]: {
          isLatest: true,
          publishedAt: collectionApp.created_at,
          updatedAt: collectionApp.updated_at,
          status: "active",
        },
      },
      server: {
        ...mapAppToMCPRegistryServer(collectionApp),
        _meta: { [DECO_REGISTRY_NAMESPACE]: buildDecoRegistryMeta(collectionApp) },
      },
    };

    return { item: response };
  },
});

// Deco MCP Registry metadata
const DECO_REGISTRY_INFO = {
  name: "Deco MCP Registry",
  version: "1.0.0",
  icon: "https://assets.decocache.com/decocms/c6af6b61-bb6d-4601-8003-708d62d5fb7a/logo-tiny.svg",
  publisher: {
    name: "decocms",
    url: "https://deco.cx",
  },
} as const;

/**
 * COLLECTION_REGISTRY_INFO
 *
 * Returns information about the Deco MCP Registry publisher.
 * Public tool - no authentication required.
 */
export const COLLECTION_REGISTRY_INFO = createTool({
  name: "COLLECTION_REGISTRY_INFO",
  description: "Get information about the Deco MCP Registry publisher",
  inputSchema: z.object({}),
  outputSchema: z.object({
    name: z.string().describe("Registry name"),
    version: z.string().describe("Registry version"),
    icon: z.string().describe("Registry icon URL"),
    publisher: z.object({
      name: z.string().describe("Publisher name"),
      url: z.string().describe("Publisher URL"),
    }),
  }),
  handler: async (_input, c) => {
    // Public tool - grant access
    c.resourceAccess.grant();

    return DECO_REGISTRY_INFO;
  },
});

/**
 * REGISTRY_PUBLIC_TOOLS
 *
 * Array of public registry tools exposed via the /registry/mcp endpoint.
 * These tools can be accessed without authentication.
 */
export const REGISTRY_PUBLIC_TOOLS = [
  COLLECTION_REGISTRY_LIST,
  COLLECTION_REGISTRY_GET,
  COLLECTION_REGISTRY_INFO,
] as const;
