import z from "zod";

// Code step definition - transforms data between tool calls
export const CodeStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the code step within the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this code step does"),
  execute: z
    .string()
    .min(1)
    .describe(
      "ES module code that exports a default async function: (ctx: WellKnownOptions) => Promise<any>. Use ctx.readWorkflowInput() or ctx.readStepResult(stepName) to access data",
    ),
  dependencies: z
    .array(
      z.object({
        integrationId: z
          .string()
          .min(1)
          .describe(
            "The integration ID (format: i:<uuid> or a:<uuid>) that this code step depends on",
          ),
      }),
    )
    .optional()
    .describe(
      "List of integrations this code step calls via ctx.env['{INTEGRATION_ID}'].{TOOL_NAME}(). These integrations must be installed and available for the step to execute successfully. Use INTEGRATIONS_LIST to find available integration IDs.",
    ),
});

export const RetriesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of retry attempts for this step (default: 0)"),
  delay: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Delay in milliseconds between retry attempts (default: 0)"),
  backoff: z
    .enum(["constant", "linear", "exponential"])
    .optional()
    .describe("Backoff strategy for retry attempts (default: constant)"),
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
      retries: RetriesSchema.optional(),
      timeout: z
        .number()
        .positive()
        .default(Infinity)
        .optional()
        .describe("Maximum execution time in milliseconds (default: Infinity)"),
    })
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
  type: z.enum(["code", "tool_call"]).describe("The type of step"),
  def: z
    .union([CodeStepDefinitionSchema, ToolCallStepDefinitionSchema])
    .describe("The step definition based on the type"),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).describe("The unique name of the workflow"),
  description: z
    .string()
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
      "Array of workflow steps that execute sequentially. The last step should be a code step that returns the final output.",
    ),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// Additional types for compatibility with hooks
export type Workflow = WorkflowDefinition;
export type WorkflowStep = z.infer<typeof WorkflowStepDefinitionSchema>;

// Tool reference type for workflow steps
export interface ToolReference {
  integrationId: string; // Clean ID without prefix
  toolName: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  description?: string;
}

// Step execution result
export interface StepExecutionResult {
  executedAt: string; // ISO date
  value: unknown; // Result data
  error?: string; // Error message if failed
  duration?: number; // Execution time in ms
}

// JSON Schema type
export type JSONSchema = Record<string, unknown>;

// Workflow run data schema for Resources 2.0
export const WorkflowRunDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.string(),
  runId: z.string(),
  workflowURI: z.string().optional(),
  // Processed status fields (computed from workflowStatus)
  currentStep: z
    .string()
    .optional()
    .describe("The name of the step currently being executed (if running)"),
  stepResults: z
    .record(z.any())
    .optional()
    .describe("Results from completed steps"),
  finalResult: z
    .any()
    .optional()
    .describe("The final workflow result (if completed)"),
  partialResult: z
    .any()
    .optional()
    .describe("Partial results from completed steps (if pending/running)"),
  error: z.string().optional().describe("Error message if the workflow failed"),
  logs: z
    .array(
      z.object({
        type: z.enum(["log", "warn", "error"]),
        content: z.string(),
      }),
    )
    .optional()
    .describe("Console logs from the execution"),
  startTime: z
    .number()
    .optional()
    .describe("When the workflow started (timestamp)"),
  endTime: z
    .number()
    .optional()
    .describe("When the workflow ended (timestamp, if completed/failed)"),
  // Raw workflow status from Cloudflare - frontend handles all transformations
  workflowStatus: z
    .object({
      params: z
        .object({
          input: z.any().optional(),
          steps: z.array(z.any()).optional(),
          name: z.string().optional(),
          context: z
            .object({
              workspace: z.any().optional(),
              locator: z.any().optional(),
              workflowURI: z.string().optional(),
              startedBy: z
                .object({
                  id: z.string(),
                  email: z.string().optional(),
                  name: z.string().optional(),
                })
                .optional(),
              startedAt: z.string().optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      trigger: z.object({ source: z.string() }).passthrough().optional(),
      versionId: z.string().optional(),
      queued: z.string().optional(),
      start: z.string().nullable().optional(),
      end: z.string().nullable().optional(),
      success: z.boolean().nullable().optional(),
      steps: z
        .array(
          z
            .object({
              name: z.string().optional(),
              type: z.string().optional(),
              start: z.string().nullable().optional(),
              end: z.string().nullable().optional(),
              success: z.boolean().nullable().optional(),
              output: z.any().optional(),
              error: z
                .object({
                  name: z.string().optional(),
                  message: z.string().optional(),
                })
                .nullable()
                .optional(),
              attempts: z
                .array(
                  z.object({
                    start: z.string().optional(),
                    end: z.string().optional(),
                    success: z.boolean().optional(),
                    error: z
                      .object({
                        name: z.string().optional(),
                        message: z.string().optional(),
                      })
                      .nullable()
                      .optional(),
                  }),
                )
                .optional(),
              config: z.any().optional(),
            })
            .passthrough(),
        )
        .optional(),
      error: z
        .object({
          name: z.string().optional(),
          message: z.string().optional(),
        })
        .nullable()
        .optional(),
      output: z.any().optional(),
      status: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
