/**
 * DECO_COLLECTION_CONNECTIONS_LIST Tool
 *
 * List all connections in the organization with collection binding compliance.
 * Supports filtering, sorting, and pagination.
 */

import { type Binder, createBindingChecker } from "@decocms/bindings";
import {
  CollectionListInputSchema,
  createCollectionListOutputSchema,
  type WhereExpression,
  type OrderByExpression,
} from "@decocms/bindings/collections";
import { MODELS_BINDING } from "@decocms/bindings/models";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { appendFile } from "fs/promises";
import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";
import type { MCPConnection, ToolDefinition } from "../../storage/types";
import { ConnectionEntitySchema, connectionToEntity } from "./schema";

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

/**
 * Evaluate a where expression against a connection entity
 */
function evaluateWhereExpression(
  connection: MCPConnection,
  where: WhereExpression,
): boolean {
  if ("conditions" in where) {
    // Logical operator
    const { operator, conditions } = where;
    switch (operator) {
      case "and":
        return conditions.every((c) => evaluateWhereExpression(connection, c));
      case "or":
        return conditions.some((c) => evaluateWhereExpression(connection, c));
      case "not":
        return !conditions.every((c) => evaluateWhereExpression(connection, c));
      default:
        return true;
    }
  }

  // Comparison expression
  const { field, operator, value } = where;
  const fieldPath = field.join(".");
  const fieldValue = getFieldValue(connection, fieldPath);

  switch (operator) {
    case "eq":
      return fieldValue === value;
    case "gt":
      return fieldValue > (value as number | string);
    case "gte":
      return fieldValue >= (value as number | string);
    case "lt":
      return fieldValue < (value as number | string);
    case "lte":
      return fieldValue <= (value as number | string);
    case "in":
      return Array.isArray(value) && value.includes(fieldValue);
    case "like":
      if (typeof fieldValue !== "string" || typeof value !== "string")
        return false;
      // Limit pattern length to prevent ReDoS
      if (value.length > 100) return false;
      // Escape regex special chars, then convert % and _ wildcards
      const escaped = value
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${escaped}$`, "i").test(fieldValue);
    case "contains":
      if (typeof fieldValue !== "string" || typeof value !== "string")
        return false;
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    default:
      return true;
  }
}

/**
 * Get a field value from a connection, handling nested paths and field name mappings
 */
function getFieldValue(connection: MCPConnection, fieldPath: string): unknown {
  // Map collection field names to MCPConnection field names
  const fieldMapping: Record<string, string> = {
    title: "name",
    created_at: "createdAt",
    updated_at: "updatedAt",
    created_by: "createdById",
  };

  const mappedPath = fieldMapping[fieldPath] || fieldPath;

  const parts = mappedPath.split(".");
  let value: unknown = connection;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Apply orderBy expressions to sort connections
 */
function applyOrderBy(
  connections: MCPConnection[],
  orderBy: OrderByExpression[],
): MCPConnection[] {
  return [...connections].sort((a, b) => {
    for (const order of orderBy) {
      const fieldPath = order.field.join(".");
      const aValue = getFieldValue(a, fieldPath);
      const bValue = getFieldValue(b, fieldPath);

      let comparison = 0;

      // Handle nulls
      if (aValue == null && bValue == null) continue;
      if (aValue == null) {
        comparison = order.nulls === "first" ? -1 : 1;
      } else if (bValue == null) {
        comparison = order.nulls === "first" ? 1 : -1;
      } else if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      if (comparison !== 0) {
        return order.direction === "desc" ? -comparison : comparison;
      }
    }
    return 0;
  });
}

/**
 * Extended input schema with optional binding parameter
 */
const ConnectionListInputSchema = CollectionListInputSchema.extend({
  binding: z.union([z.object({}).passthrough(), z.string()]).optional(),
});

/**
 * Output schema using the ConnectionEntitySchema
 */
const ConnectionListOutputSchema = createCollectionListOutputSchema(
  ConnectionEntitySchema,
);

export const DECO_COLLECTION_CONNECTIONS_LIST = defineTool({
  name: "DECO_COLLECTION_CONNECTIONS_LIST",
  description:
    "List all connections in the organization with filtering, sorting, and pagination",

  inputSchema: ConnectionListInputSchema,
  outputSchema: ConnectionListOutputSchema,

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
    let filteredConnections = bindingChecker
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
        `DECO_COLLECTION_CONNECTIONS_LIST returning ${filteredConnections.length} connection(s) for binding ${input.binding}`,
      ).catch(() => {});
    }

    // Apply where filter if specified
    if (input.where) {
      filteredConnections = filteredConnections.filter((conn) =>
        evaluateWhereExpression(conn, input.where!),
      );
    }

    // Apply orderBy if specified
    if (input.orderBy && input.orderBy.length > 0) {
      filteredConnections = applyOrderBy(filteredConnections, input.orderBy);
    }

    // Calculate pagination
    const totalCount = filteredConnections.length;
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 100;
    const paginatedConnections = filteredConnections.slice(
      offset,
      offset + limit,
    );
    const hasMore = offset + limit < totalCount;

    return {
      items: paginatedConnections.map(connectionToEntity),
      totalCount,
      hasMore,
    };
  },
});

/**
 * @deprecated Use DECO_COLLECTION_CONNECTIONS_LIST instead
 */
export const CONNECTION_LIST = DECO_COLLECTION_CONNECTIONS_LIST;
