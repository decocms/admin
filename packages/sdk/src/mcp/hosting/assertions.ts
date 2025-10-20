/* oxlint-disable no-explicit-any */
import { MCPConnection } from "@deco/sdk";
import { AppContext } from "../context.ts";
import { listToolsByConnectionType } from "@deco/ai/mcp";
import { zodToJsonSchema } from "zod-to-json-schema";

interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

interface ToolLike {
  name: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}

class MCPBreakingChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MCPBreakingChangeError";
  }
}

/**
 * Converts a schema to JSON Schema format if it's a Zod schema
 */
function normalizeSchema(schema: any): JSONSchema | undefined {
  if (!schema) return undefined;

  // If it's a Zod schema (has _def property), convert it
  if (schema._def) {
    return zodToJsonSchema(schema) as JSONSchema;
  }

  // Otherwise assume it's already a JSON Schema
  return schema as JSONSchema;
}

/**
 * Checks if there are breaking changes between two sets of tools
 * Breaking changes include:
 * 1. Removing a tool
 * 2. Adding new required input properties
 * 3. Removing required output properties
 */
function checkForBreakingChanges(
  fromTools: ToolLike[],
  toTools: ToolLike[],
): void {
  // Create maps for easy lookup
  const toToolsMap = new Map(toTools.map((tool) => [tool.name, tool]));

  // Rule 1: Check for removed tools (breaking change)
  for (const fromTool of fromTools) {
    if (!toToolsMap.has(fromTool.name)) {
      throw new MCPBreakingChangeError(
        `Tool '${fromTool.name}' was removed. Removing tools is a breaking change.`,
      );
    }
  }

  // Check each existing tool for breaking changes
  for (const fromTool of fromTools) {
    const toTool = toToolsMap.get(fromTool.name)!;

    // Rule 3: Check for new required input properties (breaking change)
    checkInputSchemaBreakingChanges(fromTool, toTool);

    // Rule 5: Check for removed required output properties (breaking change)
    checkOutputSchemaBreakingChanges(fromTool, toTool);
  }
}

/**
 * Checks if two types are compatible (can be coerced)
 */
function areTypesCompatible(
  fromType: string | string[],
  toType: string | string[],
): boolean {
  // Normalize to arrays
  const fromTypes = Array.isArray(fromType) ? fromType : [fromType];
  const toTypes = Array.isArray(toType) ? toType : [toType];

  // Check if any of the "to" types are compatible with any of the "from" types
  for (const toT of toTypes) {
    for (const fromT of fromTypes) {
      if (fromT === toT) return true;

      // Some type coercions that are generally safe
      if (fromT === "string" && toT === "number") return true; // strings can often be parsed as numbers
      if (fromT === "number" && toT === "string") return true; // numbers can be stringified
      if (fromT === "integer" && toT === "number") return true; // integers are numbers
      if (fromT === "number" && toT === "integer") return false; // numbers can't always be integers (breaking)
    }
  }

  return false;
}

/**
 * Recursively checks schemas for breaking changes
 */
function checkSchemaBreakingChanges(
  fromSchema: JSONSchema,
  toSchema: JSONSchema,
  path: string,
  toolName: string,
  isInput: boolean,
): void {
  // Check required properties changes
  const fromRequired = new Set(fromSchema.required || []);
  const toRequired = new Set(toSchema.required || []);

  if (isInput) {
    // For input schemas: adding required properties is breaking
    for (const requiredProp of toRequired) {
      if (!fromRequired.has(requiredProp)) {
        throw new MCPBreakingChangeError(
          `Tool '${toolName}' added new required input property '${
            path ? path + "." : ""
          }${requiredProp}'. Adding required properties is a breaking change.`,
        );
      }
    }
  } else {
    // For output schemas: removing required properties is breaking
    for (const requiredProp of fromRequired) {
      if (!toRequired.has(requiredProp)) {
        throw new MCPBreakingChangeError(
          `Tool '${toolName}' removed required output property '${
            path ? path + "." : ""
          }${requiredProp}'. Removing required output properties is a breaking change.`,
        );
      }
    }
  }

  // Check for type changes in existing properties
  if (fromSchema.properties && toSchema.properties) {
    for (const [propName, fromProp] of Object.entries(fromSchema.properties)) {
      const toProp = toSchema.properties[propName];
      if (!toProp) continue; // Property removed, handled elsewhere

      const fromPropSchema = fromProp as JSONSchema;
      const toPropSchema = toProp as JSONSchema;

      // Check type compatibility
      if (fromPropSchema.type && toPropSchema.type) {
        if (!areTypesCompatible(fromPropSchema.type, toPropSchema.type)) {
          throw new MCPBreakingChangeError(
            `Tool '${toolName}' changed type of property '${
              path ? path + "." : ""
            }${propName}' from '${fromPropSchema.type}' to '${toPropSchema.type}'. Incompatible type changes are breaking.`,
          );
        }
      }

      // Recursively check nested object properties
      if (fromPropSchema.type === "object" && toPropSchema.type === "object") {
        if (fromPropSchema.properties || toPropSchema.properties) {
          checkSchemaBreakingChanges(
            fromPropSchema,
            toPropSchema,
            path ? `${path}.${propName}` : propName,
            toolName,
            isInput,
          );
        }
      }

      // Check array item schemas
      if (fromPropSchema.type === "array" && toPropSchema.type === "array") {
        if (fromPropSchema.items && toPropSchema.items) {
          const fromItems = fromPropSchema.items as JSONSchema;
          const toItems = toPropSchema.items as JSONSchema;

          // Check if array item types are compatible
          if (fromItems.type && toItems.type) {
            if (!areTypesCompatible(fromItems.type, toItems.type)) {
              throw new MCPBreakingChangeError(
                `Tool '${toolName}' changed array item type of property '${
                  path ? path + "." : ""
                }${propName}' from '${fromItems.type}' to '${toItems.type}'. Incompatible type changes are breaking.`,
              );
            }
          }

          // Recursively check nested array item objects
          if (fromItems.type === "object" && toItems.type === "object") {
            if (fromItems.properties || toItems.properties) {
              checkSchemaBreakingChanges(
                fromItems,
                toItems,
                path ? `${path}.${propName}[]` : `${propName}[]`,
                toolName,
                isInput,
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Checks if new required properties were added to input schema
 */
function checkInputSchemaBreakingChanges(
  fromTool: ToolLike,
  toTool: ToolLike,
): void {
  // Normalize schemas (convert from Zod if needed)
  const fromSchema = normalizeSchema(fromTool.inputSchema);
  const toSchema = normalizeSchema(toTool.inputSchema);

  // If either tool doesn't have an input schema, no breaking change
  if (!fromSchema || !toSchema) {
    return;
  }

  // Use the recursive schema checker for input schemas
  checkSchemaBreakingChanges(fromSchema, toSchema, "", fromTool.name, true);
}

/**
 * Checks if required properties were removed from output schema
 */
function checkOutputSchemaBreakingChanges(
  fromTool: ToolLike,
  toTool: ToolLike,
): void {
  // Normalize schemas (convert from Zod if needed)
  const fromSchema = normalizeSchema(fromTool.outputSchema);
  const toSchema = normalizeSchema(toTool.outputSchema);

  // Rule 6: Both outputSchemas can be optionally undefined, no issue
  if (!fromSchema && !toSchema) {
    return; // No breaking change
  }

  if (!fromSchema && toSchema) {
    return; // Adding output schema is not breaking
  }

  if (fromSchema && !toSchema) {
    return; // Removing output schema is not breaking (rule 6)
  }

  // Use the recursive schema checker for output schemas
  checkSchemaBreakingChanges(fromSchema!, toSchema!, "", fromTool.name, false);
}

/**
 * This function tries as a best effort to check for breaking changes.
 * It falls back to empty array if error as this check can be flaky.
 */
export const assertsNoMCPBreakingChanges = async (
  c: AppContext,
  {
    from,
    to,
  }: {
    from: MCPConnection;
    to: MCPConnection;
  },
) => {
  const [fromResult, toResult] = await Promise.all([
    listToolsByConnectionType(from, c, true).catch(() => ({ tools: [] })), // falling back to empty array if error as this check can be flaky
    listToolsByConnectionType(to, c, true).catch(() => ({ tools: [] })), // falling back to empty array if error as this check can be flaky
  ]);

  // Handle potential errors from tool fetching
  if (fromResult && "error" in fromResult) {
    throw new Error(
      `Failed to fetch tools from source connection: ${fromResult.error}`,
    );
  }

  if (toResult && "error" in toResult) {
    throw new Error(
      `Failed to fetch tools from target connection: ${toResult.error}`,
    );
  }

  const { tools: fromTools = [] }: { tools: ToolLike[] } = fromResult || {};
  const { tools: toTools = [] }: { tools: ToolLike[] } = toResult || {};

  // Check for breaking changes
  checkForBreakingChanges(fromTools, toTools);
};
