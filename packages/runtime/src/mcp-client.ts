import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { MCPConnection } from "./connection.ts";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export const createServerClient = async (
  mcpServer: { connection: MCPConnection; name?: string },
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<Client> => {
  const transport = createTransport(mcpServer.connection, signal, extraHeaders);

  if (!transport) {
    throw new Error("Unknown MCP connection type");
  }

  const client = new Client(
    {
      name: mcpServer?.name ?? "MCP Client",
      version: "1.0.0",
      timeout: 180000, // 3 minutes
    },
    {
      capabilities: {
        roots: {
          listChanged: false,
        },
      },
    },
  );

  await client.connect(transport);

  return client;
};

export const createTransport = (
  connection: MCPConnection,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
) => {
  if (connection.type === "Websocket") {
    return new WebSocketClientTransport(new URL(connection.url));
  }

  if (connection.type !== "SSE" && connection.type !== "HTTP") {
    return null;
  }

  const authHeaders: Record<string, string> = connection.token
    ? { authorization: `Bearer ${connection.token}` }
    : {};

  const headers: Record<string, string> = {
    ...authHeaders,
    ...(extraHeaders ?? {}),
    ...("headers" in connection ? connection.headers || {} : {}),
  };

  if (connection.type === "SSE") {
    const config: SSEClientTransportOptions = {
      requestInit: { headers, signal },
    };

    if (connection.token) {
      config.eventSourceInit = {
        fetch: (req, init) => {
          return fetch(req, {
            ...init,
            headers: {
              ...headers,
              Accept: "text/event-stream",
            },
            signal,
          });
        },
      };
    }

    return new SSEClientTransport(new URL(connection.url), config);
  }
  return new StreamableHTTPClientTransport(new URL(connection.url), {
    requestInit: { headers, signal },
    sessionId: undefined,
  });
};
