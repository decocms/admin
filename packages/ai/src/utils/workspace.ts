import type { Workspace } from "@deco/sdk/path";

export const getWorkspaceFromTriggerId = (triggerId: string): Workspace => {
  return triggerId.split("/").slice(0, 3).join("/") as Workspace;
};
