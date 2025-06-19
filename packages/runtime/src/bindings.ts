import type { DefaultEnv, MCPBinding } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export const workspaceClient = (
  env: DefaultEnv,
): ReturnType<typeof MCPClient["forWorkspace"]> => {
  return MCPClient.forWorkspace(
    env.DECO_CHAT_WORKSPACE,
    env.DECO_CHAT_API_TOKEN,
  );
};
export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
) => {
  const client = workspaceClient(env);
  let integration = null;
  return MCPClient.forConnection(async () => {
    integration ??= await client.INTEGRATIONS_GET({
      id: binding.integration_id,
    });
    return integration.connection;
  });
};
