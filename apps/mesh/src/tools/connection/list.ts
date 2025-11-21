/**
 * CONNECTION_LIST Tool
 *
 * List all connections in the organization
 */

import Ajv, { type ValidateFunction } from "ajv";
import { z } from "zod/v3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";
import { MODELS_BINDING_SCHEMA } from "../../core/bindings";
import type { MCPConnection, ToolDefinition } from "../../storage/types";
import { appendFile } from "fs/promises";

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

const ajv = new Ajv({ strict: false, allErrors: false });
const BUILTIN_BINDINGS: Record<string, object> = {
  MODELS: MODELS_BINDING_SCHEMA,
};

function resolveBindingSchema(
  binding?: Record<string, unknown> | string,
): object | null {
  if (!binding) return null;

  if (typeof binding === "string") {
    const schema = BUILTIN_BINDINGS[binding.toUpperCase()];
    if (!schema) {
      throw new Error(`Unknown binding schema: ${binding}`);
    }
    return schema;
  }

  return binding;
}

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
    client = await createConnectionClient(connection);
    const result = await client.listTools();

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
      `Error fetching tools for connection ${connection.id}: ${(error as Error).message}`,
    );
    return null;
  } finally {
    if (client?.close) {
      await client.close();
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
    const schema = resolveBindingSchema(
      input.binding as Record<string, unknown> | string | undefined,
    );
    let validator: ValidateFunction<Record<string, unknown>> | undefined;
    const schemaProperties =
      schema &&
      typeof schema === "object" &&
      "properties" in (schema as Record<string, unknown>)
        ? ((schema as { properties?: Record<string, unknown> }).properties ??
          null)
        : null;
    const schemaPropertyKeys = schemaProperties
      ? Object.keys(schemaProperties)
      : null;

    if (schema) {
      try {
        validator = ajv.compile<Record<string, unknown>>(schema);
      } catch (error) {
        throw new Error(
          `Invalid binding schema provided: ${(error as Error).message}`,
        );
      }
    }

    let connections = await ctx.storage.connections.list(organization.id);

    // If a validator is present, check which connections need tools fetched
    if (validator) {
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

    const filteredConnections = validator
      ? connections.filter((connection) => {
          if (!connection.tools || connection.tools.length === 0) {
            return false;
          }

          const toolMap = Object.fromEntries(
            connection.tools.map((tool) => [
              tool.name,
              {
                input: tool.inputSchema ?? {},
                output: tool.outputSchema ?? {},
              },
            ]),
          );

          const bindingToolMap =
            schemaPropertyKeys === null
              ? toolMap
              : Object.fromEntries(
                  schemaPropertyKeys
                    .filter((name) => name in toolMap)
                    .map((name) => [name, toolMap[name]]),
                );

          const isValid = validator?.(bindingToolMap) ?? true;
          if (!isValid) {
            logConnectionDebug(
              `Connection ${connection.id} failed binding validation: ${JSON.stringify(validator?.errors ?? [])}`,
            ).catch(() => {});
          } else if (schemaPropertyKeys !== null) {
            logConnectionDebug(
              `Connection ${connection.id} satisfied binding schema with required tools: ${schemaPropertyKeys.join(", ")}`,
            ).catch(() => {});
          }

          return isValid;
        })
      : connections;

    if (schema) {
      logConnectionDebug(
        `CONNECTION_LIST returning ${filteredConnections.length} connection(s) for binding ${typeof input.binding === "string" ? input.binding : "custom schema"}`,
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
