import type { ListModelsInput } from "../crud/model.ts";
import type { ThreadFilterOptions } from "../crud/thread.ts";
import type { ProjectLocator } from "../index.ts";
import type { Binder } from "../models/mcp.ts";

export const KEYS = {
  FILE: (workspace: string, path: string) => ["file", workspace, path],
  AGENT: (workspace: ProjectLocator, agentId?: string) => [
    "agent",
    workspace,
    agentId,
  ],
  INTEGRATION: (workspace: ProjectLocator, integrationId?: string) => [
    "integration",
    workspace,
    integrationId,
  ],
  INTEGRATION_TOOLS: (
    workspace: ProjectLocator,
    integrationId: string,
    binder?: Binder,
  ) => [
    "integration-tools",
    workspace,
    integrationId,
    ...(binder ? [binder] : []),
  ],
  CHANNELS: (workspace: ProjectLocator, channelId?: string) => [
    "channels",
    workspace,
    channelId,
  ],
  BINDINGS: (workspace: ProjectLocator, binder: Binder) => [
    "bindings",
    workspace,
    binder,
  ],
  THREADS: (workspace: ProjectLocator, options?: ThreadFilterOptions) => {
    if (!options) {
      return ["threads", workspace];
    }
    return [
      "threads",
      workspace,
      options.agentId,
      options.resourceId,
      options.orderBy,
      options.cursor,
      options.limit,
    ];
  },
  TOOLS: (workspace: ProjectLocator, agentId: string, threadId: string) => [
    "tools",
    workspace,
    agentId,
    threadId,
  ],
  AUDITS: (workspace: ProjectLocator, options: ThreadFilterOptions) => [
    "audit",
    workspace,
    options.agentId,
    options.orderBy,
    options.cursor,
    options.limit,
    options.resourceId,
  ],
  TEAMS: () => ["teams"],
  TEAM: (slug: string) => ["team", slug],
  TEAM_THEME: (slug: string) => ["team-theme", slug],
  TEAM_VIEWS: (workspace: ProjectLocator, integrationId: string) => [
    "team-views",
    workspace,
    integrationId,
  ],
  WORKSPACE_VIEWS: (workspace: ProjectLocator) => ["workspace-views", workspace],
  TEAM_MEMBERS: (slugOrId: string | number) => ["taem", slugOrId, "members"],
  TEAM_ROLES: (teamId: number) => ["team", teamId, "roles"],
  MY_INVITES: () => ["my_invites"],
  MODELS: (workspace: ProjectLocator, options?: ListModelsInput) => [
    "models",
    workspace,
    options?.excludeDisabled || false,
    options?.excludeAuto || false,
  ],
  MODEL: (workspace: ProjectLocator, id: string) => ["model", workspace, id],
  TRIGGERS: (workspace: ProjectLocator, agentId = "") => [
    "triggers",
    workspace,
    agentId,
  ],
  TRIGGER: (workspace: ProjectLocator, triggerId: string) => [
    "trigger",
    workspace,
    triggerId,
  ],
  THREAD: (workspace: ProjectLocator, threadId: string) => [
    "thread",
    workspace,
    threadId,
  ],
  THREAD_MESSAGES: (workspace: ProjectLocator, threadId: string) => [
    "thread-messages",
    workspace,
    threadId,
  ],
  THREAD_TOOLS: (workspace: ProjectLocator, threadId: string) => [
    "thread-tools",
    workspace,
    threadId,
  ],
  PROFILE: () => ["profile"],
  PROMPTS: (
    workspace: ProjectLocator,
    ids?: string[],
    resolveMentions?: boolean,
    excludeIds?: string[],
  ) => [
    "prompts",
    workspace,
    ...(ids ? ids.sort() : []),
    `${resolveMentions ?? false}`,
    ...(excludeIds ? excludeIds.sort() : []),
  ],
  PROMPT: (workspace: ProjectLocator, id: string) => ["prompts", workspace, id],
  PROMPTS_SEARCH: (
    workspace: ProjectLocator,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) => ["prompts", workspace, query, limit, offset],
  PROMPT_VERSIONS: (workspace: ProjectLocator, id: string) => [
    "prompt-versions",
    workspace,
    id,
  ],
  WALLET: (workspace: ProjectLocator) => ["wallet", workspace],
  WALLET_USAGE_AGENTS: (
    workspace: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-agents", workspace, range],
  WALLET_USAGE_THREADS: (
    workspace: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-threads", workspace, range],
  WALLET_BILLING_HISTORY: (
    workspace: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => ["wallet-billing-history", workspace, range],
  WORKSPACE_PLAN: (workspace: ProjectLocator) => ["workspace-plan", workspace],
  WORKFLOWS: (workspace: ProjectLocator, page?: number, per_page?: number) => [
    "workflows",
    workspace,
    page,
    per_page,
  ],
  WORKFLOW: (workspace: ProjectLocator, workflowName: string) => [
    "workflow",
    workspace,
    workflowName,
  ],
  WORKFLOW_INSTANCES: (
    workspace: ProjectLocator,
    workflowName: string,
    page?: number,
    per_page?: number,
  ) => ["workflow-instances", workspace, workflowName, page, per_page],
  WORKFLOW_STATUS: (
    workspace: ProjectLocator,
    workflowName: string,
    instanceId: string,
  ) => ["workflow-status", workspace, workflowName, instanceId],
  KNOWLEDGE_FILES: (workspace: ProjectLocator, connectionUrl: string) => [
    "knowledge_files",
    workspace,
    connectionUrl,
  ],
};
