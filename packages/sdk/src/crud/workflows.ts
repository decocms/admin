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
): Promise<{ workflowNames: string[] }> {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_LIST_NAMES({}, { signal }) as Promise<{
    workflowNames: string[];
  }>;
}

export function listWorkflowRuns(
  locator: ProjectLocator,
  page = 1,
  per_page = 25,
  workflowName?: string,
  signal?: AbortSignal,
): Promise<{ runs: unknown[] }> {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_LIST_RUNS(
    {
      page,
      per_page,
      ...(workflowName && { workflowName }),
    },
    { signal },
  ) as Promise<{ runs: unknown[] }>;
}

export function getWorkflowStatus(
  locator: ProjectLocator,
  params: WorkflowStatusParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forLocator(locator);
  return client.HOSTING_APP_WORKFLOWS_STATUS(params, { signal });
}
