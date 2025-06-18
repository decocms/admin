import type { DefaultEnv, MCPBinding } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
) => {
  const workspaceClient = MCPClient.forWorkspace(env.DECO_CHAT_WORKSPACE);
  let integration = null;
  return MCPClient.forConnection(async () => {
    integration ??= await workspaceClient.INTEGRATIONS_GET({
      id: binding.integration_id,
    });
    return integration.connection;
  });
};
