import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DECO_CMS_API_LOCAL, DECO_CMS_API_PROD } from "./constants.js";
import { getRequestAuthHeaders } from "./session.js";

interface Options {
  workspace?: string;
  local?: boolean;
  integrationId?: string;
}
export const workspaceClientParams = async ({
  workspace,
  local,
  integrationId,
}: Options) => {
  const headers = await getRequestAuthHeaders();
  const api = local ? DECO_CMS_API_LOCAL : DECO_CMS_API_PROD;

  let path: string;
  if (integrationId && workspace) {
    // Integration-specific MCP endpoint: /:root/:slug/:integrationId/mcp
    const workspacePath = workspace.startsWith("/")
      ? workspace
      : `/shared/${workspace}`;
    path = `${workspacePath}/${integrationId}/mcp`;
  } else {
    // Workspace MCP endpoint: /:root/:slug/mcp
    path = !workspace || workspace.startsWith("/")
      ? `${workspace ?? ""}/mcp`
      : `/shared/${workspace}/mcp`;
  }

  const url = new URL(path, api);
  return { headers, url };
};

export const createWorkspaceClient = async ({
  workspace,
  local,
  integrationId,
}: Options) => {
  const client = new Client({ name: "deco-chat-cli", version: "1.0.0" });
  const { headers, url } = await workspaceClientParams({
    workspace,
    local,
    integrationId,
  });

  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers } }),
  );

  return client;
};
