import type { DefaultEnv } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export const createIntegrationBinding = (
  integrationId: string,
  env: DefaultEnv,
) => {
  const workspaceClient = MCPClient.forWorkspace(env.DECO_CHAT_WORKSPACE);
  let integration = null;
  return MCPClient.forConnection(async () => {
    integration ??= await workspaceClient.INTEGRATIONS_GET({
      id: integrationId,
    });
    return integration.connection;
  });
};
