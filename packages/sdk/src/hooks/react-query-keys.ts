import type { ListModelsInput } from "../crud/model.ts";
import type { ThreadFilterOptions } from "../crud/thread.ts";
import type { ProjectLocator } from "../index.ts";
import type { Binder, MCPConnection } from "../models/mcp.ts";

export const KEYS = {
  // ============================================================================
  // PROJECT-SCOPED KEYS
  // These queries require a ProjectLocator (org/project context)
  // ============================================================================
  FILE: (locator: ProjectLocator, path: string) => ["file", locator, path],
  AGENT: (locator: ProjectLocator, agentId?: string) => [
    "agent",
    locator,
    agentId,
  ],
  INTEGRATION: (locator: ProjectLocator, integrationId?: string) => [
    "integration",
    locator,
    integrationId,
  ],
  INTEGRATION_TOOLS: (
    locator: ProjectLocator,
    integrationId: string,
    binder?: Binder,
  ) => [
    "integration-tools",
    locator,
    integrationId,
    ...(binder ? [binder] : []),
  ],
  INTEGRATION_API_KEY: (locator: ProjectLocator, integrationId: string) => [
    "integration-api-key",
    locator,
    integrationId,
  ],
  CHANNELS: (locator: ProjectLocator, channelId?: string) => [
    "channels",
    locator,
    channelId,
  ],
  BINDINGS: (locator: ProjectLocator, binder: Binder) => [
    "bindings",
    locator,
    binder,
  ],
  THREADS: (locator: ProjectLocator, options?: ThreadFilterOptions) => {
    if (!options) {
      return ["threads", locator];
    }
    return [
      "threads",
      locator,
      options.agentId,
      options.resourceId,
      options.orderBy,
      options.cursor,
      options.limit,
    ];
  },
  THREAD: (locator: ProjectLocator, threadId: string) => [
    "thread",
    locator,
    threadId,
  ],
  THREAD_MESSAGES: (locator: ProjectLocator, threadId: string) => [
    "thread-messages",
    locator,
    threadId,
  ],
  THREAD_TOOLS: (locator: ProjectLocator, threadId: string) => [
    "thread-tools",
    locator,
    threadId,
  ],
  TOOLS: (locator: ProjectLocator, agentId: string, threadId: string) => [
    "tools",
    locator,
    agentId,
    threadId,
  ],
  AUDITS: (locator: ProjectLocator, options: ThreadFilterOptions) => [
    "audit",
    locator,
    options.agentId,
    options.orderBy,
    options.cursor,
    options.limit,
    options.resourceId,
  ],
  TEAM_VIEWS: (locator: ProjectLocator, integrationId: string) => [
    "team-views",
    locator,
    integrationId,
  ],
  WORKSPACE_VIEWS: (locator: ProjectLocator) => ["workspace-views", locator],
  MODELS: (locator: ProjectLocator, options?: ListModelsInput) => [
    "models",
    locator,
    options?.excludeDisabled || false,
    options?.excludeAuto || false,
  ],
  MODEL: (locator: ProjectLocator, id: string) => ["model", locator, id],
  TRIGGERS: (locator: ProjectLocator, agentId = "") => [
    "triggers",
    locator,
    agentId,
  ],
  TRIGGER: (locator: ProjectLocator, triggerId: string) => [
    "trigger",
    locator,
    triggerId,
  ],
  PROMPTS: (
    locator: ProjectLocator,
    ids?: string[],
    resolveMentions?: boolean,
    excludeIds?: string[],
  ) => [
    "prompts",
    locator,
    ...(ids ? ids.sort() : []),
    `${resolveMentions ?? false}`,
    ...(excludeIds ? excludeIds.sort() : []),
  ],
  PROMPT: (locator: ProjectLocator, id: string) => ["prompts", locator, id],
  PROMPTS_SEARCH: (
    locator: ProjectLocator,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) => ["prompts", locator, query, limit, offset],
  PROMPT_VERSIONS: (locator: ProjectLocator, id: string) => [
    "prompt-versions",
    locator,
    id,
  ],
  WALLET: (locator: ProjectLocator) => ["wallet", locator],
  WALLET_USAGE_AGENTS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-agents", locator, range],
  WALLET_USAGE_THREADS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-threads", locator, range],
  WALLET_BILLING_HISTORY: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => ["wallet-billing-history", locator, range],
  WALLET_CONTRACTS_PRE_AUTHORIZATIONS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => ["wallet-contracts-pre-authorizations", locator, range],
  WALLET_CONTRACTS_COMMITS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => ["wallet-contracts-commits", locator, range],
  WORKSPACE_PLAN: (locator: ProjectLocator) => ["workspace-plan", locator],
  WORKSPACE_PERMISSION_DESCRIPTIONS: (locator: ProjectLocator) => [
    ...KEYS.INTEGRATION_TOOLS(locator, "workspace-management"),
    "permission-descriptions",
    "workspace",
  ],
  WORKFLOWS: (locator: ProjectLocator, page?: number, per_page?: number) => [
    "workflows",
    locator,
    page,
    per_page,
  ],
  WORKFLOW: (locator: ProjectLocator, workflowName: string) => [
    "workflow",
    locator,
    workflowName,
  ],
  WORKFLOW_INSTANCES: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    per_page?: number,
  ) => ["workflow-instances", locator, workflowName, page, per_page],
  WORKFLOW_STATUS: (
    locator: ProjectLocator,
    workflowName: string,
    instanceId: string,
  ) => ["workflow-status", locator, workflowName, instanceId],
  WORKFLOW_NAMES: (locator: ProjectLocator) => ["workflow-names", locator],
  WORKFLOW_RUNS: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    perPage?: number,
  ) => ["workflow-runs", locator, workflowName, page, perPage],
  KNOWLEDGE_FILES: (locator: ProjectLocator, connectionUrl: string) => [
    "knowledge_files",
    locator,
    connectionUrl,
  ],
  DOCUMENTS_FOR_MENTIONS: (locator: ProjectLocator) => [
    "documents-for-mentions",
    locator,
  ],
  TOOL: (locator: ProjectLocator, uri: string) => ["tool", locator, uri],
  DOCUMENT: (locator: ProjectLocator, uri: string) => [
    "document",
    locator,
    uri,
  ],
  WORKFLOW_BY_URI: (locator: ProjectLocator, uri: string) => [
    "workflow-by-uri-v2",
    locator,
    uri,
  ],
  VIEW: (locator: ProjectLocator, uri: string) => ["view", locator, uri],
  TOOLS_LIST: (locator: ProjectLocator, integrationId: string) => [
    "resources-v2-list",
    locator,
    integrationId,
    "tool",
  ],
  DOCUMENTS_LIST: (locator: ProjectLocator, integrationId: string) => [
    "resources-v2-list",
    locator,
    integrationId,
    "document",
  ],
  WORKFLOWS_LIST: (locator: ProjectLocator, integrationId: string) => [
    "resources-v2-list",
    locator,
    integrationId,
    "workflow",
  ],
  VIEWS_LIST: (locator: ProjectLocator, integrationId: string) => [
    "resources-v2-list",
    locator,
    integrationId,
    "view",
  ],
  DOCUMENTS_SEARCH: (
    locator: ProjectLocator,
    term?: string,
    page?: number,
    pageSize?: number,
  ) => ["documents", locator, term, page, pageSize],
  WORKFLOW_RUNS_ALL: (locator: ProjectLocator) => ["workflow-runs", locator],
  RECENT_WORKFLOW_RUNS: (
    locator: ProjectLocator,
    page?: number,
    perPage?: number,
  ) => ["recent-workflow-runs", locator, page, perPage],
  RECENT_WORKFLOW_RUNS_ALL: (locator: ProjectLocator) => [
    "recent-workflow-runs",
    locator,
  ],
  WORKFLOW_RUN_READ: (runUri: string) => ["workflow-run-read", runUri],

  // ============================================================================
  // ORG-SCOPED KEYS
  // These queries require an organization/team identifier
  // ============================================================================
  PROJECTS: (org: string) => ["projects", org],
  ORGANIZATION: (slug: string) => ["team", slug],
  TEAM_MEMBERS: (slugOrId: string | number) => ["taem", slugOrId, "members"],
  TEAM_MEMBERS_WITH_ACTIVITY: (teamId: number, withActivity: boolean) => [
    "team-members",
    teamId,
    withActivity,
  ],
  TEAM_ROLES: (teamId: number) => ["team", teamId, "roles"],
  TEAM_ROLE: (teamId: number, roleId: number) => [
    "roles",
    "team",
    teamId,
    "role",
    roleId,
  ],
  ORG_THEME: (slug: string) => ["org-theme", slug],
  TEAM_THEME: (slug: string) => ["team-theme", slug],

  // ============================================================================
  // ROOT-SCOPED KEYS
  // These queries don't require project or org context
  // ============================================================================
  PROFILE: () => ["profile"],
  MY_INVITES: () => ["my_invites"],
  TEAMS: () => ["teams"],
  RECENT_PROJECTS: () => ["recent-projects"],
  PROJECTS_SIMPLE: () => ["projects"],
  REGISTRY_APP: (appName: string) => ["registry-app", appName],
  REGISTRY_APPS: (apps: string[]) => ["registry-apps", apps],
  INTEGRATIONS_MARKETPLACE: () => ["integrations", "marketplace"],
  INTEGRATION_SCHEMA: (appName: string) => [
    "integrations",
    "marketplace",
    appName,
    "schema",
  ],
  RESOURCES_LIST: (
    integrationId: string,
    resourceName: string,
    search?: string,
  ) => ["resources-v2-list", integrationId, resourceName, search],
  DECO_RESOURCE_READ: (
    integrationId: string,
    resourceName: string,
    uri: string,
  ) => ["deco-resource-read", integrationId, resourceName, uri],
  VIEW_RENDER_SINGLE: (
    integrationId: string,
    uri: string,
    toolName?: string,
  ) => ["view-render-single", integrationId, uri, toolName],
  TOOLS_SIMPLE: () => ["tools"],
  MCP_TOOLS: (connection: MCPConnection, ignoreCache?: boolean) => [
    "tools",
    connection.type,
    // oxlint-disable-next-line no-explicit-any
    (connection as any).url ||
      // oxlint-disable-next-line no-explicit-any
      (connection as any).tenant ||
      // oxlint-disable-next-line no-explicit-any
      (connection as any).name,
    ignoreCache,
  ],
  OPTIONS_LOADER: (type: string) => ["optionsLoader", type],
  WALLET_SIMPLE: () => ["wallet"],
  GITHUB_STARS: () => ["github-stars"],
};

/**
 * Utility to extract integration ID from a resource URI
 * @example parseIntegrationId("rsc://i:tools-management/tool/my-tool") => "i:tools-management"
 */
export function parseIntegrationId(uri: string): string {
  return uri.split("/")[2];
}
