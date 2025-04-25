import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Context, Hono } from "hono";
// import cors from "hono/cors";
import * as agentsAPI from "./api/agents/api.ts";
import * as integrationsAPI from "./api/integrations/api.ts";
import { State } from "./utils.ts";

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

// Enable CORS for all routes on api.deco.chat and localhost
// app.use(cors());

// app.use("/:workspace/mcp", authMiddleware);

// Workspace MCP endpoint handler
app.post("/mcp", async (c: Context) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    // Create a new Response object to handle the MCP response
    const response = new Response();

    const handleMessage = State.bind(c, async () => {
      return await transport.handleRequest(c.req.raw, response);
    });

    await handleMessage();

    // Set the response headers and status
    for (const [key, value] of response.headers.entries()) {
      c.header(key, value);
    }
    // @ts-expect-error - Hono's status type is more restrictive
    c.status(response.status);

    // Stream the response body
    const reader = response.body?.getReader();
    if (reader) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      c.res = new Response(stream, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Clean up when the response is done
    c.executionCtx.waitUntil(
      new Promise<void>((resolve) => {
        const cleanup = () => {
          console.log("Request closed");
          transport.close();
          server.close();
          resolve();
        };

        // Clean up when the response is done
        c.res.body?.pipeTo(new WritableStream()).then(cleanup).catch(cleanup);
      }),
    );
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
