import {
  createServerClient as createMcpServerClient,
  isApiDecoChatMCPConnection as shouldPatchDecoChatMCPConnection,
  listToolsByConnectionType,
  patchApiDecoChatTokenHTTPConnection,
} from "@deco/ai/mcp";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { and, eq, getTableColumns, or } from "drizzle-orm";
import { z } from "zod";
import { AppName } from "../../common/index.ts";
import {
  KNOWLEDGE_BASE_GROUP,
  WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
} from "../../constants.ts";
import type { MCPTool } from "../../hooks/tools.ts";
import {
  type Agent,
  AgentSchema,
  BindingsSchema,
  DECO_CMS_API_URL,
  INNATE_INTEGRATIONS,
  type Integration,
  IntegrationSchema,
  Locator,
  type MCPConnection,
  NEW_INTEGRATION_TEMPLATE,
  ProjectLocator,
  UserInputError,
  WellKnownMcpGroups,
} from "../../index.ts";
import { CallToolResultSchema } from "../../models/tool-call.ts";
import type { Workspace } from "../../path.ts";
import { Json } from "../../storage/index.ts";
import type { QueryResult } from "../../storage/supabase/client.ts";
import { KnowledgeBaseID } from "../../utils/index.ts";
import { IMPORTANT_ROLES } from "../agents/api.ts";
import {
  ApiKeySchema,
  mapApiKey,
  SELECT_API_KEY_QUERY,
} from "../api-keys/api.ts";
import {
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { getAppNameFromGroup, getGroups } from "../groups.ts";
import {
  AppContext,
  Binding,
  createToolGroup,
  MCPClient,
  NotFoundError,
  WellKnownBindings,
} from "../index.ts";
import { DECO_CMS_API } from "../context.ts";
import { filterByWorkspaceOrLocator } from "../ownership.ts";
import {
  getProjectIdFromContext,
  workspaceOrProjectIdConditions,
} from "../projects/util.ts";
import {
  getRegistryApp,
  listRegistryApps,
  type RegistryApp,
} from "../registry/api.ts";
import {
  agents,
  integrations,
  organizations,
  projects,
  registryApps,
  registryScopes,
  registryTools,
} from "../schema.ts";
import { createServerClient } from "../utils.ts";

const SELECT_INTEGRATION_QUERY = `
          *,
          deco_chat_apps_registry(
            name,
            deco_chat_registry_scopes(scope_name),
            deco_chat_apps_registry_tools(
              name,
              description,
              input_schema,
              output_schema
            )
          )
        ` as const;

// Tool factories for each group
const mapIntegration = (
  integration: QueryResult<
    "deco_chat_integrations",
    typeof SELECT_INTEGRATION_QUERY
  >,
) => {
  let appName: undefined | string;
  const registryName = integration.deco_chat_apps_registry?.name;
  const appScope =
    integration.deco_chat_apps_registry?.deco_chat_registry_scopes?.scope_name;
  if (registryName && appScope) {
    appName = AppName.build(appScope, registryName);
  }
  return {
    ...integration,
    appName,
    id: formatId("i", integration.id),
  };
};
export const parseId = (id: string) => {
  const [type, uuid] = id.includes(":") ? id.split(":") : ["i", id];
  return {
    type: (type || "i") as "i" | "a",
    uuid: uuid || id,
  };
};

const formatId = (type: "i" | "a", uuid: string) => `${type}:${uuid}`;

const agentAsIntegrationFor =
  (workspace: string, token?: string) =>
  (agent: Agent): Integration => ({
    id: formatId("a", agent.id),
    icon: agent.avatar,
    name: agent.name,
    description: agent.description,
    connection: {
      type: "HTTP",
      url: new URL(`${workspace}/agents/${agent.id}/mcp`, DECO_CMS_API_URL)
        .href,
      token,
    },
  });

const createIntegrationManagementTool = createToolGroup("Integration", {
  name: "Integration Management",
  description:
    "Install, authorize, and manage third-party integrations and their tools.",
  icon: "https://assets.decocache.com/mcp/2ead84c2-2890-4d37-b61c-045f4760f2f7/Integration-Management.png",
});

const integrationCallToolInputSchema = IntegrationSchema.pick({
  id: true,
  connection: true,
})
  .partial()
  .merge(CallToolRequestSchema.pick({ params: true }));

export const callTool = createIntegrationManagementTool({
  name: "INTEGRATIONS_CALL_TOOL",
  description: "Call a given tool",
  inputSchema: z.lazy(() => integrationCallToolInputSchema),
  handler: async (input, c) => {
    c.resourceAccess.grant();
    const toolCall = input.params;

    let connection: MCPConnection | undefined = undefined;
    if ("id" in input) {
      assertHasLocator(c);
      connection = patchApiDecoChatTokenHTTPConnection(
        {
          type: "HTTP",
          url: new URL(`${c.locator.value}/${input.id}/mcp`, DECO_CMS_API_URL)
            .href,
        },
        c.cookie,
      );
    } else if (input.connection) {
      const reqConnection = input.connection;
      connection = shouldPatchDecoChatMCPConnection(reqConnection)
        ? patchApiDecoChatTokenHTTPConnection(reqConnection, c.cookie)
        : reqConnection;
    }

    if (!connection || !toolCall) {
      return { error: "Missing url parameter" };
    }

    const client = await createMcpServerClient({
      name: "deco-chat-client",
      connection,
    });

    if (!client) {
      return { error: "Failed to create client" };
    }

    try {
      const result = await client.callTool(
        {
          name: toolCall.name,
          arguments: toolCall.arguments || {},
        },
        // @ts-expect-error - Zod version conflict between packages
        CallToolResultSchema,
        {
          timeout: 3000000,
        },
      );

      return result;
    } catch (error) {
      console.error(
        "Failed to call tool:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      // Always dispose of the client to avoid RPC leaks
      await client.close();
    }
  },
});

async function listToolsAndSortByName(
  {
    connection,
    ignoreCache,
    appName,
  }: {
    connection: MCPConnection;
    appName?: string | null;
    ignoreCache?: boolean;
  },
  c: AppContext,
) {
  let result;
  if (appName) {
    const app = await getRegistryApp.handler({
      name: appName,
    });
    result = {
      tools: app?.tools?.map((tool) =>
        registryToolToMcpTool({
          description: tool.description ?? null,
          input_schema: tool.inputSchema,
          output_schema: tool.outputSchema,
          name: tool.name,
        }),
      ),
    };
  } else {
    // Patch connection with cookie for API-based integrations
    let patchedConnection = connection;
    if (shouldPatchDecoChatMCPConnection(connection)) {
      patchedConnection = patchApiDecoChatTokenHTTPConnection(
        connection,
        c.cookie,
      );
    }
    result = await listToolsByConnectionType(patchedConnection, c, ignoreCache);
  }

  // Sort tools by name for consistent UI
  if (Array.isArray(result?.tools)) {
    result.tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

export const listTools = createIntegrationManagementTool({
  name: "INTEGRATIONS_LIST_TOOLS",
  description: "List tools of a given integration",
  inputSchema: z.lazy(() =>
    IntegrationSchema.pick({
      connection: true,
    }).extend({
      ignoreCache: z
        .boolean()
        .optional()
        .describe("Whether to ignore the cache when listing tools"),
    }),
  ),
  handler: (props, c) => {
    c.resourceAccess.grant();

    return listToolsAndSortByName(props, c);
  },
});

// Helper to get API URL from context (for Cloudflare Worker env)
const getApiUrl = (c: AppContext): string => {
  return DECO_CMS_API(c, false);
};

const toKbIntegration = (
  kb: string,
  locator: ProjectLocator,
  token?: string,
  apiUrl?: string,
) => {
  const { url: workspaceMcpUrl } = projectUrlFromLocator(locator, apiUrl);
  const url = new URL(workspaceMcpUrl);
  url.searchParams.set("group", KNOWLEDGE_BASE_GROUP);
  url.searchParams.set("name", kb);
  return {
    id: kb,
    name: `${KnowledgeBaseID.parse(kb)} (Knowledge Base)`,
    description: "Ingest, search, and manage contextual data.",
    connection: {
      type: "HTTP",
      url: url.href,
      token,
    },
    icon: "https://assets.decocache.com/mcp/1b6e79a9-7830-459c-a1a6-ba83e7e58cbe/Knowledge-Base.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };
};

const projectUrlFromLocator = (locator: ProjectLocator, apiUrl?: string) => {
  const projectPath = `/${
    locator.startsWith("/") ? locator.slice(1) : locator
  }`;
  const baseUrl = apiUrl || DECO_CMS_API_URL;
  return { url: new URL(`${projectPath}/mcp`, baseUrl), projectPath };
};

const virtualIntegrationsFor = (
  locator: ProjectLocator,
  knowledgeBases: string[],
  token?: string,
  apiUrl?: string,
) => {
  // Create a virtual User Management integration
  const baseUrl = apiUrl || DECO_CMS_API_URL;
  const decoChatMcp = new URL("/mcp", baseUrl);
  const userManagementIntegration = {
    id: formatId("i", WellKnownMcpGroups.User),
    name: "User Management",
    description: "Manage your teams, invites and profile",
    connection: {
      type: "HTTP",
      url: decoChatMcp.href,
      token,
    },
    icon: "https://i.imgur.com/GD4o7vx.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };
  const { url: workspaceMcp } = projectUrlFromLocator(locator, apiUrl);

  const contractsMcp = new URL("/contracts/mcp", baseUrl);
  const contractsIntegration = {
    id: formatId("i", WellKnownMcpGroups.Contracts),
    name: "Contracts Management",
    description: "Manage your contracts",
    connection: {
      type: "HTTP",
      url: contractsMcp.href,
      token,
    },
    icon: "https://assets.decocache.com/mcp/10b5e8b4-a4e2-4868-8a7d-8cf9b46f0d79/contract.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

  // Create a virtual Workspace Management integration
  const workspaceManagementIntegration = {
    id: formatId("i", "workspace-management"),
    name: "Workspace Management",
    description: "Manage your agents, integrations and threads",
    connection: {
      type: "HTTP",
      url: workspaceMcp.href,
      token,
    },
    icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

  // Create a virtual Self integration for custom tools and workflows
  const { projectPath } = projectUrlFromLocator(locator, apiUrl);
  const parsedLocator = Locator.parse(locator);
  const selfIntegration = {
    id: formatId("i", WellKnownMcpGroups.Self),
    name: `${parsedLocator.project} MCP`,
    description: `Tools and workflows of the project ${parsedLocator.project} from ${parsedLocator.org}`,
    connection: {
      type: "HTTP",
      url: new URL(`${projectPath}/self/mcp`, baseUrl).href,
      // Don't include token - use cookie-based auth for API connections
    },
    icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

  const integrationGroups = Object.entries(getGroups()).map(
    ([group, { name, description, icon, workspace }]) => {
      const url =
        workspace === false
          ? new URL(decoChatMcp.href)
          : new URL(workspaceMcp.href);
      url.searchParams.set("group", group);
      const app = getAppNameFromGroup(group);
      return {
        id: formatId("i", group),
        name,
        icon,
        description,
        appName: app ? AppName.build(DECO_PROVIDER, app) : undefined,
        connection: {
          type: "HTTP",
          url: url.href,
          token,
        },
        workspace: Locator.adaptToRootSlug(locator),
        created_at: new Date().toISOString(),
      };
    },
  );

  return [
    userManagementIntegration,
    workspaceManagementIntegration,
    selfIntegration,
    ...integrationGroups,
    contractsIntegration,
    ...knowledgeBases.map((kb) => {
      return toKbIntegration(
        KnowledgeBaseID.format(kb),
        locator,
        token,
        apiUrl,
      );
    }),
  ];
};

const registryToolToMcpTool = (tool: {
  name: string;
  description: string | null;
  input_schema: Json | Record<string, unknown>;
  output_schema: Json | Record<string, unknown> | undefined;
}): MCPTool => ({
  name: tool.name,
  description: tool.description || undefined,
  inputSchema: (tool.input_schema as Record<string, unknown>) || {},
  outputSchema: (tool.output_schema as Record<string, unknown>) || undefined,
});

// Helper function to extract tools from registry data - shared between list and get
const extractToolsFromRegistry = (
  integration: QueryResult<
    "deco_chat_integrations",
    typeof SELECT_INTEGRATION_QUERY
  >,
): MCPTool[] | null => {
  const registryData = integration.deco_chat_apps_registry;
  const registryTools =
    registryData && Array.isArray(registryData.deco_chat_apps_registry_tools)
      ? registryData.deco_chat_apps_registry_tools
      : null;

  return registryTools?.map(registryToolToMcpTool) || null;
};

export const listIntegrations = createIntegrationManagementTool({
  name: "INTEGRATIONS_LIST",
  description: "List all integrations with their tools",
  inputSchema: z.lazy(() =>
    z.object({
      binder: BindingsSchema.optional(),
      hideVirtual: z.boolean().optional(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(IntegrationSchema),
    }),
  ),
  handler: async ({ binder, hideVirtual }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);
    const projectId = await getProjectIdFromContext(c);
    const ownershipConditions = await workspaceOrProjectIdConditions(
      c,
      projectId,
    );

    const [integrationsData, agentsData] = await Promise.all([
      // Query integrations with all necessary joins
      c.db
        .from("deco_chat_integrations")
        .select(SELECT_INTEGRATION_QUERY)
        .or(ownershipConditions),
      // Query agents
      c.db
        .from("deco_chat_agents")
        .select("*")
        .or(ownershipConditions),
    ]);
    const roles =
      c.workspace.root === "users" || typeof c.user?.id !== "string"
        ? []
        : await c.policy.getUserRoles(c.user.id as string, c.workspace.slug);
    const userRoles: string[] = roles?.map((role) => role?.name);

    const integrations = integrationsData.data ?? [];
    const agents = agentsData.data ?? [];

    if (integrationsData.error) {
      console.error(integrationsData.error);
    }

    if (agentsData.error) {
      console.error(agentsData.error);
    }

    // TODO: This is a temporary solution to filter integrations and agents by access.
    const filteredIntegrations = integrations.filter(
      (integration) =>
        !integration.access ||
        userRoles?.includes(integration.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    const filteredAgents = agents.filter(
      (agent) =>
        !agent.access ||
        userRoles?.includes(agent.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    // Build the result with all integrations
    const apiUrl = getApiUrl(c);
    const baseResult = [
      ...(hideVirtual
        ? []
        : virtualIntegrationsFor(c.locator.value, [], c.token, apiUrl)),
      ...filteredIntegrations.map(mapIntegration),
      ...filteredAgents
        .map((item) => AgentSchema.safeParse(item)?.data)
        .filter((a) => !!a)
        .map(agentAsIntegrationFor(workspace, c.token)),
      ...Object.values(INNATE_INTEGRATIONS),
    ]
      .map((i) => IntegrationSchema.safeParse(i)?.data)
      .filter((i) => !!i);

    // Add tools to each integration
    const result = await Promise.all(
      baseResult.map(async (integration) => {
        // Find the corresponding database record to extract tools
        const dbRecord = filteredIntegrations.find(
          (dbIntegration) => formatId("i", dbIntegration.id) === integration.id,
        );

        const { connection, appName } = integration;

        const isVirtual =
          connection.type === "HTTP" &&
          connection.url.startsWith(DECO_CMS_API_URL);

        const tools = isVirtual
          ? await listToolsAndSortByName(
              { connection, appName, ignoreCache: false },
              c,
            )
              .then((r) => r?.tools ?? null)
              .catch(() => {
                console.error(
                  "Error listing tools for virtual integration",
                  connection,
                );
                return null;
              })
          : dbRecord
            ? extractToolsFromRegistry(dbRecord)
            : null;

        return {
          ...integration,
          tools: tools as z.infer<typeof IntegrationSchema>["tools"],
        };
      }),
    );

    if (binder) {
      // Filter by binder capability
      const filteredResult = result.filter((integration) => {
        return Binding(WellKnownBindings[binder]).isImplementedBy(
          integration.tools ?? [],
        );
      });
      return { items: filteredResult };
    }

    return { items: result };
  },
});

export const convertFromDatabase = (
  integration: QueryResult<"deco_chat_integrations", "*">,
) => {
  return IntegrationSchema.parse({
    ...integration,
    id: formatId("i", integration.id),
  });
};

export const getIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id with tools",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async ({ id }, c) => {
    // preserve the logic of the old canAccess
    const isInnate =
      INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS];

    const canAccess =
      isInnate ||
      (await assertWorkspaceResourceAccess(c)
        .then(() => true)
        .catch(() => false));

    if (canAccess) {
      c.resourceAccess.grant();
    }

    const { uuid, type } = parseId(id);
    assertHasLocator(c);

    if (
      formatId(type, uuid).startsWith(
        WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
      )
    ) {
      const parsed = IntegrationSchema.parse({
        ...toKbIntegration(uuid, c.locator.value, c.token, getApiUrl(c)),
        // Use raw uuid for KB integration id to avoid double prefixing ("i:i:")
        id: formatId(type, uuid),
      });
      return {
        ...parsed,
        tools: null,
      };
    }
    assertHasWorkspace(c);

    if (uuid in INNATE_INTEGRATIONS) {
      const data =
        INNATE_INTEGRATIONS[uuid as keyof typeof INNATE_INTEGRATIONS];
      const baseIntegration = IntegrationSchema.parse({
        ...data,
        id: formatId(type, data.id),
      });
      return { ...baseIntegration, tools: null }; // Innate integrations don't have tools for now
    }

    const selectPromise =
      type === "i"
        ? c.drizzle
            .select({
              id: integrations.id,
              name: integrations.name,
              description: integrations.description,
              icon: integrations.icon,
              connection: integrations.connection,
              created_at: integrations.created_at,
              workspace: integrations.workspace,
              access: integrations.access,
              access_id: integrations.access_id,
              project_id: projects.id,
              org_id: organizations.id,
              // Registry app fields
              registry_app_name: registryApps.name,
              registry_scope_name: registryScopes.scope_name,
              // Tool fields
              tool_id: registryTools.id,
              tool_name: registryTools.name,
              tool_description: registryTools.description,
              tool_input_schema: registryTools.input_schema,
              tool_output_schema: registryTools.output_schema,
            })
            .from(integrations)
            .leftJoin(projects, eq(integrations.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .leftJoin(registryApps, eq(integrations.app_id, registryApps.id))
            .leftJoin(
              registryScopes,
              eq(registryApps.scope_id, registryScopes.id),
            )
            .leftJoin(registryTools, eq(registryApps.id, registryTools.app_id))
            .where(
              and(
                eq(integrations.id, uuid),
                filterByWorkspaceOrLocator({
                  table: integrations,
                  ctx: c,
                }),
              ),
            )
            .then((rows) => {
              if (!rows.length) return null;

              // Group tools by integration
              const baseRow = rows[0];
              const tools = rows
                .filter((row) => row.tool_id) // Only include rows with tools
                .map((row) => ({
                  name: row.tool_name!,
                  description: row.tool_description,
                  input_schema: row.tool_input_schema,
                  output_schema: row.tool_output_schema,
                }));

              return {
                ...baseRow,
                deco_chat_apps_registry: baseRow.registry_app_name
                  ? {
                      name: baseRow.registry_app_name,
                      deco_chat_registry_scopes: baseRow.registry_scope_name
                        ? {
                            scope_name: baseRow.registry_scope_name,
                          }
                        : null,
                      deco_chat_apps_registry_tools:
                        tools.length > 0 ? tools : null,
                    }
                  : null,
              };
            })
        : c.drizzle
            .select({
              ...getTableColumns(agents),
              org_id: organizations.id,
            })
            .from(agents)
            .leftJoin(projects, eq(agents.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .where(
              and(
                filterByWorkspaceOrLocator({
                  table: agents,
                  ctx: c,
                }),
                eq(agents.id, uuid),
              ),
            )
            .limit(1)
            .then((r) => r[0]);

    const virtualIntegrations = virtualIntegrationsFor(
      c.locator.value,
      [],
      c.token,
      getApiUrl(c),
    );

    // Handle self integration - don't return tools
    if (id === formatId("i", WellKnownMcpGroups.Self)) {
      const selfIntegration = virtualIntegrations.find(
        (i) => i.id === formatId("i", WellKnownMcpGroups.Self),
      );
      if (selfIntegration) {
        return {
          ...IntegrationSchema.parse(selfIntegration),
          tools: null, // Don't return tools for self integration
        };
      }
    }

    if (virtualIntegrations.some((i) => i.id === id)) {
      const baseIntegration = IntegrationSchema.parse({
        ...virtualIntegrations.find((i) => i.id === id),
        id: formatId(type, id),
      });
      return {
        ...baseIntegration,
        tools: await listToolsAndSortByName(
          { connection: baseIntegration.connection, ignoreCache: false },
          c,
        ).then((r) => r?.tools as z.infer<typeof IntegrationSchema>["tools"]),
      };
    }

    const data = await selectPromise;

    if (!data) {
      throw new NotFoundError("Integration not found");
    }

    if (type === "a") {
      const mapAgentToIntegration = agentAsIntegrationFor(
        c.workspace.value as Workspace,
        c.token,
      );
      const baseIntegration = IntegrationSchema.parse({
        ...mapAgentToIntegration(data as unknown as Agent),
        id: formatId(type, data.id),
      });
      return { ...baseIntegration, tools: null }; // Agents don't have tools for now
    }

    // Cast the data to match the expected format for compatibility
    const integrationData = {
      ...data,
      deco_chat_apps_registry:
        "deco_chat_apps_registry" in data ? data.deco_chat_apps_registry : null,
    } as unknown as QueryResult<
      "deco_chat_integrations",
      typeof SELECT_INTEGRATION_QUERY
    >;

    const tools = extractToolsFromRegistry(integrationData);
    const baseIntegration = IntegrationSchema.parse({
      ...mapIntegration(integrationData),
      id: formatId(type, data.id),
    });

    return { ...baseIntegration, tools };
  },
});

export type IntegrationWithTools = Awaited<
  ReturnType<(typeof getIntegration)["handler"]>
>;

export const createIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  inputSchema: z.lazy(() =>
    IntegrationSchema.partial()
      // TODO(@camudo): Remember why we omit this here and unify install process
      .omit({ appName: true })
      .extend({
        clientIdFromApp: z.string().optional(),
      }),
  ),
  handler: async (_integration, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    const projectId = await getProjectIdFromContext(c);

    const { appId, clientIdFromApp, ...integration } = _integration;
    const baseIntegration = {
      ...NEW_INTEGRATION_TEMPLATE,
      ...integration,
      workspace: projectId ? null : c.workspace?.value,
      project_id: projectId,
      id: integration.id ? parseId(integration.id).uuid : undefined,
    };

    const fetchedApp = clientIdFromApp
      ? await getRegistryApp.handler({ name: clientIdFromApp })
      : undefined;

    const payload = {
      ...baseIntegration,
      app_id: appId ?? fetchedApp?.id,
    };

    const existingIntegration = payload.id
      ? await c.drizzle
          .select({
            id: integrations.id,
          })
          .from(integrations)
          .leftJoin(projects, eq(integrations.project_id, projects.id))
          .leftJoin(organizations, eq(projects.org_id, organizations.id))
          .where(
            and(
              filterByWorkspaceOrLocator({
                table: integrations,
                ctx: c,
              }),
              eq(integrations.id, payload.id),
            ),
          )
          .limit(1)
          .then((r) => r[0])
      : null;

    if (existingIntegration) {
      const [data] = await c.drizzle
        .update(integrations)
        .set(payload)
        .where(
          and(
            eq(integrations.id, existingIntegration.id),
            or(
              eq(integrations.workspace, c.workspace.value),
              projectId ? eq(integrations.project_id, projectId) : undefined,
            ),
          ),
        )
        .returning();

      return IntegrationSchema.parse({
        ...data,
        id: formatId("i", data.id),
      });
    }

    const [data] = await c.drizzle
      .insert(integrations)
      .values(payload)
      .returning();

    return IntegrationSchema.parse({
      ...data,
      id: formatId("i", data.id),
    });
  },
});

export const updateIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      integration: IntegrationSchema,
    }),
  ),
  handler: async ({ id, integration }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    assertHasLocator(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot update an agent integration");
    }

    const { name, description, icon, connection, access, appId } = integration;

    const projectId = await getProjectIdFromContext(c);

    const [data] = await c.drizzle
      .update(integrations)
      .set({
        name,
        description,
        icon,
        connection,
        access,
        app_id: appId,
        id: uuid,
      })
      .where(
        and(
          eq(integrations.id, uuid),
          or(
            eq(integrations.workspace, c.workspace.value),
            projectId ? eq(integrations.project_id, projectId) : undefined,
          ),
        ),
      )
      .returning();

    if (!data) {
      throw new NotFoundError("Integration not found");
    }

    return IntegrationSchema.parse({
      ...data,
      appName: integration.appName,
      tools: integration.tools,
      id: formatId(type, data.id),
    });
  },
});

export const deleteIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot delete an agent integration");
    }

    const projectId = await getProjectIdFromContext(c);

    await c.drizzle
      .delete(integrations)
      .where(
        and(
          eq(integrations.id, uuid),
          or(
            eq(integrations.workspace, c.workspace.value),
            projectId ? eq(integrations.project_id, projectId) : undefined,
          ),
        ),
      );

    return { success: true };
  },
});

const DECO_REGISTRY_SERVER_URL = "https://mcp.deco.site";

const getDecoRegistryServerClient = () => {
  const url = new URL("/mcp/messages", DECO_REGISTRY_SERVER_URL);

  return createServerClient({
    name: url.hostname,
    connection: { type: "HTTP", url: url.href },
  });
};

const DECO_PROVIDER = "deco";
const virtualInstallableIntegrations = () => {
  return [
    {
      id: "AGENTS_EMAIL",
      name: "Agents Email",
      group: WellKnownMcpGroups.Email,
      description: "Manage your agents email",
      icon: "https://assets.decocache.com/mcp/65334e3f-17b4-470f-b644-5d226c565db9/email-integration.png",
      provider: DECO_PROVIDER,
      connection: {
        type: "HTTP",
        url: "https://mcp.deco.site/mcp/messages",
      } as MCPConnection,
    },
  ];
};

const appIsContract = (app: RegistryApp) => {
  return app.metadata?.contract !== undefined;
};

const MARKETPLACE_PROVIDER = "marketplace";

export const DECO_INTEGRATIONS_SEARCH = createIntegrationManagementTool({
  name: "DECO_INTEGRATIONS_SEARCH",
  description: `
Search for integrations in both marketplace and installed.
If no query is provided, it will return all installed integrations. For better results, try searching for the service name, i.e. GoogleSheets, GoogleCalendar, Notion, etc.
It's always handy to search for installed integrations with no query, since all integrations will be returned. Also, some integrations are handy agents that may help you with common tasks.
`,
  inputSchema: z.lazy(() =>
    z.object({
      query: z.string().describe("The query to search for").optional(),
      showContracts: z
        .boolean()
        .describe("Whether to show contracts")
        .optional()
        .default(false),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      integrations: z
        .array(
          IntegrationSchema.and(
            z.object({
              provider: z.string(),
              friendlyName: z.string().optional(),
            }),
          ),
        )
        .describe("The Integrations that match the query"),
    }),
  ),
  handler: async ({ query, showContracts }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const registry = await listRegistryApps.handler({
      search: query,
    });

    const registryList = registry.apps
      .map((app) => {
        if (!showContracts && appIsContract(app)) {
          return null;
        }
        return {
          id: app.id,
          appName: AppName.build(app.scopeName, app.name),
          name: AppName.build(app.scopeName, app.name),
          friendlyName: app.friendlyName,
          description: app.description,
          icon: app.icon,
          provider: MARKETPLACE_PROVIDER,
          metadata: app.metadata,
          verified: app.verified,
          connection:
            app.connection || ({ type: "HTTP", url: "" } as MCPConnection),
        };
      })
      .filter((app) => app !== null);

    const virtualIntegrations = virtualInstallableIntegrations();
    return {
      integrations: [
        ...virtualIntegrations.filter(
          (integration) => !query || integration.name.includes(query),
        ),
        ...registryList,
      ],
    };
  },
});

const NO_TOOL_FOUND_ERR =
  "MCP error -32602: MCP error -32602: Tool DECO_CHAT_OAUTH_START not found";
export const DECO_INTEGRATION_OAUTH_START = createIntegrationManagementTool({
  name: "DECO_INTEGRATION_OAUTH_START",
  description: "Start the OAuth flow for an integration",
  inputSchema: z.lazy(() =>
    z.object({
      appName: z
        .string()
        .describe("The id of the integration to start the OAuth flow for"),
      returnUrl: z
        .string()
        .describe(
          "The return URL for the OAuth flow. Will come with a query param including the mcp URL.",
        ),
      installId: z
        .string()
        .describe(
          "The install id of the integration to start the OAuth flow for",
        ),
      provider: z
        .string()
        .optional()
        .describe(
          "The provider of the integration to start the OAuth flow for",
        ),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.union([
      z.object({
        redirectUrl: z.string(),
      }),
      z.object({
        stateSchema: z.unknown(),
        scopes: z.array(z.string()).optional(),
      }),
    ]),
  ),
  handler: async ({ appName, returnUrl, installId, provider }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    let connection: MCPConnection;
    if (provider === MARKETPLACE_PROVIDER) {
      const app = await getRegistryApp.handler({ name: appName });
      connection = app.connection;
    } else {
      connection = {
        type: "HTTP",
        url: new URL(`/apps/${appName}/mcp/messages`, DECO_REGISTRY_SERVER_URL)
          .href,
        token: installId,
      };
    }

    const oauth = (await MCPClient.INTEGRATIONS_CALL_TOOL({
      connection,
      params: {
        name: "DECO_CHAT_OAUTH_START",
        arguments: {
          installId,
          returnUrl,
        },
      },
    })) as
      | {
          structuredContent:
            | { redirectUrl: string }
            | {
                stateSchema: unknown;
                scopes?: string[];
              };
        }
      | {
          error: string;
        };
    if (oauth && "error" in oauth) {
      if (oauth.error === NO_TOOL_FOUND_ERR) {
        return {
          stateSchema: DEFAULT_APP_SCHEMA.schema,
          scopes: DEFAULT_APP_SCHEMA.scopes,
        };
      }
      throw new Error(oauth.error);
    }

    return oauth.structuredContent;
  },
});

const DEFAULT_APP_SCHEMA = {
  schema: {
    type: "object",
    properties: {},
  },
  scopes: [],
};

export const DECO_GET_APP_SCHEMA = createIntegrationManagementTool({
  name: "DECO_GET_APP_SCHEMA",
  description: "Get the schema for a marketplace app",
  inputSchema: z.lazy(() =>
    z.object({
      appName: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      schema: z.unknown(),
      scopes: z.array(z.string()).optional(),
    }),
  ),
  handler: async ({ appName }, c) => {
    // Anyone can get the schema for an app
    c.resourceAccess.grant();
    assertHasWorkspace(c);

    const app = await getRegistryApp.handler({ name: appName });
    const connection = app.connection;

    const result = (await MCPClient.INTEGRATIONS_CALL_TOOL({
      connection,
      params: {
        name: "DECO_CHAT_OAUTH_START",
        arguments: {
          returnUrl: "",
        },
      },
    })) as
      | {
          structuredContent:
            | { redirectUrl: string }
            | {
                stateSchema: unknown;
                scopes?: string[];
              };
        }
      | { error: string };

    if ("error" in result) {
      if (result.error === NO_TOOL_FOUND_ERR) {
        return DEFAULT_APP_SCHEMA;
      }
      throw new Error(result.error);
    }

    const isObject = typeof result?.structuredContent === "object";

    if ((isObject && "redirectUrl" in result.structuredContent) || !isObject) {
      throw new Error("Redirect URL returned, but we expected a state schema");
    }

    return {
      schema: (result.structuredContent as { stateSchema: unknown })
        .stateSchema,
      scopes: (result.structuredContent as { scopes: string[] }).scopes,
    };
  },
});

const CONFIGURE_INTEGRATION_OUTPUT_SCHEMA = z.object({
  success: z.boolean().describe("Whether the configuration was successful"),
  message: z
    .string()
    .describe("A message describing the result of the configuration attempt")
    .optional(),
  data: IntegrationSchema.omit({ id: true }).optional(),
  // configure integration can return the install id
  installId: z.string().optional(),
});

export const DECO_INTEGRATION_INSTALL = createIntegrationManagementTool({
  name: "DECO_INTEGRATION_INSTALL",
  description:
    "Install an integration. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool. Also, after installing, enable the integration using the INTEGRATION_ENABLE tool.",
  inputSchema: z.lazy(() =>
    z.object({
      id: z
        .string()
        .describe(
          "The id of the integration to install. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool",
        ),
      provider: z
        .string()
        .optional()
        .describe(
          "The provider of the integration to install. To know the available providers, use the DECO_INTEGRATIONS_SEARCH tool",
        ),
      appId: z
        .string()
        .optional()
        .describe(
          "The id of the app to install the integration for. To know the available app ids, use the DECO_INTEGRATIONS_SEARCH tool",
        ),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      installationId: z
        .string()
        .describe(
          "The id of the installation. Use this id to enable the integration using the DECO_INTEGRATIONS_SEARCH tool",
        ),
    }),
  ),
  handler: async (args, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    let integration: Integration;
    const virtual = virtualInstallableIntegrations().find(
      (i) => i.id === args.id || i.id === args.appId,
    );
    if (virtual) {
      const workspaceMcp = new URL(
        `${c.workspace.value}/${virtual.group}/mcp`,
        getApiUrl(c),
      );
      workspaceMcp.searchParams.set("group", virtual.group);

      integration = {
        id: crypto.randomUUID(),
        name: virtual.name,
        description: virtual.description,
        icon: virtual.icon,
        connection: {
          type: "HTTP",
          url: workspaceMcp.href,
        },
      };
    } else if (args.provider === MARKETPLACE_PROVIDER) {
      const app = await getRegistryApp.handler({ name: args.id });
      integration = {
        id: crypto.randomUUID(),
        name: app.friendlyName ?? AppName.build(app.scopeName, app.name),
        appId: args.appId,
        description: app.description,
        icon: app.icon,
        connection: app.connection,
      };
    } else {
      const client = await getDecoRegistryServerClient();

      try {
        const result = await client.callTool(
          {
            name: "CONFIGURE",
            arguments: { id: args.id },
          },
          // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
          CallToolResultSchema,
        );

        const parsed = CONFIGURE_INTEGRATION_OUTPUT_SCHEMA.parse(
          result.structuredContent,
        );

        const id =
          parsed.installId ??
          (parsed.data?.connection as { token?: string })?.token ??
          crypto.randomUUID();

        client.close();
        integration = {
          id,
          ...(parsed.data as Omit<Integration, "id">),
        };
      } finally {
        client.close();
      }
    }
    const created = await createIntegration.handler(integration);

    if (!created?.id) {
      throw new Error("Failed to create integration");
    }

    return { installationId: created.id };
  },
});

export const getIntegrationApiKey = createIntegrationManagementTool({
  name: "INTEGRATIONS_GET_API_KEY",
  description: "Get the API key for an integration",
  inputSchema: z.object({
    integrationId: z.string(),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ integrationId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const integration = await getIntegration.handler({ id: integrationId });

    const appName = integration.appName?.startsWith("@")
      ? integration.appName.slice(1).split("/")[1]
      : integration.appName;

    if (!appName) {
      throw new Error("No app name found for this integration");
    }

    const name = `${appName}-${integrationId}`;

    const apiKey = await c.db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("name", name)
      .or(await workspaceOrProjectIdConditions(c))
      .single();

    if (apiKey.error) {
      throw new Error("No API key found for this integration");
    }

    return mapApiKey(apiKey.data);
  },
});
