/**
 * CONNECTION_DETECT_COLLECTIONS Tool
 *
 * Detects and validates collection bindings from a connection's tools.
 * This runs server-side to avoid browser compatibility issues with json-schema-diff.
 */

import { createBindingChecker } from "@decocms/bindings";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "@decocms/bindings/collections";
import { z } from "zod/v3";
import { defineTool } from "../../core/define-tool";

/**
 * Input schema for detecting collections
 */
const DetectCollectionsInputSchema = z.object({
  connectionId: z.string().describe("ID of the connection to analyze"),
});

/**
 * Output schema for detected collections
 */
const DetectCollectionsOutputSchema = z.object({
  collections: z
    .array(
      z.object({
        name: z.string().describe("Collection name (e.g., MODELS)"),
        displayName: z.string().describe("Human-readable name (e.g., Models)"),
      }),
    )
    .describe("List of validated collection bindings"),
});

/**
 * Formats a collection name for display
 * e.g., "MODELS" -> "Models", "USER_PROFILES" -> "User Profiles"
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

export const CONNECTION_DETECT_COLLECTIONS = defineTool({
  name: "CONNECTION_DETECT_COLLECTIONS",
  description:
    "Detects and validates collection bindings from a connection's tools",

  inputSchema: DetectCollectionsInputSchema,
  outputSchema: DetectCollectionsOutputSchema,

  handler: async (input, ctx) => {
    // Check authorization
    await ctx.access.check();

    // Get connection
    const connection = await ctx.storage.connections.findById(
      input.connectionId,
    );

    if (!connection) {
      return { collections: [] };
    }

    const tools = connection.tools ?? [];
    if (tools.length === 0) {
      return { collections: [] };
    }

    // Extract potential collection names
    const potentialCollections = extractCollectionNames(tools);

    if (potentialCollections.length === 0) {
      return { collections: [] };
    }

    // Validate each collection binding
    const validatedCollections: Array<{ name: string; displayName: string }> =
      [];

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
        // 4. This is a known limitation - proper fix belongs in @decocms/bindings
        const toolsForChecker = tools.map((t) => ({
          name: t.name,
          inputSchema: t.inputSchema as Record<string, unknown> | undefined,
          // outputSchema intentionally omitted for detection
        }));

        // Create binding without output schemas for the same reason
        const bindingForChecker = binding.map((b) => ({
          name: b.name,
          inputSchema: b.inputSchema,
          opt: b.opt,
        }));

        const checker = createBindingChecker(bindingForChecker);
        const isValid = await checker.isImplementedBy(toolsForChecker);

        if (isValid) {
          validatedCollections.push({
            name: collectionName,
            displayName: formatCollectionName(collectionName),
          });
        }
      } catch {
        // Skip collections that fail validation
      }
    }

    return { collections: validatedCollections };
  },
});
