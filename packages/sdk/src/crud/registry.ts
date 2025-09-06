import { MCPClient } from "../fetcher.ts";
import { Workspace } from "../workspace.ts";

/**
 * Get a registry app
 * @param workspace - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (
  workspace: Workspace,
  params: { name: string },
) => MCPClient.forWorkspace(workspace).REGISTRY_GET_APP(params);
