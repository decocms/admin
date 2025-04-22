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
    agentId?: string,
    threadId?: string,
  ) => ["threads", workspace, agentId, threadId],
  TOOLS: (
    workspace: Workspace,
    agentId: string,
    threadId: string,
  ) => ["tools", workspace, agentId, threadId],
};
