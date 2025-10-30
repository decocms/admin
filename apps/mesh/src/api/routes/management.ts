/**
 * Management Tools MCP Server
 * 
 * Exposes MCP Mesh management tools via MCP protocol at /mcp endpoint
 * Tools: PROJECT_CREATE, PROJECT_LIST, CONNECTION_CREATE, etc.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import z from 'zod';
import type { MeshContext } from '../../core/mesh-context';
import { ALL_TOOLS } from '../../tools';
import { HttpServerTransport } from '../http-server-transport';

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * MCP Server endpoint for management tools
 * 
 * Route: POST /mcp
 * Exposes all PROJECT_* and CONNECTION_* tools via MCP protocol
 */
app.post('/', async (c) => {
  const ctx = c.get('meshContext');

  // Create MCP server
  const server = new McpServer({
    name: 'mcp-mesh-management',
    version: '1.0.0',
  }, {
    capabilities: { tools: {} },
  });

  // Create transport
  const transport = new HttpServerTransport();

  // Register all management tools
  for (const tool of ALL_TOOLS) {
    const { name, description, inputSchema, outputSchema, execute } = tool;

    // Register tool - MCP server will automatically handle tools/call and tools/list
    server.registerTool(
      name,
      {
        description: description ?? '',
        inputSchema:
          inputSchema && "shape" in inputSchema
            ? (tool.inputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
        outputSchema:
          outputSchema &&
            typeof outputSchema === "object" &&
            "shape" in outputSchema
            ? (outputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
      },
      async (args: any) => {
        try {
          const result = await execute(args, ctx);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result),
            }],
            structuredContent: result,
          };
        } catch (error) {
          const err = error as Error;
          return {
            content: [{
              type: 'text',
              text: `Error: ${err.message}`,
            }],
            isError: true,
          };
        }
      }
    );
  }

  // Connect server to transport
  await server.connect(transport);

  // Handle the incoming MCP message - server automatically handles tools/call and tools/list
  return await transport.handleMessage(c.req.raw);
});

export default app;

