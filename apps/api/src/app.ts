import { HttpServerTransport } from "@deco/mcp/http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as agentsAPI from "./api/agents/api.ts";
import * as integrationsAPI from "./api/integrations/api.ts";
import { State } from "./utils/context.ts";
import { setUserMiddleware } from "./utils/user.ts";

const app = new Hono();

// Function to create and configure the MCP server
const createServer = () => {
  const server = new McpServer(
    { name: "@deco/api", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // Register tools for each API handler
  const tools = [
    agentsAPI.getAgent,
    agentsAPI.deleteAgent,
    agentsAPI.createAgent,
    agentsAPI.updateAgent,
    integrationsAPI.getIntegration,
    integrationsAPI.createIntegration,
    integrationsAPI.updateIntegration,
    integrationsAPI.deleteIntegration,
  ];

  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.handler);
  }

  return server;
};

const server = createServer();

// Add logger middleware
app.use(logger());

// Enable CORS for all routes on api.deco.chat and localhost
app.use(cors({
  origin: (origin) => origin,
  allowMethods: ["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cookie", "Accept"],
  exposeHeaders: ["Content-Type", "Authorization", "Set-Cookie"],
  credentials: true,
}));

app.use(setUserMiddleware);

// app.use("/:workspace/mcp", authMiddleware);

// Workspace MCP endpoint handler
app.all("/mcp", async (c: Context) => {
  try {
    const transport = new HttpServerTransport();

    await server.connect(transport);

    const handleMessage = State.bind(c, async () => {
      return await transport.handleMessage(c.req.raw);
    });

    c.res = await handleMessage();
  } catch (error) {
    console.error("Error handling MCP request:", error);

    return c.json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal server error",
      },
      id: null,
    }, 500);
  }
});

// Health check endpoint
app.get("/health", (c: Context) => c.json({ status: "ok" }));

export default app;
