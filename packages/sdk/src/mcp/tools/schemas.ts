import { z } from "zod/v3";

/**
 * Shared Tool Dependency Schema
 *
 * This schema defines the structure for tool dependencies that can be used
 * by both tools and workflow code steps.
 */
export const ToolDependencySchema = z.object({
  integrationId: z
    .string()
    .min(1)
    .describe(
      "The integration ID (format: i:<uuid> or a:<uuid>) that this depends on",
    ),
  toolNames: z
    .array(z.string().min(1))
    .min(1)
    .describe("List of tool names from this integration that will be used."),
});

/**
 * Tool Definition Schema
 *
 * This schema defines the structure for tools using Resources 2.0
 * with standardized JSON Schema validation and inline code execution.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().describe("The name of the tool"),
  description: z.string().describe("The description of the tool"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the input of the tool"),
  outputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the output of the tool"),
  execute: z
    .string()
    .describe(
      "Inline ES module code with default export function. The code will be saved to /src/functions/{name}.ts",
    ),
  dependencies: z
    .array(ToolDependencySchema)
    .optional()
    .describe(
      "List of integration dependencies with specific tools. These integrations and their tools must be installed and available for the tool to execute successfully. Use READ_MCP to find available integration IDs and their tools.",
    ),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
