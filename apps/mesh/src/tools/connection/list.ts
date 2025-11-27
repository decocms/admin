/**
 * COLLECTION_CONNECTIONS_LIST Tool
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
import { AGENTS_BINDING } from "@decocms/bindings/agents";
import { MODELS_BINDING } from "@decocms/bindings/models";
import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";
import { requireOrganization } from "../../core/mesh-context";
import { ConnectionEntitySchema, type ConnectionEntity } from "./schema";

const BUILTIN_BINDING_CHECKERS: Record<string, Binder> = {
  MODELS: MODELS_BINDING,
  AGENTS: AGENTS_BINDING,
};

/**
 * Convert SQL LIKE pattern to regex pattern by tokenizing
 * Handles % (any chars) and _ (single char) wildcards
 */
function convertLikeToRegex(likePattern: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < likePattern.length) {
    const char = likePattern[i];
    if (char === "%") {
      result.push(".*");
    } else if (char === "_") {
      result.push(".");
    } else if (/[.*+?^${}()|[\]\\]/.test(char)) {
      // Escape regex special characters
      result.push("\\" + char);
    } else {
      result.push(char);
    }
    i++;
  }

  return result.join("");
}

/**
 * Evaluate a where expression against a connection entity
 */
function evaluateWhereExpression(
  connection: ConnectionEntity,
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
      // Convert SQL LIKE pattern to regex by tokenizing and escaping
      const pattern = convertLikeToRegex(value);
      return new RegExp(`^${pattern}$`, "i").test(fieldValue);
    case "contains":
      if (typeof fieldValue !== "string" || typeof value !== "string")
        return false;
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    default:
      return true;
  }
}

/**
 * Get a field value from a connection, handling nested paths
 * Since ConnectionEntity now uses snake_case matching the entity schema, no mapping needed
 */
function getFieldValue(
  connection: ConnectionEntity,
  fieldPath: string,
): unknown {
  const parts = fieldPath.split(".");
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
  connections: ConnectionEntity[],
  orderBy: OrderByExpression[],
): ConnectionEntity[] {
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

export const COLLECTION_CONNECTIONS_LIST = defineTool({
  name: "COLLECTION_CONNECTIONS_LIST",
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

    const connections = await ctx.storage.connections.list(organization.id);

    // Filter connections by binding if specified (tools are pre-populated at create/update time)
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

            return isValid ? connection : null;
          }),
        ).then((results) =>
          results.filter((c): c is ConnectionEntity => c !== null),
        )
      : connections;

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
      items: paginatedConnections,
      totalCount,
      hasMore,
    };
  },
});
