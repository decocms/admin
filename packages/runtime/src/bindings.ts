import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv, MCPBinding, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export const workspaceClient = (
  env: Pick<DefaultEnv, "DECO_CHAT_WORKSPACE" | "DECO_CHAT_API_TOKEN">,
): ReturnType<typeof MCPClient["forWorkspace"]> => {
  return MCPClient.forWorkspace(
    env.DECO_CHAT_WORKSPACE,
    env.DECO_CHAT_API_TOKEN,
  );
};

export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
  { reqToken, state, workspace }: RequestContext = {},
) => {
  let client: ReturnType<typeof workspaceClient>;
  let integrationId: string;
  if ("integration_id" in binding) {
    client = workspaceClient(env);
    integrationId = binding.integration_id;
  } else {
    if (!reqToken) {
      return null;
    }
    if (!workspace || typeof workspace !== "string") {
      throw new Error("Invalid token");
    }
    integrationId = state?.[binding.name] as string;
    client = workspaceClient({
      DECO_CHAT_WORKSPACE: workspace,
      DECO_CHAT_API_TOKEN: reqToken,
    });
  }
  let integration: Promise<{ connection: MCPConnection }> | null = null;
  return MCPClient.forConnection(async () => {
    integration ??= client.INTEGRATIONS_GET({ id: integrationId }) as Promise<
      { connection: MCPConnection }
    >;
    return (await integration).connection;
  });
};
