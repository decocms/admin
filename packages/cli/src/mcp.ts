import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DECO_CHAT_API } from "./constants.ts";
import { getSessionCookies } from "./session.ts";

interface Options {
  workspace: string;
}

export const createWorkspaceClient = async (
  { workspace }: Options,
) => {
  const cookie = await getSessionCookies();

  const client = new Client({ name: "deco-chat-cli", version: "1.0.0" });

  await client.connect(
    new StreamableHTTPClientTransport(
      new URL(`/shared/${workspace}/mcp`, DECO_CHAT_API),
      { requestInit: { headers: { "cookie": cookie } } },
    ),
  );

  return client;
};
