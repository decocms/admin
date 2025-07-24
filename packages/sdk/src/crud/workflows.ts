import { MCPClient } from "../fetcher.ts";

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

export function listWorkflows(
  workspace: string,
  page = 1,
  per_page = 10,
  signal?: AbortSignal,
) {
  const client = MCPClient.forWorkspace(workspace);
  return client.HOSTING_APP_WORKFLOWS_LIST({ page, per_page }, { signal });
}

export function listWorkflowRuns(
  workspace: string,
  workflowName: string,
  page = 1,
  per_page = 10,
  signal?: AbortSignal,
) {
  const client = MCPClient.forWorkspace(workspace);
  return client.HOSTING_APP_WORKFLOWS_LIST_RUNS({
    page,
    per_page,
    workflowName,
  }, { signal });
}

export function getWorkflowStatus(
  workspace: string,
  params: WorkflowStatusParams,
  signal?: AbortSignal,
) {
  const client = MCPClient.forWorkspace(workspace);
  return client.HOSTING_APP_WORKFLOWS_STATUS(params, { signal });
}
