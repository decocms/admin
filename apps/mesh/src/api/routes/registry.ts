/**
 * Registry Routes
 *
 * API routes for registry-related operations like fetching tools
 * from external MCP servers before installation.
 */

import { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MeshContext } from "../../core/mesh-context";

type Variables = {
  meshContext: MeshContext;
};

const app = new Hono<{ Variables: Variables }>();

/**
 * POST /api/registry/tools
 *
 * Fetches tools from an external MCP server URL.
 * Used to preview tools for registry items before installation.
 */
app.post("/registry/tools", async (c) => {
  const body = await c.req.json<{
    url: string;
    headers?: Record<string, string>;
  }>();

  const { url, headers: customHeaders } = body;

  if (!url) {
    return c.json({ error: "URL is required" }, 400);
  }

  let client: Client | null = null;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Add SSE headers support for servers that require both JSON and Event Stream
      Accept: "application/json, text/event-stream",
      ...customHeaders,
    };

    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
    });

    client = new Client({
      name: "mcp-mesh-registry-preview",
      version: "1.0.0",
    });

    // Add timeout to prevent hanging connections
    const connectTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout after 15 seconds")), 15000);
    });

    const listToolsTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("List tools timeout after 20 seconds")), 20000);
    });

    console.log(`Attempting to fetch tools from: ${url}`);
    
    await Promise.race([client.connect(transport), connectTimeout]);
    console.log(`Connected to MCP server: ${url}`);
    
    const result = await Promise.race([client.listTools(), listToolsTimeout]);

    console.log(`Successfully fetched ${result.tools?.length ?? 0} tools from ${url}`);

    if (!result.tools || result.tools.length === 0) {
      return c.json({ tools: [] });
    }

    const tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? undefined,
      inputSchema: tool.inputSchema ?? {},
      outputSchema: tool.outputSchema ?? undefined,
    }));

    return c.json({ tools });
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to fetch tools from ${url}:`, {
      message: err.message,
      stack: err.stack,
    });

    return c.json(
      {
        error: "Failed to fetch tools",
        message: err.message,
        tools: [],
      },
      200, // Return 200 with empty tools to allow graceful fallback
    );
  } finally {
    try {
      if (client && typeof client.close === "function") {
        await client.close();
      }
    } catch {
      // Ignore close errors
    }
  }
});

export default app;
