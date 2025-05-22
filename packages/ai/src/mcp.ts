// deno-lint-ignore-file no-explicit-any
import type {
  DecoConnection,
  HTTPConnection,
  Integration,
  MCPConnection,
} from "@deco/sdk";
import { createSessionTokenCookie } from "@deco/sdk/auth";
import { AppContext, fromWorkspaceString, MCPClient } from "@deco/sdk/mcp";
import { slugify } from "@deco/sdk/memory";
import type { ToolAction } from "@mastra/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import type { AIAgent, Env } from "./agent.ts";
import { getTools } from "./deco.ts";
import { getToolsForInnateIntegration } from "./storage/tools.ts";
import { createTool } from "./utils/createTool.ts";
import { jsonSchemaToModel } from "./utils/jsonSchemaToModel.ts";
import { mapToolEntries } from "./utils/toolEntries.ts";

const ApiDecoChatURLs = [
  "https://api.deco.chat",
  "http://localhost:3001",
  "https://mcp-admin.wppagent.com",
];
export const isApiDecoChatMCPConnection = (
  connection: MCPConnection,
): connection is HTTPConnection =>
  "url" in connection &&
  connection.type === "HTTP" &&
  ApiDecoChatURLs.some((url) => connection.url.startsWith(url));

export const patchApiDecoChatTokenHTTPConnection = (
  connection: HTTPConnection,
  cookie?: string,
) => {
  return {
    ...connection,
    headers: {
      cookie,
    },
  };
};

const getMCPServerTools = async (
  mcpServer: Integration,
  agent: AIAgent,
  signal?: AbortSignal,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  const client = await createServerClient(mcpServer, signal).catch(
    console.error,
  );

  if (!client) {
    return {};
  }

  try {
    const { tools } = await client.listTools();
    const mtools: Record<string, ToolAction<any, any, any>> = Object
      .fromEntries(
        tools.map((tool: typeof tools[number]) => {
          const slug = slugify(tool.name);

          return [
            slug,
            createTool({
              id: slug,
              description: tool.description! ?? "",
              inputSchema: jsonSchemaToModel(tool.inputSchema),
              execute: async ({ context }) => {
                try {
                  return await client.callTool({
                    name: tool.name,
                    arguments: context,
                  });
                } catch (error) {
                  agent.resetCallableToolSet(mcpServer.id);
                  throw error;
                }
              },
            }),
          ];
        }),
      );

    return mtools;
  } catch (err) {
    console.error("[MCP] Error connecting to", mcpServer.name, err);
    await client.close();
    return {};
  }
};

export const fetchMeta = async (baseUrl: string) => {
  const response = await fetch(new URL("/live/_meta", baseUrl));
  if (!response.ok) {
    return null;
  }
  const meta: { schema: any } = await response.json();
  return meta;
};

export const getDecoSiteTools = async (
  settings: DecoConnection,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  const baseUrl = `https://${settings.tenant}.deco.site`;
  const meta = await fetchMeta(baseUrl);
  if (!meta) {
    return {};
  }

  const tools = getTools(meta.schema);

  const createdTools: Record<string, ReturnType<typeof createTool>> = {};
  for (const tool of tools) {
    try {
      const createdTool = createTool({
        id: tool.name,
        description: tool.description,
        inputSchema: jsonSchemaToModel(tool.inputSchema),
        outputSchema: jsonSchemaToModel(
          tool.outputSchema ?? {
            type: "object",
            additionalProperties: true,
          },
        ),
        execute: async ({ context }) => {
          const response = await fetch(
            new URL(`/live/invoke/${tool.resolveType}`, baseUrl),
            {
              method: "POST",
              body: typeof context === "string"
                ? context
                : JSON.stringify(context),
              headers: {
                "content-type": "application/json",
                ...(settings.token && {
                  authorization: settings.token,
                }),
              },
            },
          );
          return await response.json();
        },
      });

      createdTools[tool.name] = createdTool;
    } catch (err) {
      console.error(err);
      // ignore
    }
  }
  return createdTools;
};

export const mcpServerTools = async (
  mcpServer: Integration,
  agent: AIAgent,
  signal?: AbortSignal,
  env?: Env,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  if (!mcpServer.connection) {
    return {};
  }

  // Propagate req token to api.deco.chat integration
  if (isApiDecoChatMCPConnection(mcpServer.connection)) {
    const cookie = createSessionTokenCookie(
      await agent.token(),
      new URL(mcpServer.connection.url).hostname,
    );
    mcpServer.connection = patchApiDecoChatTokenHTTPConnection(
      mcpServer.connection,
      agent.metadata?.userCookie ?? cookie,
    );
  }

  const response = mcpServer.connection.type === "Deco"
    ? await getDecoSiteTools(mcpServer.connection)
    : mcpServer.connection.type === "INNATE"
    ? getToolsForInnateIntegration(mcpServer, agent, env)
    : await getMCPServerTools(mcpServer, agent, signal);

  return response;
};

export const createServerClient = async (
  mcpServer: Pick<Integration, "connection" | "name">,
  signal?: AbortSignal,
): Promise<Client> => {
  const transport = createTransport(mcpServer.connection, signal);

  if (!transport) {
    throw new Error("Unknown MCP connection type");
  }

  const client = new Client({
    name: mcpServer.name,
    version: "1.0.0",
    timeout: 180000, // 3 minutes
  });

  await client.connect(transport);

  return client;
};

export const createTransport = (
  connection: MCPConnection,
  signal?: AbortSignal,
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
    ..."headers" in connection ? (connection.headers || {}) : {},
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
  });
};

const handleMCPResponse = async (client: Client) => {
  const result = await client.listTools();
  const instructions = client.getInstructions();
  const capabilities = client.getServerCapabilities();
  const version = client.getServerVersion();

  return { tools: result.tools, instructions, capabilities, version };
};

export async function listToolsByConnectionType(
  connection: MCPConnection,
  ctx: AppContext,
) {
  switch (connection.type) {
    case "INNATE": {
      const mcpClient = MCPClient.forContext({
        ...ctx,
        workspace: ctx.workspace ??
          (connection.workspace
            ? fromWorkspaceString(connection.workspace)
            : undefined),
      });
      const maybeIntegration = await mcpClient.INTEGRATIONS_GET({
        id: connection.name,
      });

      if (!maybeIntegration) {
        return { error: `Integration ${connection.name} not found` };
      }

      const tools = await mcpServerTools({
        ...maybeIntegration,
        id: connection.name,
      }, {} as AIAgent);

      return { tools: mapToolEntries(tools) };
    }
    case "Deco": {
      const decoTools = await getDecoSiteTools(connection);
      return {
        tools: mapToolEntries(decoTools),
      };
    }
    case "Websocket":
    case "SSE":
    case "HTTP": {
      const client = await createServerClient({
        name: connection.type,
        connection,
      });
      return {
        ...(await handleMCPResponse(client)),
      };
    }
    default: {
      return { error: "Invalid connection type" };
    }
  }
}
