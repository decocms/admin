/**
 * Management Tools MCP Server
 *
 * Exposes MCP Mesh management tools via MCP protocol at /mcp endpoint
 * Tools: PROJECT_CREATE, PROJECT_LIST, CONNECTION_CREATE, etc.
 */
import { bindingClient } from "@decocms/bindings/client";
import { Hono } from "hono";
import { ContextFactory } from "../../core/context-factory";
import type { MeshContext } from "../../core/mesh-context";
import { ALL_TOOLS } from "../../tools";
import { mcpServer, type ToolDefinition } from "../utils/mcp";

// Define Hono variables type
type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

const managementMCP = (ctx: MeshContext) => {
  // Convert ALL_TOOLS to ToolDefinition format
  const tools: ToolDefinition[] = ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: async (args: any) => {
      ctx.access.setToolName(tool.name);
      // Execute the tool with the mesh context
      return await tool.execute(args, ctx);
    },
  }));

  // Create and use MCP server with builder pattern
  const server = mcpServer({
    name: "mcp-mesh-management",
    version: "1.0.0",
  })
    .withTools(tools)
    .build();

  // Handle the incoming MCP message
  return server;
};

/**
 * MCP Server endpoint for management tools
 *
 * Route: POST /mcp
 * Exposes all PROJECT_* and CONNECTION_* tools via MCP protocol
 */
app.all("/", async (c) => {
  return managementMCP(c.get("meshContext")).fetch(c.req.raw);
});
const ManagementBinding = bindingClient(ALL_TOOLS);
export const Self = {
  forContext: (ctx: MeshContext) => {
    return ManagementBinding.forClient(managementMCP(ctx));
  },
  forRequest: async (req: Request) => {
    return Self.forContext(await ContextFactory.create(req));
  },
};

export default app;
