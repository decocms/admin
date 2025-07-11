import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv, MCPBinding, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";

export type WorkspaceClientOptions = Pick<
  DefaultEnv,
  "DECO_CHAT_WORKSPACE" | "DECO_CHAT_API_TOKEN"
>;

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
};

export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
  ctx?: RequestContext,
) => {
  const integrationId = binding.integration_id;
  if (!integrationId) {
    const bindingFromState = ctx?.state?.[binding.name];
    const integrationId =
      bindingFromState && typeof bindingFromState === "object" &&
        "value" in bindingFromState
        ? bindingFromState.value
        : undefined;
    if (typeof integrationId !== "string") {
      throw new Error(`No integration id found on ${ctx}`);
    }
    const reqEnv = ctx?.workspace && ctx?.token
      ? {
        DECO_CHAT_WORKSPACE: ctx.workspace,
        DECO_CHAT_API_TOKEN: ctx.token,
      }
      : env;
    return mcpClientForIntegrationId(integrationId, reqEnv);
  }
  return mcpClientForIntegrationId(integrationId, env);
};
