/**
 * CONNECTION_LIST Tool
 *
 * List all connections in the organization
 */

import { type Binder, createBindingChecker } from "@decocms/bindings";
import { MODELS_BINDING } from "@decocms/bindings/models";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { appendFile } from "fs/promises";
import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";
import type { MCPConnection, ToolDefinition } from "../../storage/types";

async function logConnectionDebug(message: string) {
  try {
    await appendFile(
      "./connection-tools.log",
      `[${new Date().toISOString()}] ${message}\n`,
    );
  } catch {
    // ignore logging errors
  }
}

const BUILTIN_BINDING_CHECKERS: Record<string, Binder> = {
  MODELS: MODELS_BINDING,
};

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
    name: "mcp-mesh-connection-list",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

async function fetchToolsFromMCP(
  connection: MCPConnection,
): Promise<ToolDefinition[] | null> {
  let client: Client | null = null;
  try {
    await logConnectionDebug(
      `Fetching tools for connection ${connection.id} (${connection.name})`,
    );

    // Add timeout to prevent hanging connections
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 3000);
    });

    const fetchPromise = async () => {
      const c = await createConnectionClient(connection);
      client = c;
      return await c.listTools();
    };

    const result = await Promise.race([fetchPromise(), timeoutPromise]);

    if (!result.tools || result.tools.length === 0) {
      await logConnectionDebug(
        `No tools returned for connection ${connection.id}`,
      );
      return null;
    }

    const tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? undefined,
      inputSchema: tool.inputSchema ?? {},
      outputSchema: tool.outputSchema ?? undefined,
    }));
    await logConnectionDebug(
      `Fetched ${tools.length} tools for connection ${connection.id}`,
    );
    return tools;
  } catch (error) {
    console.error(
      `Failed to fetch tools from connection ${connection.id}:`,
      error,
    );
    await logConnectionDebug(
      `Error fetching tools for connection ${connection.id}: ${
        (error as Error).message
      }`,
    );
    return null;
  } finally {
    try {
      const c = client as Client | null;
      if (c && typeof c.close === "function") {
        await c.close();
      }
    } catch {
      // Ignore close errors
    }
  }
}

export const CONNECTION_LIST = defineTool({
  name: "CONNECTION_LIST",
  description: "List all connections in the organization",

  inputSchema: z.object({
    binding: z.union([z.object({}).passthrough(), z.string()]).optional(),
  }),

  outputSchema: z.object({
    connections: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        organizationId: z.string(),
        status: z.enum(["active", "inactive", "error"]),
        connectionType: z.enum(["HTTP", "SSE", "Websocket"]),
        connectionUrl: z.string(),
      }),
    ),
  }),

  handler: async (input, ctx) => {
    await ctx.access.check();

    const organization = requireOrganization(ctx);

    // Determine which binding to use: well-known binding (string) or provided JSON schema (object)
    const bindingDefinition: Binder | undefined = input.binding
      ? typeof input.binding === "string"
        ? (() => {
            const wellKnownBinding =
              BUILTIN_BINDING_CHECKERS[input.binding.toUpperCase()];
            if (!wellKnownBinding) {
              throw new Error(`Unknown binding: ${input.binding}`);
            }
            return wellKnownBinding;
          })()
        : (input.binding as unknown as Binder)
      : undefined;

    // Create binding checker from the binding definition
    const bindingChecker = bindingDefinition
      ? createBindingChecker(bindingDefinition)
      : undefined;

    let connections = await ctx.storage.connections.list(organization.id);

    // If a binding filter is specified, fetch tools for connections that need them
    if (bindingChecker) {
      const connectionsNeedingTools = connections.filter(
        (conn) => !conn.tools || conn.tools.length === 0,
      );

      // Fetch tools for all connections in parallel
      if (connectionsNeedingTools.length > 0) {
        const fetchResults = await Promise.all(
          connectionsNeedingTools.map(async (connection) => {
            const tools = await fetchToolsFromMCP(connection);
            return { connection, tools };
          }),
        );

        // Update connections with fetched tools
        await Promise.all(
          fetchResults.map(async ({ connection, tools }) => {
            if (tools && tools.length > 0) {
              await ctx.storage.connections.update(connection.id, { tools });
              await logConnectionDebug(
                `Stored ${tools.length} tools for connection ${connection.id}`,
              );
            }
          }),
        );

        // Refresh connections list after updates
        connections = await ctx.storage.connections.list(organization.id);
      }
    }

    // Filter connections by binding if specified
    const filteredConnections = bindingChecker
      ? await Promise.all(
          connections.map(async (connection) => {
            if (!connection.tools || connection.tools.length === 0) {
              return null;
            }

            const isValid = await bindingChecker.isImplementedBy(
              connection.tools.map((t) => ({
                name: t.name,
                inputSchema: t.inputSchema as Record<string, unknown>,
                outputSchema: t.outputSchema as
                  | Record<string, unknown>
                  | undefined,
              })),
            );

            if (!isValid) {
              logConnectionDebug(
                `Connection ${connection.id} does not implement binding`,
              ).catch(() => {});
              return null;
            }

            logConnectionDebug(
              `Connection ${connection.id} implements binding with tools: ${connection.tools
                .map((t) => t.name)
                .join(", ")}`,
            ).catch(() => {});

            return connection;
          }),
        ).then((results) =>
          results.filter((c): c is MCPConnection => c !== null),
        )
      : connections;

    if (bindingChecker) {
      logConnectionDebug(
        `CONNECTION_LIST returning ${filteredConnections.length} connection(s) for binding ${input.binding}`,
      ).catch(() => {});
    }

    return {
      connections: filteredConnections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        organizationId: c.organizationId,
        status: c.status,
        connectionType: c.connectionType,
        connectionUrl: c.connectionUrl,
      })),
    };
  },
});
