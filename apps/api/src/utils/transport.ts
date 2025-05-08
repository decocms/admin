import { Integration } from "@deco/sdk";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";

export const getTransportFor = (connection: Integration["connection"]) => {
  if (connection.type === "Deco" || connection.type === "INNATE") {
    throw new Error("Deco integrations are not supported");
  }

  const url = new URL(connection.url);

  if (connection.type === "Websocket") {
    return new WebSocketClientTransport(url);
  }

  if (connection.type === "SSE") {
    return new SSEClientTransport(url, {
      eventSourceInit: {
        fetch: (url, init) =>
          fetch(url, {
            ...init,
            headers: {
              ...init?.headers,
              ...connection.headers,
              authorization: `Bearer ${connection.token}`,
              accept: "text/event-stream",
            },
          }),
      },
    });
  }

  if (connection.type === "HTTP") {
    return new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          authorization: `Bearer ${connection.token}`,
        },
      },
    });
  }

  throw new Error(`Unsupported connection type`);
};
