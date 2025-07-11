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

/**
 * Hook to get all workflow instances for a specific workflow name
 */
export const useWorkflowInstances = (
  workflowName: string,
  page = 1,
  per_page = 10
) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-instances", workspace, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflows(workspace, page, per_page, signal);
      // Filter to only include runs for this specific workflow
      const filteredWorkflows = result.workflows.filter(
        (workflow) => workflow.workflowName === workflowName
      );
      
      return {
        ...result,
        workflows: filteredWorkflows,
      };
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

/**
 * Hook to get all runs for a specific workflow (without pagination)
 * Useful for calculating statistics
 */
export const useAllWorkflowRuns = (workflowName: string) => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["all-workflow-runs", workspace, workflowName],
    queryFn: async ({ signal }) => {
      // Fetch a large number to get all runs for this workflow
      // In the future, we might want to implement a "get all" API endpoint
      const result = await listWorkflows(workspace, 1, 1000, signal);
      
      // Filter to only include runs for this specific workflow
      const filteredWorkflows = result.workflows.filter(
        (workflow) => workflow.workflowName === workflowName
      );
      
      return {
        ...result,
        workflows: filteredWorkflows,
      };
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

/**
 * Hook to get all unique workflow names by fetching all workflow runs
 * This addresses the issue of missing workflows when only fetching recent runs
 */
export const useAllUniqueWorkflows = () => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["all-unique-workflows", workspace],
    queryFn: async ({ signal }) => {
      const allRuns: any[] = [];
      let page = 1;
      const per_page = 100;
      
      // Keep fetching until we get all workflows
      while (true) {
        const result = await listWorkflows(workspace, page, per_page, signal);
        
        if (result.workflows.length === 0) {
          break; // No more data
        }
        
        allRuns.push(...result.workflows);
        
        // If we got less than per_page, we've reached the end
        if (result.workflows.length < per_page) {
          break;
        }
        
        page++;
      }
      
      return {
        workflows: allRuns,
        pagination: { page: 1, per_page: allRuns.length },
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
