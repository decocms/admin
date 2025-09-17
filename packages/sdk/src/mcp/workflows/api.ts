import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import { VIEW_BINDING_SCHEMA } from "../bindings/views.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createDeconfigClientForContext,
  createTool,
  impl,
  MCPClient,
  ProjectTools,
  WellKnownBindings,
  WorkflowResource,
} from "../index.ts";
import { validate } from "../sandbox/utils.ts";
import { MCPClientStub } from "../stub.ts";
import {
  CodeStepDefinitionSchema,
  ToolCallStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStepDefinitionSchema,
} from "./workflow-schemas.ts";
import { RESOURCE_NAME } from "./resource.ts";

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
  workflows: MCPClientStub<(typeof WellKnownBindings)["Resources"]>,
  branch?: string,
): Promise<z.infer<typeof WorkflowDefinitionSchema> | null> {
  try {
    const result = await workflows.DECO_CHAT_RESOURCES_READ({
      name: RESOURCE_NAME,
      uri: `workflow://${name}`,
    });

    const workflow = WorkflowDefinitionSchema.parse(JSON.parse(result.data));

    // Inline step function code
    const inlinedSteps = await Promise.all(
      workflow.steps.map(async (step) => {
        if (step.type === "code") {
          const codeDef = step.def as z.infer<typeof CodeStepDefinitionSchema>;
          const stepFunctionPath = codeDef.execute.startsWith("file://")
            ? codeDef.execute.replace("file://", "")
            : undefined;
          const stepFunctionResult = stepFunctionPath
            ? await client.READ_FILE({
                branch,
                path: stepFunctionPath,
                format: "plainString",
              })
            : { content: codeDef.execute };

          return {
            type: "code" as const,
            def: {
              name: codeDef.name,
              description: codeDef.description,
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
  } catch (err) {
    console.error(err);
    return null;
  }
}

export type CodeStepDefinition = z.infer<typeof CodeStepDefinitionSchema>;
export type ToolCallStepDefinition = z.infer<
  typeof ToolCallStepDefinitionSchema
>;

export type WorkflowStepDefinition = z.infer<
  typeof WorkflowStepDefinitionSchema
>;

export const startWorkflow = createTool({
  name: "WORKFLOWS_START",
  description: `Execute a multi-step workflow with optional partial execution and state injection.

## Overview

This tool starts a workflow execution. Workflows are sequential automation processes that consist of alternating steps between tool calls (calling integration tools) and code steps (data transformation). Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### name
The identifier of the workflow to execute. This must match an existing workflow definition in the workspace.

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to all steps via \`ctx.readWorkflowInput()\`
- Should match the structure expected by the workflow's first step

### stopAfter (Optional)
The name of the step where execution should halt. When specified:
- The workflow executes **up to and including** the named step
- Execution stops after the specified step completes
- Useful for debugging, testing individual steps, or partial workflow execution
- Example: If workflow has steps ["validate", "process", "notify"], setting \`stopAfter: "process"\` will run "validate" and "process" but skip "notify"

### state (Optional)
Pre-computed step results to inject into the workflow execution state. Format: \`{ "step-name": STEP_RESULT }\`

This allows you to:
- **Skip steps**: Provide expected outputs for steps you want to bypass
- **Resume workflows**: Continue from a specific point with known intermediate results  
- **Test workflows**: Inject mock data to test specific scenarios
- **Debug workflows**: Isolate problems by providing known good inputs to later steps

Example:
\`\`\`json
{
  "validate-input": { "isValid": true, "errors": [] },
  "fetch-data": { "records": [{"id": 1, "name": "test"}] }
}
\`\`\`

## Execution Flow

1. **Validation**: Input is validated against the workflow's input schema
2. **State Injection**: Any provided state results are loaded into the workflow context
3. **Step Execution**: Steps run sequentially, with each step having access to:
   - Original workflow input via \`ctx.readWorkflowInput()\`
   - Previous step results via \`ctx.readStepResult(stepName)\`
   - Injected state results (treated as if those steps already completed)
4. **Stopping**: If \`stopAfter\` is specified, execution halts after that step completes
5. **Tracking**: Returns a \`runId\` for monitoring progress with \`WORKFLOWS_GET_STATUS\`

## Common Use Cases

- **Full Execution**: Run complete workflow from start to finish
- **Step-by-Step Debugging**: Use \`stopAfter\` to test each step individually
- **Workflow Resumption**: Use \`state\` to continue from a previous execution point
- **Testing with Mock Data**: Use \`state\` to inject test results for upstream steps
- **Partial Processing**: Stop at intermediate steps to inspect results before continuing

## Return Value

Returns an object with:
- \`runId\`: Unique identifier for tracking this workflow execution
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)`,
  inputSchema: z.object({
    name: z.string().describe("The name of the workflow to execute"),
    input: z
      .object({})
      .passthrough()
      .describe(
        "The input data that will be validated against the workflow's input schema and passed to the first step",
      ),
    stopAfter: z
      .string()
      .optional()
      .describe(
        "Optional step name where execution should halt. The workflow will execute up to and including this step, then stop. Useful for partial execution, debugging, or step-by-step testing.",
      ),
    state: z
      .object({})
      .passthrough()
      .optional()
      .describe(
        "Optional pre-computed step results to inject into the workflow state. Format: { 'step-name': STEP_RESULT }. Allows skipping steps by providing their expected outputs, useful for resuming workflows or testing with known intermediate results.",
      ),
  }),
  outputSchema: z.object({
    runId: z
      .string()
      .optional()
      .describe("The unique ID for tracking this workflow run"),
    error: z
      .string()
      .optional()
      .describe("Error message if workflow start failed"),
  }),
  handler: async ({ name, input, stopAfter, state }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);
    const deconfig = createDeconfigClientForContext(c);

    try {
      // Read the workflow definition to validate it exists
      const workflow = await readWorkflow(
        name,
        client,
        WorkflowResource.client(deconfig),
        branch,
      );
      if (!workflow) {
        return { error: "Workflow not found" };
      }

      // Validate input against the workflow's input schema
      const inputValidation = validate(input, workflow.inputSchema);
      if (!inputValidation.valid) {
        return {
          error: `Input validation failed: ${inspect(inputValidation)}`,
        };
      }

      // Create workflow instance using Cloudflare Workflows
      // Pass the step definitions directly - conversion happens in WorkflowRunner
      const workflowInstance = await c.workflowRunner.create({
        params: {
          input,
          stopAfter,
          state,
          steps: workflow.steps, // Pass WorkflowStepDefinition[] directly
          name,
          context: {
            workspace: c.workspace,
            locator: c.locator,
          },
        },
      });

      // Return the workflow instance ID directly from Cloudflare
      const runId = workflowInstance.id;
      return { runId };
    } catch (error) {
      return {
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
      // Get status from Cloudflare Workflow
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

      // Extract step results from Cloudflare Workflow output
      let stepResults: Record<string, unknown> = {};
      if (
        cfStatus.output &&
        typeof cfStatus.output === "object" &&
        "steps" in cfStatus.output
      ) {
        stepResults = (cfStatus.output as { steps: Record<string, unknown> })
          .steps;
      }

      const partialResult =
        Object.keys(stepResults).length > 0 && status !== "completed"
          ? {
              completedSteps: Object.keys(stepResults),
              stepResults,
            }
          : undefined;

      return {
        status,
        currentStep: undefined, // CF Workflows doesn't expose current step
        stepResults,
        finalResult: cfStatus.output,
        partialResult,
        error:
          typeof cfStatus.error === "object"
            ? JSON.stringify(cfStatus.error, null, 2)
            : (cfStatus.error ?? undefined),
        logs: [], // CF Workflows doesn't expose individual step logs
        startTime: Date.now(), // CF Workflows doesn't expose start time in status
        endTime: undefined, // CF Workflows doesn't expose end time in status
      };
    } catch (error) {
      throw new Error(`Workflow run '${runId}' not found: ${inspect(error)}`);
    }
  },
});

const WORKFLOW_TOOLS_BUT_VIEWS = [startWorkflow, getWorkflowStatus];

export const workflowViews = impl(VIEW_BINDING_SCHEMA, [
  // DECO_CHAT_VIEWS_LIST
  {
    description: "List views exposed by this MCP",
    handler: (_, c) => {
      c.resourceAccess.grant();

      const org = c.locator?.org;
      const project = c.locator?.project;

      if (!org || !project) {
        return { views: [] };
      }

      return {
        views: [
          // Workflow List View
          {
            name: "WORKFLOWS_LIST",
            title: "Workflows",
            description: "Manage and monitor your workflows",
            icon: "workflow",
            url: `internal://resource/list?name=workflow`,
            tools: WellKnownBindings.Resources.map((resource) => resource.name),
            rules: [
              "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
            ],
          },
          // Workflow Detail View (for individual workflow management)
          {
            name: "WORKFLOW_DETAIL",
            title: "Workflow Detail",
            description: "View and manage individual workflow details",
            icon: "workflow",
            url: `internal://resource/detail?name=workflow`,
            mimeTypePattern: "application/json",
            resourceName: "workflow",
            tools: [
              ...WORKFLOW_TOOLS_BUT_VIEWS.map((tool) => tool.name),
              "DECO_CHAT_RESOURCES_READ",
              "DECO_CHAT_RESOURCES_UPDATE",
              "DECO_CHAT_RESOURCES_SEARCH",
            ],
            rules: [
              "You are a workflow editing specialist. Use the workflow tools to edit the current workflow. A good strategy is to test each step, one at a time in isolation and check how they affect the overall workflow.",
            ],
          },
        ],
      };
    },
  },
]);

export const WORKFLOWS_TOOLS = [...WORKFLOW_TOOLS_BUT_VIEWS, ...workflowViews];
