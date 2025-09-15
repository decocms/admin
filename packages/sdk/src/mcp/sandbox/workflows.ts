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
        (step) => step.name === startFromStep,
      );
      if (startStepIndex === -1) {
        run.status = "failed";
        run.error = `Starting step '${startFromStep}' not found in workflow`;
        return;
      }
    }

    // Execute steps sequentially starting from the specified step
    for (let i = startStepIndex; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      run.currentStep = step.name;

      // Evaluate the step function using inlined code
      using stepEvaluation = await evalCodeAndReturnDefaultHandle(
        step.execute,
        runtimeId,
      );
      const {
        ctx: stepCtx,
        defaultHandle: stepDefaultHandle,
        guestConsole: stepConsole,
      } = stepEvaluation;

      try {
        // Create step context with WellKnownOptions
        const stepContext = {
          ...step.contextSchema, // Include step's contextSchema properties
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

        // Call the step function
        const stepCallHandle = await callFunction(
          stepCtx,
          stepDefaultHandle,
          undefined,
          stepContext,
          {},
        );

        const stepResult = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

        // Validate step output against the step's output schema
        const stepOutputValidation = validate(stepResult, step.outputSchema);
        if (!stepOutputValidation.valid) {
          run.status = "failed";
          run.error = `Step '${step.name}' output validation failed: ${inspect(
            stepOutputValidation,
          )}`;
          run.logs.push(...stepConsole.logs);
          return;
        }

        // Store the step result
        run.stepResults[step.name] = stepResult;
        run.logs.push(...stepConsole.logs);
      } catch (error) {
        run.status = "failed";
        run.error = `Step '${step.name}' execution failed: ${inspect(error)}`;
        run.logs.push(...stepConsole.logs);
        return;
      }
    }

    // Execute the workflow's execute function using inlined code
    using workflowEvaluation = await evalCodeAndReturnDefaultHandle(
      workflow.execute,
      runtimeId,
    );
    const {
      ctx: workflowCtx,
      defaultHandle: workflowDefaultHandle,
      guestConsole: workflowConsole,
    } = workflowEvaluation;

    try {
      // Create workflow context with WellKnownOptions
      const workflowContext = {
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

      // Call the workflow execute function
      const workflowCallHandle = await callFunction(
        workflowCtx,
        workflowDefaultHandle,
        undefined,
        workflowContext,
        {},
      );

      const workflowResult = workflowCtx.dump(
        workflowCtx.unwrapResult(workflowCallHandle),
      );

      // Validate workflow output against the workflow's output schema
      const workflowOutputValidation = validate(
        workflowResult,
        workflow.outputSchema,
      );
      if (!workflowOutputValidation.valid) {
        run.status = "failed";
        run.error = `Workflow output validation failed: ${inspect(
          workflowOutputValidation,
        )}`;
        run.logs.push(...workflowConsole.logs);
        return;
      }

      run.finalResult = workflowResult;
      run.logs.push(...workflowConsole.logs);
      run.status = "completed";
      run.endTime = Date.now();
    } catch (error) {
      run.status = "failed";
      run.error = `Workflow execution failed: ${inspect(error)}`;
      run.logs.push(...workflowConsole.logs);
      run.endTime = Date.now();
    }
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

    // Inline step function code
    const inlinedSteps = await Promise.all(
      workflow.steps.map(async (step) => {
        const stepFunctionPath = step.execute.replace("file://", "");
        const stepFunctionResult = await client.READ_FILE({
          branch,
          path: stepFunctionPath,
          format: "plainString",
        });

        return {
          name: step.name,
          description: step.description,
          contextSchema: step.contextSchema,
          outputSchema: step.outputSchema,
          execute: stepFunctionResult.content, // Inline the code in the execute field
        };
      }),
    );

    // Inline workflow execute function code
    const workflowExecutePath = workflow.execute.replace("file://", "");
    const workflowExecuteResult = await client.READ_FILE({
      branch,
      path: workflowExecutePath,
      format: "plainString",
    });

    return {
      name: workflow.name,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      steps: inlinedSteps,
      execute: workflowExecuteResult.content, // Inline the code in the execute field
    };
  } catch {
    return null;
  }
}

export const WorkflowStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the step within the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this step does"),
  contextSchema: z
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
      "Step configuration schema. Extend this object with custom properties for business user configuration (e.g., AI prompts, temperature settings)",
    ),
  outputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the minimal data this step returns. Keep output minimal for better performance",
    ),
  execute: z
    .string()
    .min(1)
    .describe(
      "ES module code that exports a default async function: (ctx: ContextSchema & WellKnownOptions) => Promise<outputSchema>",
    ),
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
    .describe("Array of workflow steps that execute sequentially"),
  execute: z
    .string()
    .min(1)
    .describe(
      "ES module code that exports a default async function to aggregate step results and return the workflow's outputSchema",
    ),
});

const WORKFLOW_DESCRIPTION = `Create or update a workflow in the sandbox environment.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another
- **Execute Function**: Aggregates step results and returns the final workflow output

## Workflow Steps

Each step in a workflow is a self-contained unit with:

### Step Structure
- **name**: Unique identifier within the workflow
- **description**: Clear explanation of the step's purpose
- **contextSchema**: Configuration schema with well-known properties:
  - retry (number, default: 0): Number of retry attempts on failure
  - timeout (number, default: Infinity): Maximum execution time in milliseconds
  - Custom properties: Extend with business-specific configuration (AI prompts, temperature, etc.)
- **outputSchema**: JSON Schema defining the minimal data returned by this step
- **execute**: ES module code with a default async function

### Step Execution Function
Each step's execute function follows this pattern:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains:
  // - Your custom contextSchema properties
  // - WellKnownOptions helper functions:
  //   - await ctx.readWorkflowInput(): Returns the initial workflow input
  //   - await ctx.readStepResult(stepName): Returns output from a previous step
  
  // Your step logic here
  return stepOutput; // Must match outputSchema
}
\`\`\`

## Workflow Execute Function

The workflow's execute function aggregates all step results:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains WellKnownOptions helper functions:
  // - await ctx.readWorkflowInput(): Original workflow input
  // - await ctx.readStepResult(stepName): Any step's output
  
  // Aggregate and transform step results
  const finalResult = {
    // Combine data from multiple steps
    // Transform to match outputSchema
  };
  
  return finalResult; // Must match workflow's outputSchema
}
\`\`\`

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
  "steps": [
    {
      "name": "validate-input",
      "description": "Validates user input data",
      "contextSchema": {
        "retry": 2,
        "timeout": 5000
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "isValid": { "type": "boolean" },
          "errors": { "type": "array", "items": { "type": "string" } }
        }
      },
      "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { isValid: input.email.includes('@'), errors: [] }; }"
    },
    {
      "name": "enrich-data",
      "description": "Adds additional user information",
      "contextSchema": {
        "retry": 1,
        "timeout": 10000,
        "apiKey": "string"
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "enrichedData": { "type": "object" }
        }
      },
      "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { enrichedData: { ...input, timestamp: Date.now() } }; }"
    }
  ],
  "execute": "export default async function(ctx) { const validation = await ctx.readStepResult('validate-input'); const enrichment = await ctx.readStepResult('enrich-data'); return { userId: 'user_123', status: 'created' }; }"
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
  "steps": [
    {
      "name": "generate-draft",
      "description": "Creates initial content draft",
      "contextSchema": {
        "retry": 1,
        "timeout": 30000,
        "temperature": 0.7,
        "maxTokens": 1000
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "draft": { "type": "string" }
        }
      },
      "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { draft: \`Generated content about \${input.topic} in \${input.tone} tone\` }; }"
    },
    {
      "name": "review-content",
      "description": "Reviews and scores the generated content",
      "contextSchema": {
        "retry": 0,
        "timeout": 15000
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "quality": { "type": "number" },
          "feedback": { "type": "string" }
        }
      },
      "execute": "export default async function(ctx) { const draft = await ctx.readStepResult('generate-draft'); return { quality: 8, feedback: 'Good content structure' }; }"
    }
  ],
  "execute": "export default async function(ctx) { const draft = await ctx.readStepResult('generate-draft'); const review = await ctx.readStepResult('review-content'); return { content: draft.draft, quality: review.quality }; }"
}
\`\`\`

## Best Practices

1. **Minimal Output**: Keep step outputs minimal to improve performance
2. **Error Handling**: Use retry and timeout configurations appropriately
3. **Schema Validation**: Define clear input/output schemas for type safety
4. **Step Independence**: Design steps to be testable in isolation
5. **Business Configuration**: Use contextSchema to expose tunable parameters
6. **Sequential Execution**: Steps run in order - design accordingly

## WellKnownOptions Interface

The context object in both step and workflow execute functions includes:

\`\`\`typescript
interface WellKnownOptions {
  readWorkflowInput(): Promise<WorkflowInputSchema>;
  readStepResult(stepName: string): Promise<StepOutputSchema>;
}
\`\`\`

Use these helper functions to access workflow input and previous step results within your execute functions.

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
    { name, description, inputSchema, outputSchema, steps, execute },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);
    const filename = fileNameSlugify(name);

    try {
      // Process each step and save their execute functions
      const processedSteps = [];

      for (const step of steps) {
        const stepName = fileNameSlugify(step.name);
        const stepFilePath = `/src/functions/${filename}.${stepName}.ts`;

        // Process the step execute code
        const { functionCode, functionPath } = await processExecuteCode(
          step.execute,
          stepFilePath,
          client,
          branch,
        );

        // Validate the step function code
        const validation = await validateExecuteCode(
          functionCode,
          runtimeId,
          `Step ${step.name}`,
        );

        if (!validation.success) {
          return {
            success: false,
            error: validation.error,
          };
        }

        // Add the processed step with file reference
        processedSteps.push({
          name: step.name,
          description: step.description,
          contextSchema: step.contextSchema,
          outputSchema: step.outputSchema,
          execute: `file://${functionPath}`,
        });
      }

      // Process the workflow execute function
      const workflowExecutePath = `/src/functions/${filename}.output.ts`;
      const {
        functionCode: workflowExecuteCode,
        functionPath: workflowExecuteFilePath,
      } = await processExecuteCode(
        execute,
        workflowExecutePath,
        client,
        branch,
      );

      // Validate the workflow execute function code
      const workflowValidation = await validateExecuteCode(
        workflowExecuteCode,
        runtimeId,
        "Workflow execute",
      );

      if (!workflowValidation.success) {
        return {
          success: false,
          error: workflowValidation.error,
        };
      }

      // Store the workflow metadata with file references
      const workflowPath = `/src/workflows/${filename}.json`;

      const workflowData = {
        name,
        description,
        inputSchema,
        outputSchema,
        steps: processedSteps,
        execute: `file://${workflowExecuteFilePath}`,
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
    const partialResult =
      Object.keys(run.stepResults).length > 0
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
          error: `Step '${stepName}' was not completed in the original run or does not exist`,
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
