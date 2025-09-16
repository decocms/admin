import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  MCPClient,
  ProjectTools,
} from "../index.ts";
import { MCPClientStub } from "../stub.ts";
import {
  MappingStepDefinitionSchema,
  ToolCallStepDefinitionSchema,
  WorkflowStepDefinitionSchema,
  WorkflowDefinitionSchema,
} from "./workflow-schemas.ts";
import { createTool, fileNameSlugify, validate } from "../sandbox/utils.ts";

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
        if (step.type === "mapping") {
          const mappingDef = step.def as z.infer<
            typeof MappingStepDefinitionSchema
          >;
          const stepFunctionPath = mappingDef.execute.replace("file://", "");
          const stepFunctionResult = await client.READ_FILE({
            branch,
            path: stepFunctionPath,
            format: "plainString",
          });

          return {
            type: "mapping" as const,
            def: {
              name: mappingDef.name,
              description: mappingDef.description,
              execute: stepFunctionResult.content, // Inline the code in the execute field
            },
          };
        } else if (step.type === "tool_call") {
          const toolDef = step.def as z.infer<
            typeof ToolCallStepDefinitionSchema
          >;
          return {
            type: "tool_call" as const,
            def: {
              name: toolDef.name,
              description: toolDef.description,
              options: toolDef.options,
              tool_name: toolDef.tool_name,
              integration: toolDef.integration,
            },
          };
        } else {
          throw new Error(
            `Unknown step type: ${(step as unknown as { type: string }).type}`,
          );
        }
      }),
    );

    return {
      name: workflow.name,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      steps: inlinedSteps,
    };
  } catch {
    return null;
  }
}

export type MappingStepDefinition = z.infer<typeof MappingStepDefinitionSchema>;
export type ToolCallStepDefinition = z.infer<
  typeof ToolCallStepDefinitionSchema
>;

export type WorkflowStepDefinition = z.infer<
  typeof WorkflowStepDefinitionSchema
>;

export const startWorkflow = createTool({
  name: "WORKFLOWS_START",
  description: "Start a workflow execution using Cloudflare Workflows",
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
    assertHasWorkspace(c);
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

      // Create workflow instance using Cloudflare Workflows
      // Pass the step definitions directly - conversion happens in WorkflowRunner
      const workflowInstance = await c.workflowRunner.create({
        params: {
          input,
          steps: workflow.steps, // Pass WorkflowStepDefinition[] directly
          name,
          context: {
            workspace: c.workspace,
            locator: c.locator,
          },
        },
      });

      console.log(workflowInstance, await workflowInstance.status());

      // Store basic run information for compatibility
      const runId = workflowInstance.id;
      const workflowRun: WorkflowRun = {
        id: runId,
        workflowName: name,
        input,
        status: "running",
        stepResults: {},
        logs: [],
        startTime: Date.now(),
      };

      workflowRuns.set(runId, workflowRun);

      return { runId };
    } catch (error) {
      return {
        runId: "",
        error: `Workflow start failed: ${inspect(error)}`,
      };
    }
  },
});

export const getWorkflowStatus = createTool({
  name: "WORKFLOWS_GET_STATUS",
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

    try {
      // Try to get status from Cloudflare Workflow first
      const workflowInstance = await c.workflowRunner.get(runId);
      const cfStatus = await workflowInstance.status();

      // Map Cloudflare Workflow status to our status format
      let status: "pending" | "running" | "completed" | "failed";
      switch (cfStatus.status) {
        case "queued":
          status = "pending";
          break;
        case "running":
        case "waiting":
          status = "running";
          break;
        case "complete":
          status = "completed";
          break;
        case "errored":
        case "terminated":
          status = "failed";
          break;
        default:
          status = "pending";
      }

      // Get local run data for additional info
      const run = workflowRuns.get(runId);

      return {
        status,
        currentStep: undefined, // CF Workflows doesn't expose current step
        stepResults: run?.stepResults || {},
        finalResult: cfStatus.output,
        partialResult:
          run?.stepResults && Object.keys(run.stepResults).length > 0
            ? {
                completedSteps: Object.keys(run.stepResults),
                stepResults: run.stepResults,
              }
            : undefined,
        error: cfStatus.error || run?.error,
        logs: run?.logs || [],
        startTime: run?.startTime || Date.now(),
        endTime: run?.endTime,
      };
    } catch {
      // Fallback to local storage if CF Workflow not found
      const run = workflowRuns.get(runId);
      if (!run) {
        throw new Error(`Workflow run '${runId}' not found`);
      }

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
    }
  },
});

export const replayWorkflowFromStep = createTool({
  name: "WORKFLOWS_REPLAY_FROM_STEP",
  description:
    "Replay a workflow from a specific step (limited support with Cloudflare Workflows)",
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
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c);

    // For now, return an error as replay is not directly supported by CF Workflows
    // This could be implemented by creating a new workflow with partial state
    return {
      newRunId: "",
      error:
        "Workflow replay is not yet supported with Cloudflare Workflows. Please create a new workflow instance instead.",
    };
  },
});
