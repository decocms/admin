import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";
import { WellKnownBindings } from "../mcp/index.ts";
import { WellKnownMcpGroups } from "./groups.ts";
import { WorkflowDefinitionSchema } from "../mcp/workflows/workflow-schemas.ts";

export type ResourceBinding = (typeof WellKnownBindings)["Resources"];
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator<ResourceBinding>(
    locator,
    `/${WellKnownMcpGroups.Workflows}/mcp`,
  );

export interface SandboxWorkflowDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  steps: Array<{
    type: "tool_call" | "mapping";
    def: Record<string, unknown>;
  }>;
}

const RESOURCE_NAME = "workflow";

export interface SandboxWorkflowUpsertParams {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  steps: Array<{
    type: "tool_call" | "mapping";
    def: Record<string, unknown>;
  }>;
}

export interface SandboxWorkflowStartParams {
  name: string;
  input: Record<string, unknown>;
}

export interface SandboxWorkflowStatusParams {
  runId: string;
}

export interface SandboxWorkflowReplayParams {
  runId: string;
  stepName: string;
}

// Helper function to build workflow URI
function buildWorkflowUri(name: string): string {
  return `workflow://${name}`;
}

export function getSandboxWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return client
    .DECO_CHAT_RESOURCES_READ(
      {
        name: RESOURCE_NAME,
        uri: buildWorkflowUri(name),
      },
      { signal },
    )
    .then((result) => WorkflowDefinitionSchema.parse(JSON.parse(result.data)));
}

export function upsertSandboxWorkflow(
  locator: ProjectLocator,
  params: SandboxWorkflowUpsertParams,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);

  // Check if workflow exists to determine CREATE vs UPDATE
  return getSandboxWorkflow(locator, params.name, signal)
    .then(() => {
      // Workflow exists, update it
      return client.DECO_CHAT_RESOURCES_UPDATE(
        {
          name: RESOURCE_NAME,
          uri: buildWorkflowUri(params.name),
          title: params.name,
          description: params.description,
          content: {
            type: "text" as const,
            data: JSON.stringify({
              name: params.name,
              description: params.description,
              inputSchema: params.inputSchema,
              outputSchema: params.outputSchema,
              steps: params.steps,
            }),
            mimeType: "application/json",
          },
        },
        { signal },
      );
    })
    .catch(() => {
      // Workflow doesn't exist, create it
      return client.DECO_CHAT_RESOURCES_CREATE(
        {
          name: RESOURCE_NAME,
          resourceName: params.name,
          title: params.name,
          description: params.description,
          content: {
            type: "text" as const,
            data: JSON.stringify({
              name: params.name,
              description: params.description,
              inputSchema: params.inputSchema,
              outputSchema: params.outputSchema,
              steps: params.steps,
            }),
            mimeType: "application/json",
          },
        },
        { signal },
      );
    });
}

export function startSandboxWorkflow(
  locator: ProjectLocator,
  params: SandboxWorkflowStartParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_START(params, { signal });
}

export function getSandboxWorkflowStatus(
  locator: ProjectLocator,
  params: SandboxWorkflowStatusParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_GET_STATUS(params, { signal });
}

export function replaySandboxWorkflowFromStep(
  locator: ProjectLocator,
  params: SandboxWorkflowReplayParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_REPLAY_FROM_STEP(params, { signal });
}

export function deleteSandboxWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return client.DECO_CHAT_RESOURCES_DELETE(
    {
      name: RESOURCE_NAME,
      uri: buildWorkflowUri(name),
    },
    { signal },
  );
}
