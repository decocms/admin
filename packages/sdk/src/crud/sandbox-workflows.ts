import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

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

export function getSandboxWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_GET({ name }, { signal });
}

export function upsertSandboxWorkflow(
  locator: ProjectLocator,
  params: SandboxWorkflowUpsertParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_UPSERT(params, { signal });
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
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_DELETE({ name }, { signal });
}

export function listSandboxWorkflows(
  locator: ProjectLocator,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.WORKFLOWS_LIST({}, { signal });
}
