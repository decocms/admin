import { useMemo } from "react";
import { type Binder, createBindingChecker } from "@decocms/bindings";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "@decocms/bindings/collections";
import { AGENTS_BINDING } from "@decocms/bindings/agent";
import { LANGUAGE_MODEL_BINDING } from "@decocms/bindings/llm";
import type { ConnectionEntity } from "@/tools/connection/schema";

/**
 * Map of well-known binding names to their definitions
 */
const BUILTIN_BINDINGS: Record<string, Binder> = {
  LLMS: LANGUAGE_MODEL_BINDING,
  AGENTS: AGENTS_BINDING,
};

/**
 * Checks if a connection implements a binding by validating its tools
 */
function connectionImplementsBinding(
  connection: ConnectionEntity,
  binding: Binder,
): boolean {
  const tools = connection.tools;

  if (!tools || tools.length === 0) {
    return false;
  }

  // Prepare tools for checker (only input schema, skip output for detection)
  const toolsForChecker = tools.map((t) => ({
    name: t.name,
    inputSchema: t.inputSchema as Record<string, unknown> | undefined,
  }));

  // Create binding checker without output schemas
  const bindingForChecker = binding.map((b) => ({
    name: b.name,
    inputSchema: b.inputSchema,
    opt: b.opt,
  }));

  const checker = createBindingChecker(bindingForChecker);
  const result = checker.isImplementedBy(toolsForChecker);

  return result;
}

/**
 * Hook to filter connections that implement a specific binding.
 * Returns only connections whose tools satisfy the binding requirements.
 *
 * @param connections - Array of connections to filter
 * @param bindingName - Name of the binding to check ("LLMS" | "AGENTS")
 * @returns Filtered array of connections that implement the binding
 */
export function useBindingConnections(
  connections: ConnectionEntity[] | undefined,
  bindingName: string,
): ConnectionEntity[] {
  const binding = BUILTIN_BINDINGS[bindingName];

  return useMemo(
    () =>
      !connections || !binding
        ? []
        : connections.filter((conn) =>
            connectionImplementsBinding(conn, binding),
          ),
    [connections, binding],
  );
}

/**
 * Validated collection binding
 */
export interface ValidatedCollection {
  name: string;
  displayName: string;
  schema?: Record<string, unknown>;
}

/**
 * Formats a collection name for display
 * e.g., "LLM" -> "Llm", "USER_PROFILES" -> "User Profiles"
 */
function formatCollectionName(name: string): string {
  return name
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extracts collection names from tools using regex pattern
 * Matches COLLECTION_{NAME}_LIST where NAME can contain underscores
 */
function extractCollectionNames(
  tools: Array<{ name: string }> | null | undefined,
): string[] {
  if (!tools || tools.length === 0) return [];

  const collectionRegex = /^COLLECTION_(.+)_LIST$/;
  const names: string[] = [];

  for (const tool of tools) {
    const match = tool.name.match(collectionRegex);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return names;
}

/**
 * Extracts collection schema from tools
 */
function extractCollectionSchema(
  tools: Array<{
    name: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }>,
  collectionName: string,
): Record<string, unknown> | undefined {
  // Try to get schema from CREATE tool (preferred as it has full entity)
  const createTool = tools.find(
    (t) => t.name === `COLLECTION_${collectionName}_CREATE`,
  );
  if (
    hasProperties(createTool?.inputSchema) &&
    createTool.inputSchema.properties.data
  ) {
    return createTool.inputSchema.properties.data as Record<string, unknown>;
  }

  // Try to get schema from UPDATE tool
  const updateTool = tools.find(
    (t) => t.name === `COLLECTION_${collectionName}_UPDATE`,
  );
  if (
    hasProperties(updateTool?.inputSchema) &&
    updateTool.inputSchema.properties.data
  ) {
    // Update usually has partial data, but might still be useful
    return updateTool.inputSchema.properties.data as Record<string, unknown>;
  }

  // Try to get schema from LIST tool (output)
  const listTool = tools.find(
    (t) => t.name === `COLLECTION_${collectionName}_LIST`,
  );
  if (
    hasProperties(listTool?.outputSchema) &&
    listTool.outputSchema.properties.items
  ) {
    const itemsSchema = listTool.outputSchema.properties.items as Record<
      string,
      unknown
    >;
    if (itemsSchema.items) {
      return itemsSchema.items as Record<string, unknown>;
    }
  }

  return undefined;
}

/**
 * Detects and validates collection bindings from tools
 */
function detectCollections(
  tools: Array<{
    name: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }> | null,
): ValidatedCollection[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  const potentialCollections = extractCollectionNames(tools);

  if (potentialCollections.length === 0) {
    return [];
  }

  const validatedCollections: ValidatedCollection[] = [];

  for (const collectionName of potentialCollections) {
    try {
      // Create a minimal collection binding to check against (read-only)
      const binding = createCollectionBindings(
        collectionName.toLowerCase(),
        BaseCollectionEntitySchema,
        { readOnly: true },
      );

      // For collection detection, we only validate input schema compatibility.
      // Output schema validation is skipped because:
      // 1. The binding uses BaseCollectionEntitySchema with minimal required fields
      // 2. Actual collections have additional required fields (description, instructions, etc.)
      // 3. json-schema-diff sees extra required fields as "removals" (stricter schema)
      const toolsForChecker = tools.map((t) => ({
        name: t.name,
        inputSchema: t.inputSchema,
        // outputSchema intentionally omitted for detection
      }));

      // Create binding without output schemas for the same reason
      const bindingForChecker = binding.map((b) => ({
        name: b.name,
        inputSchema: b.inputSchema,
      }));

      const checker = createBindingChecker(bindingForChecker);
      const isValid = checker.isImplementedBy(toolsForChecker);

      if (isValid) {
        validatedCollections.push({
          name: collectionName,
          displayName: formatCollectionName(collectionName),
          schema: extractCollectionSchema(tools, collectionName),
        });
      }
    } catch {
      // Skip collections that fail validation
    }
  }

  return validatedCollections;
}

/**
 * Hook to detect and validate collection bindings from connection tools
 * Runs entirely client-side using the connection's tools array
 *
 * @param connection - The connection entity to analyze
 * @returns Array of validated collections
 */
export function useCollectionBindings(
  connection: ConnectionEntity | undefined,
): ValidatedCollection[] {
  return useMemo(
    () => detectCollections(connection?.tools ?? null),
    [connection?.tools],
  );
}

function hasProperties(
  schema: Record<string, unknown> | undefined,
): schema is { properties: Record<string, unknown> } {
  return (
    schema !== undefined &&
    typeof schema === "object" &&
    "properties" in schema &&
    typeof schema.properties === "object" &&
    schema.properties !== null
  );
}
