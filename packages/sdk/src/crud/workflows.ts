import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

export interface WorkflowStartParams {
  workflowName: string;
  params?: { name: string; value: string }[];
}

export interface WorkflowStatusParams {
  instanceId: string;
  workflowName: string;
}

export interface WorkflowDeleteParams {
  workflowName: string;
}

export function listWorkflowNames(
  locator: ProjectLocator,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_LIST_NAMES({}, { signal });
}

export function listWorkflowRuns(
  locator: ProjectLocator,
  page = 1,
  per_page = 25,
  workflowName?: string,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_LIST_RUNS(
    {
      page,
      per_page,
      ...(workflowName && { workflowName }),
    },
    { signal },
  );
}

export function getWorkflowStatus(
  locator: ProjectLocator,
  params: WorkflowStatusParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_STATUS(params, { signal });
}
