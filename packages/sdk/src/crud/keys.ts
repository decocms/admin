import { MCPClient } from "../fetcher.ts";
import { Workspace } from "../workspace.ts";

/**
 * Create an API key
 * @param workspace - The workspace
 * @param params - API key parameters
 * @returns The created API key
 */
export const createAPIKey = (
  workspace: Workspace,
  params: {
    claims?: {
      appName: string;
      integrationId: string;
      state: unknown;
    };
    name: string;
    policies: Array<{ effect: "allow" | "deny"; resource: string }>;
  },
) => MCPClient.forWorkspace(workspace).API_KEYS_CREATE(params);
