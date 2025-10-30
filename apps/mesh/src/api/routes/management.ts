/**
 * Management Tools MCP Server
 * 
 * Exposes MCP Mesh management tools via MCP protocol at /mcp endpoint
 * Tools: PROJECT_CREATE, PROJECT_LIST, CONNECTION_CREATE, etc.
 */
import { Hono } from 'hono';
import type { MeshContext } from '../../core/mesh-context';
import { ALL_TOOLS } from '../../tools';
import { mcpServer, type ToolDefinition } from '../utils/mcp';

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

  // Convert ALL_TOOLS to ToolDefinition format
  const tools: ToolDefinition[] = ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    handler: async (args: any) => {
      // Execute the tool with the mesh context
      return await tool.execute(args, ctx);
    },
  }));

  // Create and use MCP server with builder pattern
  const server = mcpServer({
    name: 'mcp-mesh-management',
    version: '1.0.0',
  })
    .withTools(tools)
    .build();

  // Handle the incoming MCP message
  return server.fetch(c.req.raw);
});

export default app;

