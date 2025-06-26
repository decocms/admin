import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  deleteWorkflow,
  getWorkflowStatus,
  listWorkflowInstances,
  listWorkflows,
  startWorkflow,
  type Workflow,
  type WorkflowDeleteParams,
  type WorkflowInstance,
  type WorkflowStartParams,
  type WorkflowStatusResult,
  type WorkflowStep,
  type WorkflowStepAttempt,
} from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";
import type { UseSuspenseQueryResult } from "@tanstack/react-query";

export const useWorkflows = (page = 1, per_page = 10) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: ["workflows", workspace, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflows(workspace, page, per_page, signal);
      // Optionally cache each workflow by name
      for (const workflow of result.workflows) {
        const itemKey = ["workflow", workspace, workflow.workflowName];
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Workflow>(itemKey, workflow);
      }
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useWorkflowInstances = (
  workflowName: string,
  page = 1,
  per_page = 10,
) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: ["workflow-instances", workspace, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowInstances(
        workspace,
        workflowName,
        page,
        per_page,
        signal,
      );
      for (const instance of result.instances) {
        const itemKey = ["workflow-instance", workspace, instance.instanceId];
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<WorkflowInstance>(itemKey, instance);
      }
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useStartWorkflow = () => {
  const { workspace } = useSDK();
  return useMutation({
    mutationFn: (params: WorkflowStartParams) =>
      startWorkflow(workspace, params),
  });
};

export const useWorkflowStatus = (
  workflowName: string,
  instanceId: string,
): UseSuspenseQueryResult<WorkflowStatusResult> => {
  const { workspace } = useSDK();
  return useSuspenseQuery<WorkflowStatusResult>({
    queryKey: ["workflow-status", workspace, workflowName, instanceId],
    queryFn: ({ signal }) =>
      getWorkflowStatus(workspace, { workflowName, instanceId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const useDeleteWorkflow = () => {
  const { workspace } = useSDK();
  return useMutation({
    mutationFn: (params: WorkflowDeleteParams) =>
      deleteWorkflow(workspace, params),
  });
};

export type {
  Workflow,
  WorkflowInstance,
  WorkflowStatusResult,
  WorkflowStep,
  WorkflowStepAttempt,
};
