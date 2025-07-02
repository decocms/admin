import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getWorkflowStatus, listWorkflows } from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";

export const useWorkflows = (page = 1, per_page = 10) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflows", workspace, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflows(workspace, page, per_page, signal);
      // Optionally cache each workflow by name
      for (const workflow of result.workflows) {
        const itemKey = ["workflow", workspace, workflow.workflowName];
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData(itemKey, workflow);
      }
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

export const useWorkflowStatus = (
  workflowName: string,
  instanceId: string,
) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: ["workflow-status", workspace, workflowName, instanceId],
    queryFn: ({ signal }) =>
      getWorkflowStatus(workspace, { workflowName, instanceId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.snapshot;
      const status = typeof snapshot === "string" ? snapshot : snapshot?.status;
      if (
        status === "success" ||
        status === "failed"
      ) {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};
