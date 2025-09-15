import { callFunction, inspect } from "@deco/cf-sandbox";
import z from "zod";
import {
  assertWorkspaceResourceAccess,
  MCPClient,
  ProjectTools,
} from "../index.ts";
import { MCPClientStub } from "../stub.ts";
import {
  asEnv,
  createTool,
  evalCodeAndReturnDefaultHandle,
  fileNameSlugify,
  processExecuteCode,
  validate,
  validateExecuteCode,
} from "./utils.ts";

// In-memory storage for workflow runs
interface WorkflowRun {
  id: string;
  workflowName: string;
  input: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  currentStep?: string;
  stepResults: Record<string, unknown>;
  finalResult?: unknown;
  error?: string;
  logs: Array<{ type: "log" | "warn" | "error"; content: string }>;
  startTime: number;
  endTime?: number;
}

const workflowRuns = new Map<string, WorkflowRun>();

/**
 * Generates a unique run ID
 */
function generateRunId(): string {
  return crypto.randomUUID();
}

/**
 * Clean up old workflow runs to prevent memory leaks
 * Removes runs older than the specified age (default: 1 hour)
 */
function cleanupOldRuns(maxAgeMs: number = 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [runId, run] of workflowRuns.entries()) {
    if (now - run.startTime > maxAgeMs) {
      workflowRuns.delete(runId);
    }
  }
}

/**
 * Reusable workflow execution function that runs in the background
 */
async function executeWorkflow(
  runId: string,
  workflowName: string,
  input: Record<string, unknown>,
  client: MCPClientStub<ProjectTools>,
  branch?: string,
  startFromStep?: string,
): Promise<void> {
  const run = workflowRuns.get(runId);
  if (!run) return;

  try {
    run.status = "running";

    // Read the workflow definition
    const workflow = await readWorkflow(workflowName, client, branch);
    if (!workflow) {
      run.status = "failed";
      run.error = "Workflow not found";
      return;
    }

    // Validate input against the workflow's input schema
    const inputValidation = validate(input, workflow.inputSchema);
    if (!inputValidation.valid) {
      run.status = "failed";
      run.error = `Input validation failed: ${inspect(inputValidation)}`;
      return;
    }

    const envPromise = asEnv(client);
    const runtimeId = "default"; // You might want to make this configurable

    // Determine starting step index
    let startStepIndex = 0;
    if (startFromStep) {
      startStepIndex = workflow.steps.findIndex(
        (stepName) => stepName === startFromStep,
      );
      if (startStepIndex === -1) {
        run.status = "failed";
        run.error = `Starting step '${startFromStep}' not found in workflow`;
        return;
      }
    }

    // Execute steps sequentially starting from the specified step
    for (let i = startStepIndex; i < workflow.steps.length; i++) {
      const stepName = workflow.steps[i];
      run.currentStep = stepName;

      // Find the step definition in mappings or tools
      const mappingStep = workflow.mappings.find(m => m.name === stepName);
      const toolStep = workflow.tools.find(t => t.name === stepName);

      if (!mappingStep && !toolStep) {
        run.status = "failed";
        run.error = `Step '${stepName}' not found in mappings or tools`;
        return;
      }

      try {
        let stepResult: unknown;

        if (mappingStep) {
          // Execute mapping step
          using stepEvaluation = await evalCodeAndReturnDefaultHandle(
            mappingStep.execute,
            runtimeId,
          );
          const {
            ctx: stepCtx,
            defaultHandle: stepDefaultHandle,
            guestConsole: stepConsole,
          } = stepEvaluation;

          // Create step context with WellKnownOptions
          const stepContext = {
            readWorkflowInput() {
              return input;
            },
            readStepResult(stepName: string) {
              if (!run.stepResults[stepName]) {
                throw new Error(`Step '${stepName}' has not been executed yet`);
              }
              return run.stepResults[stepName];
            },
            env: await envPromise,
          };

          // Call the mapping function
          const stepCallHandle = await callFunction(
            stepCtx,
            stepDefaultHandle,
            undefined,
            stepContext,
            {},
          );

          stepResult = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));
          run.logs.push(...stepConsole.logs);
        } else if (toolStep) {
          // Execute tool call step
          // Find the integration connection
          const { items: integrations } = await client.INTEGRATIONS_LIST({});
          const integration = integrations.find((item) =>
            item.id === toolStep.integration
          );

          if (!integration) {
            throw new Error(`Integration '${toolStep.integration}' not found`);
          }

          const toolCallResult = await client.INTEGRATIONS_CALL_TOOL({
            connection: integration.connection,
            params: {
              name: toolStep.tool_name,
              arguments: input,
            },
          });

          if (toolCallResult.isError) {
            throw new Error(`Tool call failed: ${inspect(toolCallResult)}`);
          }

          stepResult = toolCallResult.structuredContent ||
            toolCallResult.content;
          run.logs.push({
            type: "log",
            content: `Tool call '${toolStep.tool_name}' completed`,
          });
        }

        // Store the step result
        run.stepResults[stepName] = stepResult;
      } catch (error) {
        run.status = "failed";
        run.error = `Step '${stepName}' execution failed: ${inspect(error)}`;
        return;
      }
    }

    // The final result is the output of the last step
    const lastStepName = workflow.steps[workflow.steps.length - 1];
    const finalResult = run.stepResults[lastStepName];

    if (!finalResult) {
      run.status = "failed";
      run.error = "No result from the last step";
      return;
    }

    // Validate workflow output against the workflow's output schema
    const workflowOutputValidation = validate(
      finalResult,
      workflow.outputSchema,
    );
    if (!workflowOutputValidation.valid) {
      run.status = "failed";
      run.error = `Workflow output validation failed: ${
        inspect(
          workflowOutputValidation,
        )
      }`;
      return;
    }

    run.finalResult = finalResult;
    run.status = "completed";
    run.endTime = Date.now();
  } catch (error) {
    run.status = "failed";
    run.error = `Workflow runner failed: ${inspect(error)}`;
    run.endTime = Date.now();
  }
}

/**
 * Reads a workflow definition from the workspace and inlines all function code
 * @param name - The name of the workflow
 * @param client - The MCP client
 * @param branch - The branch to read from
 * @returns The workflow definition with inlined function code or null if not found
 */
async function readWorkflow(
  name: string,
  client: MCPClientStub<ProjectTools>,
  branch?: string,
): Promise<z.infer<typeof WorkflowDefinitionSchema> | null> {
  try {
    const workflowFileName = fileNameSlugify(name);
    const workflowPath = `/src/workflows/${workflowFileName}.json`;

    const result = await client.READ_FILE({
      branch,
      path: workflowPath,
      format: "json",
    });

    const workflow = result.content as z.infer<typeof WorkflowDefinitionSchema>;

    // Inline mapping function code
    const inlinedMappings = await Promise.all(
      workflow.mappings.map(async (mapping) => {
        const stepFunctionPath = mapping.execute.replace("file://", "");
        const stepFunctionResult = await client.READ_FILE({
          branch,
          path: stepFunctionPath,
          format: "plainString",
        });

        return {
          name: mapping.name,
          description: mapping.description,
          execute: stepFunctionResult.content, // Inline the code in the execute field
        };
      }),
    );

    return {
      name: workflow.name,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      mappings: inlinedMappings,
      tools: workflow.tools, // Tools don't need inlining
      steps: workflow.steps, // Steps are just names
    };
  } catch {
    return null;
  }
}

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
        .describe("Number of retry attempts for this step (default: 0)"),
      timeout: z
        .number()
        .positive()
        .default(Infinity)
        .describe("Maximum execution time in milliseconds (default: Infinity)"),
    })
    .passthrough()
    .nullish()
    .describe(
      "Step configuration options. Extend this object with custom properties for business user configuration",
    ),
  tool_name: z
    .string()
    .min(1)
    .describe("The name of the tool to call"),
  integration: z
    .string()
    .min(1)
    .describe("The name of the integration that provides this tool"),
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
  mappings: z
    .array(MappingStepDefinitionSchema)
    .describe("Array of mapping step definitions"),
  tools: z
    .array(ToolCallStepDefinitionSchema)
    .describe("Array of tool call step definitions"),
  steps: z
    .array(z.string())
    .min(1)
    .describe(
      "Array of step names that define the execution order. Names must reference mappings or tools defined above. The last step should be a mapping that returns the final output.",
    ),
});

const WORKFLOW_DESCRIPTION =
  `Create or update a workflow in the sandbox environment.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Mappings**: Array of mapping step definitions that transform data
- **Tools**: Array of tool call step definitions that execute external tools
- **Steps**: Array of step names that define the execution order

The workflow's final output is determined by the last step in the sequence, which should be a mapping step that aggregates and returns the desired result.

## Workflow Structure

Workflows are organized into three main sections:

### 1. Mappings
Array of mapping step definitions that transform data:
- **name**: Unique identifier for the mapping
- **description**: Clear explanation of the mapping's purpose
- **execute**: ES module code with a default async function

### 2. Tools
Array of tool call step definitions that execute external tools:
- **name**: Unique identifier for the tool call
- **description**: Clear explanation of the tool call's purpose
- **options**: Configuration with retry/timeout settings and custom properties
- **tool_name**: The name of the tool to call
- **integration**: The name of the integration that provides this tool

### 3. Steps
Array of step names that define the execution order. Names must reference mappings or tools defined above.

### Mapping Step Execution Function
Each mapping step's execute function follows this pattern:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains WellKnownOptions helper functions:
  // - await ctx.readWorkflowInput(): Returns the initial workflow input
  // - await ctx.readStepResult(stepName): Returns output from a previous step
  
  // Transform data between tool calls
  const input = await ctx.readWorkflowInput();
  const previousResult = await ctx.readStepResult('previous-step');
  
  // Your mapping logic here
  return transformedData;
}
\`\`\`

## Final Output

The workflow's final output is automatically determined by the last step in the sequence. This should be a mapping step that:

1. Aggregates data from previous steps using ctx.readStepResult(stepName)
2. Transforms the data to match the workflow's output schema
3. Returns the final result

The last mapping step effectively replaces the need for a separate workflow execute function.

## Examples

### Example 1: Data Processing Workflow
\`\`\`json
{
  "name": "process-user-data",
  "description": "Validates, enriches, and stores user data",
  "inputSchema": {
    "type": "object",
    "properties": {
      "email": { "type": "string", "format": "email" },
      "name": { "type": "string" }
    },
    "required": ["email", "name"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" },
      "status": { "type": "string", "enum": ["created", "updated"] }
    }
  },
  "mappings": [
    {
      "name": "validate-input",
      "description": "Validates user input data",
      "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { isValid: input.email.includes('@'), errors: [] }; }"
    },
    {
      "name": "finalize-result",
      "description": "Aggregates and returns the final workflow result",
      "execute": "export default async function(ctx) { const storedUser = await ctx.readStepResult('store-user'); return { userId: storedUser.id, status: 'created' }; }"
    }
  ],
  "tools": [
    {
      "name": "store-user",
      "description": "Stores user data in database",
      "options": {
        "retry": 2,
        "timeout": 5000
      },
      "tool_name": "create_user",
      "integration": "database"
    }
  ],
  "steps": ["validate-input", "store-user", "finalize-result"]
}
\`\`\`

### Example 2: AI Content Generation Workflow
\`\`\`json
{
  "name": "generate-content",
  "description": "Generates and reviews AI content",
  "inputSchema": {
    "type": "object",
    "properties": {
      "topic": { "type": "string" },
      "tone": { "type": "string", "enum": ["formal", "casual", "technical"] }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string" },
      "quality": { "type": "number", "minimum": 0, "maximum": 10 }
    }
  },
  "mappings": [
    {
      "name": "prepare-prompt",
      "description": "Prepares the AI prompt from input",
      "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { prompt: \`Write about \${input.topic} in a \${input.tone} tone\` }; }"
    },
    {
      "name": "finalize-content",
      "description": "Aggregates and returns the final content result",
      "execute": "export default async function(ctx) { const draft = await ctx.readStepResult('generate-draft'); return { content: draft.content, quality: 8 }; }"
    }
  ],
  "tools": [
    {
      "name": "generate-draft",
      "description": "Creates initial content draft using AI",
      "options": {
        "retry": 1,
        "timeout": 30000,
        "temperature": 0.7,
        "maxTokens": 1000
      },
      "tool_name": "generate_text",
      "integration": "openai"
    }
  ],
  "steps": ["prepare-prompt", "generate-draft", "finalize-content"]
}
\`\`\`

## Best Practices

1. **Organized Structure**: Define mappings and tools separately, then reference them in the steps array
2. **Final Mapping Step**: Always end with a mapping step that aggregates and returns the final result
3. **Input Transformation**: Use mapping steps before tool calls to transform workflow input as needed
4. **Minimal Output**: Keep mapping step outputs minimal to improve performance
5. **Error Handling**: Use retry and timeout configurations appropriately for tool calls
6. **Schema Validation**: Define clear input/output schemas for type safety
7. **Step Independence**: Design steps to be testable in isolation
8. **Business Configuration**: Use options to expose tunable parameters for tool calls
9. **Sequential Execution**: Steps run in order - design accordingly
10. **Data Flow**: Use mappers to transform data between tool calls
11. **Step References**: Ensure all step names in the steps array reference existing mappings or tools

## WellKnownOptions Interface

The context object in mapping step execute functions includes:

\`\`\`typescript
interface WellKnownOptions {
  readWorkflowInput(): Promise<WorkflowInputSchema>;
  readStepResult(stepName: string): Promise<StepOutputSchema>;
}
\`\`\`

Use these helper functions to access workflow input and previous step results within your mapping step execute functions.

`;

const upsertWorkflow = createTool({
  name: "SANDBOX_UPSERT_WORKFLOW",
  description: WORKFLOW_DESCRIPTION,
  inputSchema: WorkflowDefinitionSchema,
  outputSchema: z.object({
    success: z
      .boolean()
      .describe("Whether the workflow was created successfully"),
    error: z
      .string()
      .optional()
      .describe("Compilation or validation error if any"),
  }),
  handler: async (
    { name, description, inputSchema, outputSchema, mappings, tools, steps },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);
    const filename = fileNameSlugify(name);

    try {
      // Process each mapping and save their execute functions
      const processedMappings = [];

      for (const mapping of mappings) {
        const stepName = fileNameSlugify(mapping.name);
        const stepFilePath = `/src/functions/${filename}.${stepName}.ts`;

        // Process the mapping execute code
        const { functionCode, functionPath } = await processExecuteCode(
          mapping.execute,
          stepFilePath,
          client,
          branch,
        );

        // Validate the mapping function code
        const validation = await validateExecuteCode(
          functionCode,
          runtimeId,
          `Mapping ${mapping.name}`,
        );

        if (!validation.success) {
          return {
            success: false,
            error: validation.error,
          };
        }

        // Add the processed mapping with file reference
        processedMappings.push({
          name: mapping.name,
          description: mapping.description,
          execute: `file://${functionPath}`,
        });
      }

      // Validate that all step names reference existing mappings or tools
      const allStepNames = new Set([
        ...mappings.map(m => m.name),
        ...tools.map(t => t.name)
      ]);

      for (const stepName of steps) {
        if (!allStepNames.has(stepName)) {
          return {
            success: false,
            error: `Step '${stepName}' not found in mappings or tools`,
          };
        }
      }

      // Store the workflow metadata
      const workflowPath = `/src/workflows/${filename}.json`;

      const workflowData = {
        name,
        description,
        inputSchema,
        outputSchema,
        mappings: processedMappings,
        tools, // Tools don't need processing
        steps, // Steps are just names
      };

      await client.PUT_FILE({
        branch,
        path: workflowPath,
        content: JSON.stringify(workflowData, null, 2),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: inspect(error),
      };
    }
  },
});

const startWorkflow = createTool({
  name: "SANDBOX_START_WORKFLOW",
  description:
    "Start a workflow execution asynchronously in the sandbox environment",
  inputSchema: z.object({
    name: z.string().describe("The name of the workflow to run"),
    input: z
      .object({})
      .passthrough()
      .describe("The input data for the workflow"),
  }),
  outputSchema: z.object({
    runId: z.string().describe("The unique ID for tracking this workflow run"),
    error: z
      .string()
      .optional()
      .describe("Error message if workflow start failed"),
  }),
  handler: async ({ name, input }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    try {
      // Read the workflow definition to validate it exists
      const workflow = await readWorkflow(name, client, branch);
      if (!workflow) {
        return { runId: "", error: "Workflow not found" };
      }

      // Validate input against the workflow's input schema
      const inputValidation = validate(input, workflow.inputSchema);
      if (!inputValidation.valid) {
        return {
          runId: "",
          error: `Input validation failed: ${inspect(inputValidation)}`,
        };
      }

      // Clean up old runs periodically
      cleanupOldRuns();

      // Generate a unique run ID
      const runId = generateRunId();

      // Create the workflow run record
      const workflowRun: WorkflowRun = {
        id: runId,
        workflowName: name,
        input,
        status: "pending",
        stepResults: {},
        logs: [],
        startTime: Date.now(),
      };

      // Store the run in memory
      workflowRuns.set(runId, workflowRun);

      // Start the workflow execution in the background (non-blocking)
      executeWorkflow(runId, name, input, client, branch).catch((error) => {
        // Handle any uncaught errors in background execution
        const run = workflowRuns.get(runId);
        if (run) {
          run.status = "failed";
          run.error = `Background execution error: ${inspect(error)}`;
          run.endTime = Date.now();
        }
      });

      return { runId };
    } catch (error) {
      return {
        runId: "",
        error: `Workflow start failed: ${inspect(error)}`,
      };
    }
  },
});

const getWorkflowStatus = createTool({
  name: "SANDBOX_GET_WORKFLOW_STATUS",
  description: "Get the status and output of a workflow run",
  inputSchema: z.object({
    runId: z.string().describe("The unique ID of the workflow run"),
  }),
  outputSchema: z.object({
    status: z
      .enum(["pending", "running", "completed", "failed"])
      .describe("The current status of the workflow run"),
    currentStep: z
      .string()
      .optional()
      .describe("The name of the step currently being executed (if running)"),
    stepResults: z.record(z.any()).describe("Results from completed steps"),
    finalResult: z
      .any()
      .optional()
      .describe("The final workflow result (if completed)"),
    partialResult: z
      .any()
      .optional()
      .describe("Partial results from completed steps (if pending/running)"),
    error: z
      .string()
      .optional()
      .describe("Error message if the workflow failed"),
    logs: z
      .array(
        z.object({
          type: z.enum(["log", "warn", "error"]),
          content: z.string(),
        }),
      )
      .describe("Console logs from the execution"),
    startTime: z.number().describe("When the workflow started (timestamp)"),
    endTime: z
      .number()
      .optional()
      .describe("When the workflow ended (timestamp, if completed/failed)"),
  }),
  handler: async ({ runId }, c) => {
    await assertWorkspaceResourceAccess(c);

    const run = workflowRuns.get(runId);
    if (!run) {
      throw new Error(`Workflow run '${runId}' not found`);
    }

    // Create partial result from completed steps
    const partialResult = Object.keys(run.stepResults).length > 0
      ? {
        completedSteps: Object.keys(run.stepResults),
        stepResults: run.stepResults,
      }
      : undefined;

    return {
      status: run.status,
      currentStep: run.currentStep,
      stepResults: run.stepResults,
      finalResult: run.finalResult,
      partialResult,
      error: run.error,
      logs: run.logs,
      startTime: run.startTime,
      endTime: run.endTime,
    };
  },
});

const replayWorkflowFromStep = createTool({
  name: "SANDBOX_REPLAY_WORKFLOW_FROM_STEP",
  description:
    "Replay a workflow from a specific step using the results from a previous run",
  inputSchema: z.object({
    runId: z
      .string()
      .describe("The unique ID of the original workflow run to replay from"),
    stepName: z
      .string()
      .describe("The name of the step to start replaying from"),
  }),
  outputSchema: z.object({
    newRunId: z
      .string()
      .describe("The unique ID for tracking this replayed workflow run"),
    error: z
      .string()
      .optional()
      .describe("Error message if replay start failed"),
  }),
  handler: async ({ runId, stepName }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    try {
      // Get the original run
      const originalRun = workflowRuns.get(runId);
      if (!originalRun) {
        return {
          newRunId: "",
          error: `Original workflow run '${runId}' not found`,
        };
      }

      // Validate that the step exists in the original run's step results
      if (!originalRun.stepResults[stepName]) {
        return {
          newRunId: "",
          error:
            `Step '${stepName}' was not completed in the original run or does not exist`,
        };
      }

      // Generate a new unique run ID for the replay
      const newRunId = generateRunId();

      // Create the new workflow run record with existing step results
      const replayedWorkflowRun: WorkflowRun = {
        id: newRunId,
        workflowName: originalRun.workflowName,
        input: originalRun.input,
        status: "pending",
        stepResults: { ...originalRun.stepResults }, // Copy existing step results
        logs: [...originalRun.logs], // Copy existing logs
        startTime: Date.now(),
      };

      // Store the new run in memory
      workflowRuns.set(newRunId, replayedWorkflowRun);

      // Start the workflow execution in the background from the specified step
      executeWorkflow(
        newRunId,
        originalRun.workflowName,
        originalRun.input,
        client,
        branch,
        stepName,
      ).catch((error) => {
        // Handle any uncaught errors in background execution
        const run = workflowRuns.get(newRunId);
        if (run) {
          run.status = "failed";
          run.error = `Background replay execution error: ${inspect(error)}`;
          run.endTime = Date.now();
        }
      });

      return { newRunId };
    } catch (error) {
      return {
        newRunId: "",
        error: `Workflow replay start failed: ${inspect(error)}`,
      };
    }
  },
});

const getWorkflow = createTool({
  name: "SANDBOX_GET_WORKFLOW",
  description: "Get a workflow from the sandbox",
  inputSchema: z.object({
    name: z.string().describe("The name of the workflow"),
  }),
  outputSchema: z.object({
    workflow: WorkflowDefinitionSchema.nullable().describe(
      "The workflow definition. Null if not found",
    ),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    const workflow = await readWorkflow(name, client, branch);

    return { workflow: workflow ?? null };
  },
});

const deleteWorkflow = createTool({
  name: "SANDBOX_DELETE_WORKFLOW",
  description: "Delete a workflow in the sandbox",
  inputSchema: z.object({
    name: z.string().describe("The name of the workflow"),
  }),
  outputSchema: z.object({
    message: z.string().describe("The message of the workflow"),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const workflowFileName = fileNameSlugify(name);
      const workflowPath = `/src/workflows/${workflowFileName}.json`;

      const client = MCPClient.forContext(c);

      await client.DELETE_FILE({
        branch,
        path: workflowPath,
      });

      return { message: "Workflow deleted successfully" };
    } catch {
      return { message: "Workflow deletion failed" };
    }
  },
});

const listWorkflows = createTool({
  name: "SANDBOX_LIST_WORKFLOWS",
  description: "List all workflows in the sandbox",
  inputSchema: z.object({}),
  outputSchema: z.object({ workflows: z.array(WorkflowDefinitionSchema) }),
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const client = MCPClient.forContext(c);
      const result = await client.LIST_FILES({
        branch,
        prefix: "/src/workflows/",
      });

      const workflows: z.infer<typeof WorkflowDefinitionSchema>[] = [];

      for (const filePath of Object.keys(result.files)) {
        if (filePath.endsWith(".json")) {
          // Extract workflow name from file path (e.g., "/src/workflows/process-user-data.json" -> "process-user-data")
          const workflowName = filePath
            .replace("/src/workflows/", "")
            .replace(".json", "");
          const workflow = await readWorkflow(workflowName, client, branch);
          if (workflow) {
            workflows.push(workflow);
          }
        }
      }

      return { workflows };
    } catch {
      return { workflows: [] };
    }
  },
});

export const SANDBOX_WORKFLOWS = [
  upsertWorkflow,
  startWorkflow,
  getWorkflowStatus,
  replayWorkflowFromStep,
  getWorkflow,
  deleteWorkflow,
  listWorkflows,
];
