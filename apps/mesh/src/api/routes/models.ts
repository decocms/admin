import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { Hono } from "hono";
import { z } from "zod/v3";
import type { MeshContext } from "../../core/mesh-context";
import type { MCPConnection } from "../../storage/types";
import { ConnectionTools, OrganizationTools } from "../../tools";

// Default values
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MEMORY = 50; // last N messages to keep

// System prompt for AI assistant with MCP connections
const SYSTEM_PROMPT = `You are a helpful AI assistant with access to Model Context Protocol (MCP) connections.

**Your Capabilities:**
- Access to various MCP integrations and their tools
- Ability to discover what tools are available on each connection
- Execute tools from connected services to help users accomplish tasks

**How to Work with Connections:**
1. You have access to a list of available connections (each with an id, name, and description)
2. To see what tools a connection provides, use READ_MCP_TOOLS with the connection id
3. To execute a tool from a connection, use CALL_MCP_TOOL with the connectionId, toolName, and required arguments

**Important Guidelines:**
- Always check what tools are available before attempting to use them
- Read tool schemas carefully to understand required inputs
- Handle errors gracefully and explain issues to users
- Be proactive in discovering and using the right tools for the task

You are here to help users accomplish their goals by intelligently using the available MCP connections and tools.`;

type ConnectionSummary = {
  id: string;
  name: string;
  description: string | null;
};

// Helper to create MCP client for a connection
async function createConnectionClient(connection: MCPConnection) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (connection.connectionToken) {
    headers.Authorization = `Bearer ${connection.connectionToken}`;
  }

  if (connection.connectionHeaders) {
    Object.assign(headers, connection.connectionHeaders);
  }

  const transport = new StreamableHTTPClientTransport(
    new URL(connection.connectionUrl),
    {
      requestInit: {
        headers,
      },
    },
  );

  const client = new Client({
    name: "mcp-mesh-models-stream",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

// List all active connections for the organization (id, name, description only)
async function listConnections(
  ctx: MeshContext,
  organizationId: string,
): Promise<ConnectionSummary[]> {
  const connections = await ctx.storage.connections.list(organizationId);

  return connections
    .filter((conn) => conn.status === "active")
    .map((conn) => ({
      id: conn.id,
      name: conn.name,
      description: conn.description,
    }));
}

// Format connections for system prompt
function formatAvailableConnections(connections: ConnectionSummary[]): string {
  if (connections.length === 0) {
    return "No connections available.";
  }

  return connections
    .map(
      (conn) =>
        `- ${conn.name} (${conn.id}): ${conn.description || "No description"}`,
    )
    .join("\n");
}

const StreamRequestSchema = z.object({
  messages: z.any(), // Complex type from frontend, keeping as any
  modelId: z.string(),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  maxWindowSize: z.number().optional(),
  provider: z
    .enum([
      "openai",
      "anthropic",
      "google",
      "xai",
      "deepseek",
      "openrouter",
      "openai-compatible",
    ])
    .optional(),
});

export type StreamRequest = z.infer<typeof StreamRequestSchema>;

const app = new Hono<{ Variables: { meshContext: MeshContext } }>();

function ensureOrganization(ctx: MeshContext, orgSlug: string) {
  if (!ctx.organization) {
    throw new Error("Organization context is required");
  }

  if (ctx.organization.slug !== orgSlug) {
    throw new Error("Organization slug mismatch");
  }

  return ctx.organization;
}

async function getBindingConnection(
  ctx: MeshContext,
  organizationId: string,
): Promise<MCPConnection | null> {
  const settings = await OrganizationTools.ORGANIZATION_SETTINGS_GET.execute(
    { organizationId },
    ctx,
  );

  if (!settings.modelsBindingConnectionId) {
    return null;
  }

  const connection = await ctx.storage.connections.findById(
    settings.modelsBindingConnectionId,
  );

  if (!connection) {
    return null;
  }

  if (connection.organizationId !== organizationId) {
    throw new Error(
      "Configured MODELS binding does not belong to organization",
    );
  }

  if (connection.status !== "active") {
    throw new Error(
      `Configured MODELS binding connection is ${connection.status.toUpperCase()}`,
    );
  }

  return connection;
}

function buildConnectionHeaders(connection: MCPConnection) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(connection.connectionHeaders ?? {}),
  };

  if (connection.connectionToken) {
    if (headers.Authorization) {
      headers["x-deco-proxy-token"] = connection.connectionToken;
    } else {
      headers.Authorization = `Bearer ${connection.connectionToken}`;
    }
  }

  return headers;
}

function createProvider(
  provider: string | undefined,
  baseURL: string,
  headers: Record<string, string>,
) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ baseURL, apiKey: "", headers });
    case "google":
      return createGoogleGenerativeAI({ baseURL, apiKey: "", headers });
    case "deepseek":
      return createDeepSeek({ baseURL, apiKey: "", headers });
    case "xai":
      return createXai({ baseURL, apiKey: "", headers });
    case "openrouter":
      return createOpenRouter({
        baseURL,
        apiKey: "",
        headers,
        compatibility: "strict",
        // @ts-expect-error - fetch is somehow wrong.
        fetch: (input, init) => {
          const inputStr = input instanceof URL ? input.href : String(input);
          console.log("inputStr", inputStr);
          return fetch(inputStr.replace("/chat/completions", ""), {
            ...init,
            headers: {
              ...init?.headers,
              ...headers,
            },
          });
        },
      });
    default:
      // Default to OpenAI-compatible provider (covers OpenAI, etc.)
      return createOpenAI({ baseURL, headers });
  }
}

// Create AI SDK tools for connection management
function createConnectionTools(ctx: MeshContext) {
  return {
    READ_MCP_TOOLS: tool({
      description:
        "Get detailed information about a specific MCP connection, including all available tools with their schemas",
      inputSchema: z.object({
        id: z.string().describe("The connection ID"),
      }),
      execute: async ({ id }) => {
        try {
          return await ConnectionTools.CONNECTION_GET.execute({ id }, ctx);
        } catch (error) {
          console.error(`Error getting connection ${id}:`, error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: error instanceof Error ? error.message : "Unknown error",
              },
            ],
          };
        }
      },
    }),

    CALL_MCP_TOOL: tool({
      description:
        "Call a tool from a specific MCP connection. Use READ_MCP_TOOLS first to see available tools and their schemas.",
      inputSchema: z.object({
        connectionId: z
          .string()
          .describe("The connection ID to call the tool on"),
        toolName: z.string().describe("The name of the tool to call"),
        arguments: z
          .record(z.string(), z.any())
          .describe("Arguments to pass to the tool"),
      }),
      execute: async ({ connectionId, toolName, arguments: args }) => {
        // Get connection using existing tool
        const connection = await ctx.storage.connections.findById(connectionId);

        if (!connection) {
          throw new Error(`Connection not found: ${connectionId}`);
        }

        if (
          !ctx.organization ||
          connection.organizationId !== ctx.organization.id
        ) {
          throw new Error(
            "Connection does not belong to the current organization",
          );
        }

        if (connection.status !== "active") {
          throw new Error(`Connection is ${connection.status}, not active`);
        }

        // Create MCP client and call tool (reusing helper)
        let client: Client | null = null;
        try {
          client = await createConnectionClient(connection);
          const result = await client.callTool({
            name: toolName,
            arguments: args,
          });

          return {
            isError: result.isError || false,
            content: result.content,
          };
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: e instanceof Error ? e.message : "Unknown error",
              },
            ],
          };
        } finally {
          try {
            if (client && typeof client.close === "function") {
              await client.close();
            }
          } catch {
            // Ignore close errors
          }
        }
      },
    }),
  };
}

app.post("/:org/models/stream", async (c) => {
  const ctx = c.get("meshContext");
  const orgSlug = c.req.param("org");

  try {
    const organization = ensureOrganization(ctx, orgSlug);
    const [rawPayload, connection, connections] = await Promise.all([
      c.req.json(),
      getBindingConnection(ctx, organization.id),
      listConnections(ctx, organization.id),
    ]);

    if (!connection) {
      return c.json({ error: "MODELS binding not configured" }, 404);
    }

    // Validate request using Zod schema
    const parseResult = StreamRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return c.json(
        {
          error: "Invalid request body",
          details: parseResult.error.issues,
        },
        400,
      );
    }

    const payload = parseResult.data;

    const {
      modelId,
      messages,
      provider: modelProvider,
      temperature,
      maxOutputTokens = DEFAULT_MAX_TOKENS,
      maxWindowSize = DEFAULT_MEMORY,
    } = payload;

    const headers = buildConnectionHeaders(connection);

    // Convert UIMessages to CoreMessages using AI SDK helper
    const modelMessages = convertToModelMessages(messages);

    // Prune messages to reduce context size
    const prunedMessages = pruneMessages({
      messages: modelMessages,
      reasoning: "before-last-message",
      emptyMessages: "remove",
      toolCalls: "none",
    }).slice(-maxWindowSize);

    // Create provider based on the requested provider
    // const endpointUrl = `${connection.connectionUrl}/call-tool/STREAM_TEXT`;
    const endpointUrl = `${connection.connectionUrl}/call-tool/STREAM_TEXT`;
    const provider = createProvider(
      modelProvider,
      endpointUrl,
      headers,
    )(modelId);
    // const provider = createPassthroughProvider(endpointUrl, modelId, headers);

    // Build system prompt with available connections
    const systemPrompt = [
      SYSTEM_PROMPT,
      `\nAvailable MCP Connections:\n${formatAvailableConnections(
        connections,
      )}`,
    ].join("\n");

    // Create connection tools with MeshContext
    const connectionTools = createConnectionTools(ctx);

    // Use streamText from AI SDK with pruned messages and parameters
    const result = streamText({
      // model: provider(model || "default"),
      model: provider,
      messages: prunedMessages,
      system: systemPrompt,
      tools: connectionTools,
      temperature,
      maxOutputTokens,
      abortSignal: c.req.raw.signal,
      stopWhen: stepCountIs(30), // Stop after 5 steps with tool calls
      onError: (error) => {
        console.error("[models:stream] Error", error);
      },
      onAbort: (error) => {
        console.error("[models:stream] Abort", error);
      },
    });

    // Return the stream using toTextStreamResponse
    return result.toUIMessageStreamResponse();
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError") {
      console.warn(
        "[models:stream] Aborted",
        JSON.stringify({
          org: orgSlug,
        }),
      );
      return c.json({ error: "Request aborted" }, 400);
    }
    console.error(
      "[models:stream] Failed",
      JSON.stringify({
        org: orgSlug,
        error: err.message,
        stack: err.stack,
      }),
    );
    return c.json({ error: err.message }, 500);
  }
});

export default app;
