import type { Workspace } from '@deco/sdk/path';

export const getWorkspaceFromAgentId = (agentId: string): Workspace => {
  return agentId.split('/').slice(0, 3).join('/') as Workspace;
};
