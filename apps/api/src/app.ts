import { HttpServerTransport } from "@deco/mcp/http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as agentsAPI from "./api/agents/api.ts";
import * as integrationsAPI from "./api/integrations/api.ts";
import * as membersAPI from "./api/members/api.ts";
import * as profilesAPI from "./api/profiles/api.ts";
import * as teamsAPI from "./api/teams/api.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { ApiHandler, createAIHandler, State } from "./utils/context.ts";

const app = new Hono();

// Register tools for each API handler
const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  membersAPI.getTeamMembers,
  membersAPI.addTeamMember,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
];

// Tools tied to an specific workspace
const WORKSPACE_TOOLS = [
  agentsAPI.getAgent,
  agentsAPI.deleteAgent,
  agentsAPI.createAgent,
  agentsAPI.updateAgent,
  agentsAPI.listAgents,
  integrationsAPI.getIntegration,
  integrationsAPI.createIntegration,
  integrationsAPI.updateIntegration,
  integrationsAPI.deleteIntegration,
  integrationsAPI.listIntegrations,
];

/**
 * Creates and sets up an MCP server for the given tools
 */
const createMCPHandlerFor = (tools: ApiHandler[]) => {
  const server = new McpServer(
    { name: "@deco/api", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      createAIHandler(tool.handler),
    );
  }

  return async (c: Context) => {
    try {
      const transport = new HttpServerTransport();

      await server.connect(transport);

      const handler = State.bind(c, transport.handleMessage.bind(transport));

      c.res = await handler(c.req.raw);
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
  };
};

/**
 * Setup a handler for handling tool calls. It's used so that
 * UIs can call the tools without suffering the serialization
 * of the protocol.
 */
const createToolCallHandlerFor =
  (tools: ApiHandler[]) => async (c: Context) => {
    const tool = c.req.param("tool");
    const args = await c.req.json();

    const t = tools.find((t) => t.name === tool);

    if (!t) {
      return c.json({
        error: {
          code: -32601,
          message: "Tool not found",
        },
      }, 404);
    }

    const { data, error } = t.schema.safeParse(args);

    if (error || !data) {
      return c.json({
        error: {
          code: -32602,
          message: error?.message ?? "Invalid arguments",
        },
      }, 400);
    }

    // deno-lint-ignore no-explicit-any
    const handleMessage = State.bind(c, (d: any) => t.handler(d));

    const result = await handleMessage(data);

    return c.json({ data: result });
  };

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

app.use(withContextMiddleware);
app.use(setUserMiddleware);

// MCP endpoint handlers
app.all(
  "/mcp",
  createMCPHandlerFor(GLOBAL_TOOLS),
);
app.all(
  "/:root/:slug/mcp",
  createMCPHandlerFor(WORKSPACE_TOOLS),
);

// Tool call endpoint handlers
app.post(
  "/tools/call/:tool",
  createToolCallHandlerFor(GLOBAL_TOOLS),
);
app.post(
  "/:root/:slug/tools/call/:tool",
  createToolCallHandlerFor(WORKSPACE_TOOLS),
);

// Health check endpoint
app.get("/health", (c: Context) => c.json({ status: "ok" }));

export default app;
