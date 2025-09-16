import z from "zod";

// Mapping step definition - transforms data between tool calls
export const MappingStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the mapping step within the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this mapping step does"),
  execute: z
    .string()
    .min(1)
    .describe(
      "ES module code that exports a default async function: (ctx: WellKnownOptions) => Promise<any>. Use ctx.readWorkflowInput() or ctx.readStepResult(stepName) to access data",
    ),
});

// Tool call step definition - executes a tool from an integration
export const ToolCallStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the tool call step within the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this tool call step does"),
  options: z
    .object({
      retry: z
        .number()
        .int()
        .min(0)
        .default(0)
        .optional()
        .describe("Number of retry attempts for this step (default: 0)"),
      timeout: z
        .number()
        .positive()
        .default(Infinity)
        .optional()
        .describe("Maximum execution time in milliseconds (default: Infinity)"),
    })
    .passthrough()
    .nullish()
    .describe(
      "Step configuration options. Extend this object with custom properties for business user configuration",
    ),
  tool_name: z.string().min(1).describe("The name of the tool to call"),
  integration: z
    .string()
    .min(1)
    .describe("The name of the integration that provides this tool"),
});

// Union of step types
export const WorkflowStepDefinitionSchema = z.object({
  type: z.enum(["mapping", "tool_call"]).describe("The type of step"),
  def: z
    .union([MappingStepDefinitionSchema, ToolCallStepDefinitionSchema])
    .describe("The step definition based on the type"),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).describe("The unique name of the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A comprehensive description of what this workflow accomplishes"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the workflow's input parameters and data structure",
    ),
  outputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the workflow's final output after all steps complete",
    ),
  steps: z
    .array(WorkflowStepDefinitionSchema)
    .min(1)
    .describe(
      "Array of workflow steps that execute sequentially. The last step should be a mapping step that returns the final output.",
    ),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
