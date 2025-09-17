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
import { fileNameSlugify, validate } from "../sandbox/utils.ts";
import { MCPClientStub } from "../stub.ts";
import {
  MappingStepDefinitionSchema,
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
    const workflowFileName = fileNameSlugify(name);

    const result = await workflows.DECO_CHAT_RESOURCES_READ({
      name: RESOURCE_NAME,
      uri: `deconfig://workflows/${workflowFileName}`,
    });

    const workflow = WorkflowDefinitionSchema.parse(JSON.parse(result.data));

    // Inline step function code
    const inlinedSteps = await Promise.all(
      workflow.steps.map(async (step) => {
        if (step.type === "mapping") {
          const mappingDef = step.def as z.infer<
            typeof MappingStepDefinitionSchema
          >;
          const stepFunctionPath = mappingDef.execute.startsWith("file://")
            ? mappingDef.execute.replace("file://", "")
            : undefined;
          const stepFunctionResult = stepFunctionPath
            ? await client.READ_FILE({
                branch,
                path: stepFunctionPath,
                format: "plainString",
              })
            : { content: mappingDef.execute };

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
  } catch (err) {
    console.error(err);
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

      // Return the workflow instance ID directly from Cloudflare
      const runId = workflowInstance.id;
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
        error: cfStatus.error,
        logs: [], // CF Workflows doesn't expose individual step logs
        startTime: Date.now(), // CF Workflows doesn't expose start time in status
        endTime: undefined, // CF Workflows doesn't expose end time in status
      };
    } catch (error) {
      throw new Error(`Workflow run '${runId}' not found: ${inspect(error)}`);
    }
  },
});

export const replayWorkflowFromStep = createTool({
  name: "WORKFLOWS_REPLAY_FROM_STEP",
  description:
    "Replay a workflow from a specific step using Cloudflare Workflows restart capability",
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

    try {
      // Get the original workflow instance to retrieve its parameters
      const workflowInstance = await c.workflowRunner.get(runId);
      const originalStatus = await workflowInstance.status();

      if (!originalStatus) {
        return {
          newRunId: "",
          error: "Original workflow run not found",
        };
      }

      // For now, replay is not fully supported with Cloudflare Workflows
      // as it doesn't provide a direct restart from step functionality
      // Return an error message suggesting to create a new workflow instead
      return {
        newRunId: "",
        error: `Workflow replay from step "${stepName}" is not yet supported with Cloudflare Workflows. Please create a new workflow instance instead. Original run ID: ${runId}`,
      };
    } catch (error) {
      return {
        newRunId: "",
        error: `Workflow replay failed: ${inspect(error)}`,
      };
    }
  },
});

const WORKFLOW_TOOLS_BUT_VIEWS = [
  startWorkflow,
  getWorkflowStatus,
  replayWorkflowFromStep,
];

export const workflowViews = impl(VIEW_BINDING_SCHEMA, [
  // DECO_CHAT_VIEWS_LIST
  {
    description: "List views exposed by this MCP",
    handler: async (_, c) => {
      c.resourceAccess.grant();

      const org = c.locator?.org;
      const project = c.locator?.project;
      const branch = c.locator?.branch || "main";

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
