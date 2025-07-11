import { MCPConnection } from "./connection.ts";
import type { DefaultEnv, MCPBinding } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export type WorkspaceClientOptions = Pick<DefaultEnv, "DECO_CHAT_WORKSPACE" | "DECO_CHAT_API_TOKEN">;

export const workspaceClient = (
  env: WorkspaceClientOptions,
): ReturnType<typeof MCPClient["forWorkspace"]> => {
  return MCPClient.forWorkspace(
    env.DECO_CHAT_WORKSPACE,
    env.DECO_CHAT_API_TOKEN,
  );
};

const mcpClientForIntegrationId = (
  integrationId: string,
  env: WorkspaceClientOptions,
) => {
  const client = workspaceClient(env);
  let integration: Promise<{ connection: MCPConnection }> | null = null;
  return MCPClient.forConnection(async () => {
    integration ??= client.INTEGRATIONS_GET({
      id: integrationId,
    }) as Promise<{ connection: MCPConnection }>;
    return (await integration).connection;
  });
}
export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
) => {
  const integrationId = binding.integration_id;
  if (!integrationId) {
    return (integrationId: string, options?: WorkspaceClientOptions) => mcpClientForIntegrationId(integrationId, options ?? env);
  }
  return mcpClientForIntegrationId(integrationId, env);
};