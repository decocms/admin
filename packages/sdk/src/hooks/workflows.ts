import { useSuspenseQuery } from "@tanstack/react-query";
import { getWorkflowStatus, listWorkflowRuns, listWorkflows } from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";

/**
 * Hook to get paginated runs for a specific workflow with statistics
 */
export const useWorkflowRuns = (
  workflowName: string,
  page = 1,
  per_page = 10,
) => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-runs", workspace, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(workspace, workflowName, page, per_page, signal);
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

export const useWorkspaceWorkflows = () => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workspace-workflows", workspace],
    queryFn: async ({ signal }) => {
      const per_page = 20;
      const result = await listWorkflows(workspace, 1, per_page, signal);

      return {
        workflows: result.workflows,
        pagination: { page: 1, per_page: result.workflows.length },
      };
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    // Cache for 5 minutes since this is expensive
    staleTime: 5 * 60 * 1000,
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
