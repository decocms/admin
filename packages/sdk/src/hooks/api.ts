import { Options } from "../crud/thread.ts";
import type { FileSystemOptions, Workspace } from "../index.ts";

export const KEYS = {
  FILE: (
    path: string,
    options?: FileSystemOptions,
  ) => ["file", path, options?.encoding, options?.mode, options?.flag],
  AGENT: (
    workspace: Workspace,
    agentId?: string,
  ) => ["agent", workspace, agentId],
  INTEGRATION: (
    workspace: Workspace,
    integrationId?: string,
  ) => ["integration", workspace, integrationId],
  THREADS: (
    workspace: Workspace,
    threadId?: string,
  ) => ["threads", workspace, threadId],
  TOOLS: (
    workspace: Workspace,
    agentId: string,
    threadId: string,
  ) => ["tools", workspace, agentId, threadId],
  AUDITS: (workspace: Workspace, options: Options) => [
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
  TEAM_MEMBERS: (
    slugOrId: string | number,
  ) => ["taem", slugOrId, "members"],
  TRIGGERS: (workspace: Workspace, agentId = "") => [
    "triggers",
    workspace,
    agentId,
  ],
};
