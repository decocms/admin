import { z } from "zod";

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
    .array(
      z.object({
        integrationId: z
          .string()
          .min(1)
          .describe(
            "The integration ID (format: i:<uuid>) that this tool depends on",
          ),
      }),
    )
    .optional()
    .describe(
      "List of integrations this tool depends on. These integrations must be installed and available for the tool to execute successfully. Use INTEGRATIONS_LIST to find available integration IDs.",
    ),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
