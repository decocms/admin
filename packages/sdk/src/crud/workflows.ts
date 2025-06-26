import { MCPClient } from "../fetcher.ts";

export interface Workflow {
  created_on: string;
  modified_on: string;
  workflowName: string;
}

export interface WorkflowInstance {
  created_on: string;
  ended_on?: string | null;
  modified_on?: string;
  started_on?: string | null;
  status: string;
  instanceId: string;
  workflowName: string;
}

export interface WorkflowListResult {
  workflows: Workflow[];
  pagination: {
    page?: number;
    per_page?: number;
  };
}

export interface WorkflowInstancesResult {
  instances: WorkflowInstance[];
  pagination: {
    page?: number;
    per_page?: number;
  };
}

export interface WorkflowStartParams {
  workflowName: string;
  params?: { name: string; value: string }[];
}

export interface WorkflowStartResult {
  instanceId: string;
  workflowName: string;
}

export interface WorkflowStatusParams {
  instanceId: string;
  workflowName: string;
}

export interface WorkflowStepAttempt {
  start?: string;
  end?: string;
  success?: boolean;
  error?: { message: string; name?: string } | null;
  output?: unknown;
}

export interface WorkflowStep {
  name: string;
  type?: string;
  start?: string;
  end?: string;
  success?: boolean;
  error?: { message: string; name?: string } | null;
  output?: unknown;
  config?: unknown;
  attempts?: WorkflowStepAttempt[];
  status?: string;
}

export interface WorkflowStatusResult {
  status: string;
  params?: unknown;
  trigger?: unknown;
  versionId?: string;
  queued?: string | null;
  start?: string | null;
  end?: string | null;
  success?: boolean;
  steps?: WorkflowStep[];
  error?: { message: string; name?: string } | string | null;
  output?: unknown;
}

export interface WorkflowDeleteParams {
  workflowName: string;
}

export interface WorkflowDeleteResult {
  success: boolean;
}

export function listWorkflows(
  workspace: string,
  page = 1,
  per_page = 10,
  signal?: AbortSignal,
): Promise<WorkflowListResult> {
  return MCPClient.forWorkspace(workspace).HOSTING_APP_WORKFLOWS_LIST({
    page,
    per_page,
  }, { signal });
}

export function listWorkflowInstances(
  workspace: string,
  workflowName: string,
  page = 1,
  per_page = 10,
  signal?: AbortSignal,
): Promise<WorkflowInstancesResult> {
  return MCPClient.forWorkspace(workspace).HOSTING_APP_WORKFLOWS_INSTANCES_LIST(
    { workflowName, page, per_page },
    { signal },
  );
}

export function startWorkflow(
  workspace: string,
  params: WorkflowStartParams,
): Promise<WorkflowStartResult> {
  return MCPClient.forWorkspace(workspace).HOSTING_APP_WORKFLOWS_START(params);
}

export function getWorkflowStatus(
  workspace: string,
  params: WorkflowStatusParams,
  signal?: AbortSignal,
): Promise<WorkflowStatusResult> {
  return MCPClient.forWorkspace(workspace).HOSTING_APP_WORKFLOWS_STATUS(
    params,
    { signal },
  ) as unknown as Promise<WorkflowStatusResult>;
}

export function deleteWorkflow(
  workspace: string,
  params: WorkflowDeleteParams,
): Promise<WorkflowDeleteResult> {
  return MCPClient.forWorkspace(workspace).HOSTING_APP_WORKFLOWS_DELETE(params);
}
