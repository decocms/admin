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

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type ListToolsRequest,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Hono } from 'hono';
import { AccessControl } from '../../core/access-control';
import type { MeshContext } from '../../core/mesh-context';
import { HttpServerTransport } from '../http-server-transport';

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

// ============================================================================
// Middleware Types & Composition
// ============================================================================

type CallToolMiddleware = (
  request: CallToolRequest,
  next: () => Promise<CallToolResult>
) => Promise<CallToolResult>;

/**
 * Compose middlewares (from @deco/sdk/mcp/middlewares.ts)
 */
const compose = <TRequest, TResponse>(
  ...middlewares: ((req: TRequest, next: () => Promise<TResponse>) => Promise<TResponse>)[]
) => {
  return function composedResolver(request: TRequest, finalHandler: () => Promise<TResponse>) {
    const dispatch = (i: number): Promise<TResponse> => {
      const middleware = middlewares[i];
      if (!middleware) {
        return finalHandler();
      }
      const next = () => dispatch(i + 1);
      return middleware(request, next);
    };
    return dispatch(0);
  };
};

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
  connectionId: string
): CallToolMiddleware {
  return async (request, next) => {
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
        connectionId // Connection ID to filter by
      );

      // Check permission for this specific tool on this connection
      await connectionAccessControl.check(toolName);

      return await next();
    } catch (error) {
      const err = error as Error;
      return {
        content: [{
          type: 'text',
          text: `Authorization failed: ${err.message}`,
        }],
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
 */
async function createMCPProxy(connectionId: string, ctx: MeshContext) {
  // Get connection details
  const connection = await ctx.storage.connections.findById(connectionId);

  if (!connection) {
    throw new Error('Connection not found');
  }

  if (connection.status !== 'active') {
    throw new Error(`Connection inactive: ${connection.status}`);
  }

  // Create client factory for downstream MCP
  const createClient = async () => {
    // Prepare headers
    const headers: Record<string, string> = {};

    // Add connection token (decrypt first)
    if (connection.connectionToken) {
      const decryptedToken = await ctx.vault.decrypt(connection.connectionToken);
      headers['Authorization'] = `Bearer ${decryptedToken}`;
    }

    // Add custom headers
    if (connection.connectionHeaders) {
      Object.assign(headers, connection.connectionHeaders);
    }

    // Create transport to downstream MCP using StreamableHTTP
    const transport = new StreamableHTTPClientTransport(
      new URL(connection.connectionUrl),
      headers
    );

    // Create MCP client
    const client = new Client({
      name: 'mcp-mesh-proxy',
      version: '1.0.0',
    });

    await client.connect(transport);

    return client;
  };

  // Create authorization middleware
  const authMiddleware = withConnectionAuthorization(ctx, connectionId);

  // Compose middlewares (without final handler)
  const callToolPipeline = compose(authMiddleware);

  const listTools = async (_: ListToolsRequest): Promise<ListToolsResult> => {
    const client = await createClient();
    return await client.listTools();
  };

  // Create fetch function that handles MCP protocol
  const fetch = async (req: Request) => {
    // Create MCP server for this proxy
    const server = new McpServer({
      name: 'mcp-mesh',
      version: '1.0.0',
    }, {
      capabilities: { tools: {} },
    });

    // Create transport (uses HttpServerTransport for fetch Request/Response)
    const transport = new HttpServerTransport();

    // Connect server to transport
    await server.connect(transport);

    // Set up request handlers
    server.server.setRequestHandler(
      CallToolRequestSchema,
      (request: CallToolRequest) => callToolPipeline(request, async (): Promise<CallToolResult> => {
        const client = await createClient();

        // Start span for tracing
        return await ctx.tracer.startActiveSpan(
          'mcp.proxy.callTool',
          {
            attributes: {
              'connection.id': connectionId,
              'tool.name': request.params.name,
            },
          },
          async (span) => {
            try {
              const result = await client.callTool(request.params);

              // Record success metrics
              ctx.meter.createCounter('connection.proxy.requests').add(1, {
                'connection.id': connectionId,
                'tool.name': request.params.name,
              });

              span.end();
              return result as CallToolResult;
            } catch (error) {
              const err = error as Error;

              ctx.meter.createCounter('connection.proxy.errors').add(1, {
                'connection.id': connectionId,
                'error': err.message,
              });

              span.recordException(err);
              span.end();

              throw error;
            }
          }
        );
      })
    );

    server.server.setRequestHandler(
      ListToolsRequestSchema,
      listTools
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
app.post('/:connectionId', async (c) => {
  const connectionId = c.req.param('connectionId');
  const ctx = c.get('meshContext');

  try {
    const proxy = await createMCPProxy(connectionId, ctx);
    return await proxy.fetch(c.req.raw);
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found')) {
      return c.json({ error: err.message }, 404);
    }
    if (err.message.includes('inactive')) {
      return c.json({ error: err.message }, 503);
    }

    return c.json({ error: 'Internal server error', message: err.message }, 500);
  }
});

export default app;
