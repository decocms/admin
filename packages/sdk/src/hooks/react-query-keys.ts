import type { ListModelsInput } from "../crud/model.ts";
import type { ThreadFilterOptions } from "../crud/thread.ts";
import type { ProjectLocator } from "../index.ts";
import type { Binder, MCPConnection } from "../models/mcp.ts";

export const KEYS = {
  // ============================================================================
  // PROJECT-SCOPED KEYS
  // These queries require a ProjectLocator (org/project context)
  // Locator is ALWAYS the first item in the array for easy cache invalidation
  // ============================================================================
  FILE: (locator: ProjectLocator, path: string) => [locator, "file", path],
  AGENT: (locator: ProjectLocator, agentId?: string) => [
    locator,
    "agent",
    agentId,
  ],
  INTEGRATION: (locator: ProjectLocator, integrationId?: string) => [
    locator,
    "integration",
    integrationId,
  ],
  INTEGRATION_TOOLS: (
    locator: ProjectLocator,
    integrationId: string,
    binder?: Binder,
  ) => [
    locator,
    "integration-tools",
    integrationId,
    ...(binder ? [binder] : []),
  ],
  INTEGRATION_API_KEY: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "integration-api-key",
    integrationId,
  ],
  CHANNELS: (locator: ProjectLocator, channelId?: string) => [
    locator,
    "channels",
    channelId,
  ],
  BINDINGS: (locator: ProjectLocator, binder: Binder) => [
    locator,
    "bindings",
    binder,
  ],
  THREADS: (locator: ProjectLocator, options?: ThreadFilterOptions) => {
    if (!options) {
      return [locator, "threads"];
    }
    return [
      locator,
      "threads",
      options.agentId,
      options.resourceId,
      options.orderBy,
      options.cursor,
      options.limit,
    ];
  },
  THREAD: (locator: ProjectLocator, threadId: string) => [
    locator,
    "thread",
    threadId,
  ],
  THREAD_MESSAGES: (locator: ProjectLocator, threadId: string) => [
    locator,
    "thread-messages",
    threadId,
  ],
  THREAD_TOOLS: (locator: ProjectLocator, threadId: string) => [
    locator,
    "thread-tools",
    threadId,
  ],
  TOOLS: (locator: ProjectLocator, agentId: string, threadId: string) => [
    locator,
    "tools",
    agentId,
    threadId,
  ],
  AUDITS: (locator: ProjectLocator, options: ThreadFilterOptions) => [
    locator,
    "audit",
    options.agentId,
    options.orderBy,
    options.cursor,
    options.limit,
    options.resourceId,
  ],
  TEAM_VIEWS: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "team-views",
    integrationId,
  ],
  WORKSPACE_VIEWS: (locator: ProjectLocator) => [locator, "workspace-views"],
  MODELS: (locator: ProjectLocator, options?: ListModelsInput) => [
    locator,
    "models",
    options?.excludeDisabled || false,
    options?.excludeAuto || false,
  ],
  MODEL: (locator: ProjectLocator, id: string) => [locator, "model", id],
  TRIGGERS: (locator: ProjectLocator, agentId = "") => [
    locator,
    "triggers",
    agentId,
  ],
  TRIGGER: (locator: ProjectLocator, triggerId: string) => [
    locator,
    "trigger",
    triggerId,
  ],
  PROMPTS: (
    locator: ProjectLocator,
    ids?: string[],
    resolveMentions?: boolean,
    excludeIds?: string[],
  ) => [
    locator,
    "prompts",
    ...(ids ? ids.sort() : []),
    `${resolveMentions ?? false}`,
    ...(excludeIds ? excludeIds.sort() : []),
  ],
  PROMPT: (locator: ProjectLocator, id: string) => [locator, "prompts", id],
  PROMPTS_SEARCH: (
    locator: ProjectLocator,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) => [locator, "prompts", query, limit, offset],
  PROMPT_VERSIONS: (locator: ProjectLocator, id: string) => [
    locator,
    "prompt-versions",
    id,
  ],
  WALLET: (locator: ProjectLocator) => [locator, "wallet"],
  WALLET_USAGE_AGENTS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => [locator, "wallet-usage-agents", range],
  WALLET_USAGE_THREADS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => [locator, "wallet-usage-threads", range],
  WALLET_BILLING_HISTORY: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => [locator, "wallet-billing-history", range],
  WALLET_CONTRACTS_PRE_AUTHORIZATIONS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => [locator, "wallet-contracts-pre-authorizations", range],
  WALLET_CONTRACTS_COMMITS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => [locator, "wallet-contracts-commits", range],
  WORKSPACE_PLAN: (locator: ProjectLocator) => [locator, "workspace-plan"],
  WORKSPACE_PERMISSION_DESCRIPTIONS: (locator: ProjectLocator) => [
    locator,
    "integration-tools",
    "workspace-management",
    "permission-descriptions",
    "workspace",
  ],
  WORKFLOWS: (locator: ProjectLocator, page?: number, per_page?: number) => [
    locator,
    "workflows",
    page,
    per_page,
  ],
  WORKFLOW: (locator: ProjectLocator, workflowName: string) => [
    locator,
    "workflow",
    workflowName,
  ],
  WORKFLOW_INSTANCES: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    per_page?: number,
  ) => [locator, "workflow-instances", workflowName, page, per_page],
  WORKFLOW_STATUS: (
    locator: ProjectLocator,
    workflowName: string,
    instanceId: string,
  ) => [locator, "workflow-status", workflowName, instanceId],
  WORKFLOW_NAMES: (locator: ProjectLocator) => [locator, "workflow-names"],
  WORKFLOW_RUNS: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    perPage?: number,
  ) => [locator, "workflow-runs", workflowName, page, perPage],
  KNOWLEDGE_FILES: (locator: ProjectLocator, connectionUrl: string) => [
    locator,
    "knowledge_files",
    connectionUrl,
  ],
  DOCUMENTS_FOR_MENTIONS: (locator: ProjectLocator) => [
    locator,
    "documents-for-mentions",
  ],
  TOOL: (locator: ProjectLocator, uri: string) => [locator, "tool", uri],
  DOCUMENT: (locator: ProjectLocator, uri: string) => [
    locator,
    "document",
    uri,
  ],
  WORKFLOW_BY_URI: (locator: ProjectLocator, uri: string) => [
    locator,
    "workflow-by-uri-v2",
    uri,
  ],
  VIEW: (locator: ProjectLocator, uri: string) => [locator, "view", uri],
  TOOLS_LIST: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "resources-v2-list",
    integrationId,
    "tool",
  ],
  DOCUMENTS_LIST: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "resources-v2-list",
    integrationId,
    "document",
  ],
  WORKFLOWS_LIST: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "resources-v2-list",
    integrationId,
    "workflow",
  ],
  VIEWS_LIST: (locator: ProjectLocator, integrationId: string) => [
    locator,
    "resources-v2-list",
    integrationId,
    "view",
  ],
  DOCUMENTS_SEARCH: (
    locator: ProjectLocator,
    term?: string,
    page?: number,
    pageSize?: number,
  ) => [locator, "documents", term, page, pageSize],
  WORKFLOW_RUNS_ALL: (locator: ProjectLocator) => [locator, "workflow-runs"],
  RECENT_WORKFLOW_RUNS: (
    locator: ProjectLocator,
    page?: number,
    perPage?: number,
  ) => [locator, "recent-workflow-runs", page, perPage],
  RECENT_WORKFLOW_RUNS_ALL: (locator: ProjectLocator) => [
    locator,
    "recent-workflow-runs",
  ],
  WORKFLOW_RUN_READ: (locator: ProjectLocator, runUri: string) => [
    locator,
    "workflow-run-read",
    runUri,
  ],
  RESOURCE_WATCH: (
    locator: ProjectLocator,
    resourceUri: string,
    pathFilter?: string,
  ) => [locator, "resource-watch", resourceUri, pathFilter],
  RESOURCES_LIST: (
    locator: ProjectLocator,
    integrationId: string,
    resourceName: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string,
  ) => [
    locator,
    "resources-v2-list",
    integrationId,
    resourceName,
    search,
    sortBy,
    sortOrder,
  ],
  DECO_RESOURCE_READ: (
    locator: ProjectLocator,
    integrationId: string,
    resourceName: string,
    uri: string,
  ) => [locator, "deco-resource-read", integrationId, resourceName, uri],
  VIEW_RENDER_SINGLE: (
    locator: ProjectLocator,
    integrationId: string,
    uri: string,
    toolName?: string,
  ) => [locator, "view-render-single", integrationId, uri, toolName],

  // ============================================================================
  // ORG-SCOPED KEYS
  // These queries require an organization identifier
  // ============================================================================
  PROJECTS: (org: string) => ["projects", org],
  ORGANIZATION: (slug: string) => ["organizations", slug],
  ORG_MEMBERS: (slugOrId: string | number) => [
    "organizations",
    slugOrId,
    "members",
  ],
  ORG_MEMBERS_WITH_ACTIVITY: (orgId: number, withActivity: boolean) => [
    "organization-members",
    orgId,
    withActivity,
  ],
  ORG_ROLES: (orgId: number) => ["organizations", orgId, "roles"],
  ORG_ROLE: (orgId: number, roleId: number) => [
    "organizations",
    orgId,
    "roles",
    roleId,
  ],
  ORG_THEME: (slug: string) => ["organizations", slug, "theme"],

  // ============================================================================
  // ROOT-SCOPED KEYS
  // These queries don't require project or org context
  // ============================================================================
  PROFILE: () => ["profile"],
  MY_INVITES: () => ["my_invites"],
  ORGANIZATIONS: () => ["organizations"],
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
  TOOLS_SIMPLE: () => ["tools"],
  MCP_TOOLS: (connection: MCPConnection, ignoreCache?: boolean) => {
    const identifier =
      "url" in connection
        ? connection.url
        : "tenant" in connection
          ? connection.tenant
          : "name" in connection
            ? connection.name
            : "";

    return ["tools", connection.type, identifier, `${!!ignoreCache}`];
  },
  OPTIONS_LOADER: (type: string) => ["optionsLoader", type],
  WALLET_SIMPLE: () => ["wallet"],
  GITHUB_STARS: () => ["github-stars"],
  ADMIN_CHECK: (email?: string) => ["admin-check", email],
  UNLISTED_APPS: () => ["unlisted-apps"],
};

/**
 * Utility to extract integration ID from a resource URI
 * @example parseIntegrationId("rsc://i:tools-management/tool/my-tool") => "i:tools-management"
 */
export function parseIntegrationId(uri: string): string {
  return uri.split("/")[2];
}
