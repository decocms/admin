/* oxlint-disable no-explicit-any */
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Maps Object.entries of tools to include the name as a property
 * This is a common pattern used when transforming tools for API responses
 * Also converts Zod schemas to JSON Schema format for CLI compatibility
 *
 * @param tools - Object with tool names as keys and tool objects as values
 * @returns Array of tools with name added to each tool object and schemas converted to JSON Schema
 */
export function mapToolEntries<T extends Record<string, any>>(
  tools: T,
): Array<T[keyof T] & { name: string }> {
  return Object.entries(tools).map(([name, tool]) => {
    const convertedTool = { ...tool };

    // Convert inputSchema from Zod to JSON Schema if it's a Zod schema
    if (tool.inputSchema?._def) {
      convertedTool.inputSchema = zodToJsonSchema(tool.inputSchema);
    }

    // Convert outputSchema from Zod to JSON Schema if it's a Zod schema
    if (tool.outputSchema?._def) {
      convertedTool.outputSchema = zodToJsonSchema(tool.outputSchema);
    }

    return {
      ...convertedTool,
      name,
    };
  });
}
