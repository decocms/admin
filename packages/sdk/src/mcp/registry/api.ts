import { listToolsByConnectionType } from "@deco/ai/mcp";
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
  buildWorkspaceOrProjectIdConditions,
  getProjectIdFromContext,
} from "../projects/util.ts";
import { registryApps, registryScopes, registryTools } from "../schema.ts";
import { RegistryAppSchema, RegistryScopeSchema } from "./schemas.ts";

export { AppName };
export type { RegistryApp } from "./schemas.ts";

const DECO_CHAT_REGISTRY_SCOPES_TABLE = "deco_chat_registry_scopes" as const;
const DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE =
  "deco_chat_apps_registry_tools" as const;

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
            {
              name: {
                ilike: `%${query}%`,
              },
            },
            {
              description: {
                ilike: `%${query}%`,
              },
            },
          ],
        }
      : {};
  },
};

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
  workspace,
  projectId,
  db,
}: {
  scopeName: string;
  workspace: string;
  projectId: string | null;
  db: AppContext["db"];
}): Promise<string> {
  // First, try to find existing scope
  const { data: existingScope, error: findError } = await db
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
  const { data: existingScopes, error: countError } = await db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id", { count: "exact" })
    .or(buildWorkspaceOrProjectIdConditions(workspace, projectId));

  if (countError) throw countError;

  const scopeCount = existingScopes?.length ?? 0;
  if (scopeCount >= MAX_SCOPES_PER_WORKSPACE) {
    throw new UserInputError(
      `Cannot claim more than ${MAX_SCOPES_PER_WORKSPACE} scopes per workspace. Current count: ${scopeCount}`,
    );
  }

  // Create new scope (automatic claiming) if it doesn't exist
  const { data: newScope, error: createError } = await db
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
              {
                unlisted: false,
              },
              {
                AND: [
                  {
                    unlisted: true,
                  },
                  {
                    OR: [
                      projectId
                        ? {
                            project_id: projectId,
                          }
                        : {},
                      {
                        workspace,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          scopeName
            ? {
                scope: {
                  scope_name: scopeName,
                },
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

    const data = await c.drizzle.query.registryApps.findMany({
      where: {
        AND: [
          Filters.searchApp(search),
          {
            workspace: workspace,
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
      workspace,
      projectId,
      db: c.db,
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
    ).catch(() => ({ tools: [] }));

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
