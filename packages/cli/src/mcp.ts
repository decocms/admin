import { DECO_CHAT_API } from "./constants.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface Options {
  workspace: string;
  authCookie: string;
}

export const createWorkspaceClient = async (
  { workspace, authCookie }: Options,
) => {
  const client = new Client({ name: "deco-chat-cli", version: "1.0.0" });

  const transport = new StreamableHTTPClientTransport(
    new URL(`/shared/${workspace}/mcp`, DECO_CHAT_API),
    { requestInit: { headers: { "cookie": authCookie } } },
  );

  await client.connect(transport);

  return client;
};
