/**
 * MCP Proxy Routes
 *
 * Proxies MCP requests to downstream connections using the official MCP SDK.
 * Based on the pattern from @modelcontextprotocol/typescript-sdk
 *
 * Architecture:
 * - Creates MCP Server to handle incoming requests
 * - Creates MCP Client to connect to downstream connections
 * - Uses middleware pipeline for authorization
 * - Supports StreamableHTTP transport
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type ListToolsRequest,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { AccessControl } from "../../core/access-control";
import type { MeshContext } from "../../core/mesh-context";
import { HttpServerTransport } from "../http-server-transport";
import { compose } from "../utils/compose";

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

// ============================================================================
// Middleware Types
// ============================================================================

type CallToolMiddleware = (
  request: CallToolRequest,
  next: () => Promise<CallToolResult>,
) => Promise<CallToolResult>;

// ============================================================================
// Authorization Middleware
// ============================================================================

/**
 * Authorization middleware - checks access to tool on connection
 * Inspired by withMCPAuthorization from @deco/sdk
 *
 * Permissions format: { 'conn_<UUID>': ['TOOL1', 'TOOL2', '*'] }
 * This checks if the user has permission for the specific tool on this connection
 */
function withConnectionAuthorization(
  ctx: MeshContext,
  connectionId: string,
): CallToolMiddleware {
  return async (request, next) => {
    if (!ctx.auth.apiKey) {
      return await next();
    }

    try {
      const toolName = request.params.name;

      // Create AccessControl with connectionId set
      // This allows it to check: does user have permission for this TOOL on this CONNECTION?
      // Example: { 'conn_123': ['SEND_MESSAGE'] } - allows SEND_MESSAGE on conn_123
      const connectionAccessControl = new AccessControl(
        ctx.authInstance,
        ctx.auth.user?.id ?? ctx.auth.apiKey?.userId,
        toolName, // Tool being called
        ctx.auth.apiKey?.permissions,
        ctx.auth.user?.role,
        connectionId, // Connection ID to filter by
      );

      // Check permission for this specific tool on this connection
      await connectionAccessControl.check(toolName);

      return await next();
    } catch (error) {
      const err = error as Error;
      return {
        content: [
          {
            type: "text",
            text: `Authorization failed: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  };
}

// ============================================================================
// MCP Proxy Factory
// ============================================================================

/**
 * Create MCP proxy for a downstream connection
 * Pattern from @deco/api proxy() function
 *
 * Single server approach - tools from downstream are dynamically fetched and registered
 */
async function createMCPProxy(connectionId: string, ctx: MeshContext) {
  // Get connection details
  const connection = await ctx.storage.connections.findById(connectionId);
  if (!connection) {
    throw new Error("Connection not found");
  }

  if (ctx.organization && connection.organization_id !== ctx.organization.id) {
    throw new Error("Connection does not belong to the active organization");
  }

  if (connection.status !== "active") {
    throw new Error(`Connection inactive: ${connection.status}`);
  }

  // Issue configuration JWT if connection has configuration state
  let configurationToken: string | undefined;
  if (
    connection.configuration_state &&
    connection.configuration_scopes &&
    connection.configuration_scopes.length > 0
  ) {
    // Parse scopes to build permissions object
    // Format: "KEY::SCOPE" where KEY is in state and state[KEY].value is a connection ID
    // Result: { [connectionId]: [scopes...] }
    const permissions: Record<string, string[]> = {};

    for (const scope of connection.configuration_scopes) {
      const parts = scope.split("::");
      if (parts.length === 2) {
        const [key, scopeName] = parts;
        if (!key || !scopeName) continue; // Skip invalid parts

        const stateValue: unknown = connection.configuration_state[key];

        if (
          typeof stateValue === "object" &&
          stateValue !== null &&
          "value" in stateValue
        ) {
          const connectionIdRef = (stateValue as { value: unknown }).value;
          if (typeof connectionIdRef === "string") {
            // Add scope to this connection's permissions
            if (!permissions[connectionIdRef]) {
              permissions[connectionIdRef] = [];
            }
            permissions[connectionIdRef].push(scopeName);
          }
        }
      }
    }

    // Issue short-lived API key with configuration permissions
    // Using Better Auth API Key plugin
    const userId = ctx.auth.user?.id ?? ctx.auth.apiKey?.userId;
    if (!userId) {
      throw new Error("User ID required to issue configuration token");
    }

    try {
      const apiKeyResult = await ctx.authInstance.api.createApiKey({
        body: {
          userId,
          name: `mesh-config-${connectionId}-${Date.now()}`,
          permissions,
          metadata: {
            state: connection.configuration_state,
            meshUrl: ctx.baseUrl, // Include mesh URL so receivers know where mesh is running
            connectionId,
          },
          expiresIn: 60 * 5, // 5 minutes - short lived
        },
      });

      // Extract the generated token from result
      // Better Auth returns the key directly in the result
      if (apiKeyResult && "key" in apiKeyResult) {
        configurationToken = apiKeyResult.key;
      }
    } catch (error) {
      console.error("Failed to issue configuration token:", error);
      // Continue without configuration token - downstream will fail if it requires it
    }
  }

  // Create client factory for downstream MCP
  const createClient = async () => {
    // Prepare headers
    const headers: Record<string, string> = {};

    // Add connection token (already decrypted by storage layer)
    if (connection.connection_token) {
      headers["Authorization"] = `Bearer ${connection.connection_token}`;
    }

    // Add configuration token if issued
    if (configurationToken) {
      headers["x-mesh-token"] = `Bearer ${configurationToken}`;
    }

    // Add custom headers
    if (connection.connection_headers) {
      Object.assign(headers, connection.connection_headers);
    }

    // Create transport to downstream MCP using StreamableHTTP
    const transport = new StreamableHTTPClientTransport(
      new URL(connection.connection_url),
      { requestInit: { headers } },
    );

    // Create MCP client
    const client = new Client({
      name: "mcp-mesh-proxy",
      version: "1.0.0",
    });

    await client.connect(transport);

    return client;
  };

  // Create authorization middleware
  const authMiddleware = withConnectionAuthorization(ctx, connectionId);

  // Compose middlewares
  const callToolPipeline = compose(authMiddleware);

  // Create fetch function that handles MCP protocol
  const fetch = async (req: Request) => {
    // Create MCP server for this proxy
    const server = new McpServer(
      {
        name: "mcp-mesh",
        version: "1.0.0",
      },
      {
        capabilities: { tools: {} },
      },
    );

    // Create transport (uses HttpServerTransport for fetch Request/Response)
    const transport = new HttpServerTransport();

    // Connect server to transport
    await server.connect(transport);

    // Manually implement list_tools - fetch from downstream and return
    server.server.setRequestHandler(
      ListToolsRequestSchema,
      async (_request: ListToolsRequest): Promise<ListToolsResult> => {
        const client = await createClient();
        return await client.listTools();
      },
    );

    // Set up call tool handler with middleware
    server.server.setRequestHandler(
      CallToolRequestSchema,
      (request: CallToolRequest) =>
        callToolPipeline(request, async (): Promise<CallToolResult> => {
          const client = await createClient();
          const startTime = Date.now();

          // Start span for tracing
          return await ctx.tracer.startActiveSpan(
            "mcp.proxy.callTool",
            {
              attributes: {
                "connection.id": connectionId,
                "tool.name": request.params.name,
              },
            },
            async (span) => {
              try {
                const result = await client.callTool(request.params);
                const duration = Date.now() - startTime;

                // Record duration histogram
                ctx.meter
                  .createHistogram("connection.proxy.duration")
                  .record(duration, {
                    "connection.id": connectionId,
                    "tool.name": request.params.name,
                    status: "success",
                  });

                // Record success counter
                ctx.meter.createCounter("connection.proxy.requests").add(1, {
                  "connection.id": connectionId,
                  "tool.name": request.params.name,
                  status: "success",
                });

                span.end();
                return result as CallToolResult;
              } catch (error) {
                const err = error as Error;
                const duration = Date.now() - startTime;

                // Record duration histogram even on error
                ctx.meter
                  .createHistogram("connection.proxy.duration")
                  .record(duration, {
                    "connection.id": connectionId,
                    "tool.name": request.params.name,
                    status: "error",
                  });

                // Record error counter
                ctx.meter.createCounter("connection.proxy.errors").add(1, {
                  "connection.id": connectionId,
                  "tool.name": request.params.name,
                  error: err.message,
                });

                span.recordException(err);
                span.end();

                throw error;
              }
            },
          );
        }),
    );

    // Handle the incoming message
    return await transport.handleMessage(req);
  };

  return { fetch };
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * Proxy MCP request to a downstream connection
 *
 * Route: POST /mcp/:connectionId
 * Connection IDs are globally unique UUIDs (no project prefix needed)
 */
app.all("/:connectionId", async (c) => {
  const connectionId = c.req.param("connectionId");
  const ctx = c.get("meshContext");

  try {
    const proxy = await createMCPProxy(connectionId, ctx);
    return await proxy.fetch(c.req.raw);
  } catch (error) {
    const err = error as Error;

    if (err.message.includes("not found")) {
      return c.json({ error: err.message }, 404);
    }
    if (err.message.includes("inactive")) {
      return c.json({ error: err.message }, 503);
    }

    return c.json(
      { error: "Internal server error", message: err.message },
      500,
    );
  }
});

export default app;
