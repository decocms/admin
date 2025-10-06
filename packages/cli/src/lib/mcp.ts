import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DECO_CMS_API_LOCAL, DECO_CMS_API_PROD } from "./constants.js";
import { getRequestAuthHeaders } from "./session.js";

interface Options {
  workspace?: string;
  local?: boolean;
  integrationId?: string;
  pathname?: string;
}
export const workspaceClientParams = async ({
  workspace,
  local,
  integrationId,
  pathname,
}: Options) => {
  pathname ??= "/mcp";
  const headers = await getRequestAuthHeaders();
  const api = local ? DECO_CMS_API_LOCAL : DECO_CMS_API_PROD;

  let path: string;
  if (integrationId && workspace) {
    // Integration-specific MCP endpoint: /:root/:slug/:integrationId/mcp
    const workspacePath = workspace.startsWith("/")
      ? workspace
      : `/shared/${workspace}`;
    path = `${workspacePath}/${integrationId}${pathname}`;
  } else {
    // Workspace MCP endpoint: /:root/:slug/mcp
    path =
      !workspace || workspace.startsWith("/")
        ? `${workspace ?? ""}${pathname}`
        : `/shared/${workspace}${pathname}`;
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

export const createWorkspaceClientStub = async ({
  workspace,
  local,
  integrationId,
}: Options) => {
  const { headers, url } = await workspaceClientParams({
    workspace,
    local,
    integrationId,
    pathname: "/tools/call",
  });

  return {
    callTool: async ({
      name,
      arguments: props,
    }: {
      name: string;
      arguments: unknown;
    }) => {
      const toolUrl = url.href + `/${name as string}`;
      const response = await fetch(toolUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(props),
      });
      const textResponse = await response.text().catch(() => null);
      if (!textResponse) {
        return {
          isError: true,
          content: [{ text: `Error: ${response.status}` }],
        };
      }
      if (!response.ok) {
        return { isError: true, content: [{ text: textResponse }] };
      }
      return { structuredContent: JSON.parse(textResponse).data };
    },
  };
};
