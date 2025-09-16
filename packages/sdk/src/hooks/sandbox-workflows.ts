import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  getSandboxWorkflow,
  upsertSandboxWorkflow,
  startSandboxWorkflow,
  getSandboxWorkflowStatus,
  replaySandboxWorkflowFromStep,
  deleteSandboxWorkflow,
  type SandboxWorkflowDefinition as _SandboxWorkflowDefinition,
  type SandboxWorkflowUpsertParams,
  type SandboxWorkflowStartParams,
  type SandboxWorkflowStatusParams as _SandboxWorkflowStatusParams,
  type SandboxWorkflowReplayParams,
} from "../crud/sandbox-workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";
/**
 * Hook to get a sandbox workflow by name
 */
export const useSandboxWorkflow = (workflowName: string) => {
  const { locator } = useSDK();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sandbox-workflow", locator, workflowName],
    queryFn: async ({ signal }) => {
      const result = await getSandboxWorkflow(locator, workflowName, signal);
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook to upsert (create or update) a sandbox workflow
 */
export const useUpsertSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (params: SandboxWorkflowUpsertParams) => {
      const result = await upsertSandboxWorkflow(locator, params);
      return result;
    },
  });
};

/**
 * Hook to start a sandbox workflow execution
 */
export const useStartSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (params: SandboxWorkflowStartParams) => {
      const result = await startSandboxWorkflow(locator, params);
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
};

/**
 * Hook to get the status of a sandbox workflow run
 */
export const useSandboxWorkflowStatus = (runId: string) => {
  const { locator } = useSDK();

  return useSuspenseQuery({
    queryKey: ["sandbox-workflow-status", locator, runId],
    queryFn: ({ signal }) =>
      getSandboxWorkflowStatus(locator, { runId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const data = query.state.data;
      const status = data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};

/**
 * Hook to replay a sandbox workflow from a specific step
 */
export const useReplaySandboxWorkflowFromStep = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (params: SandboxWorkflowReplayParams) => {
      const result = await replaySandboxWorkflowFromStep(locator, params);
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
};

/**
 * Hook to delete a sandbox workflow
 */
export const useDeleteSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (workflowName: string) => {
      const result = await deleteSandboxWorkflow(locator, workflowName);
      return result;
    },
  });
};
