import { useSuspenseQuery } from "@tanstack/react-query";
import {
  getWorkflowStatus,
  listWorkflowNames,
  listWorkflowRuns,
} from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";
import { useSandboxWorkflow } from "./sandbox-workflows.ts";
import type { WorkflowDefinition } from "../mcp/workflows/workflow-schemas.ts";
import type { Workflow } from "../mcp/workflows/types.ts";

/**
 * Hook to get all unique workflow names in the workspace
 */
export const useWorkflowNames = () => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-names", locator],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowNames(locator, signal);
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    // Cache for 5 minutes since workflow names don't change often
    staleTime: 5 * 60 * 1000,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

/**
 * Hook to get paginated runs for a specific workflow with statistics
 */
export const useWorkflowRuns = (
  workflowName: string,
  page = 1,
  per_page = 25,
) => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-runs", locator, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        locator,
        page,
        per_page,
        workflowName,
        signal,
      );
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
 * Hook to get recent workflow runs from any workflow
 */
export const useRecentWorkflowRuns = (page = 1, per_page = 25) => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["recent-workflow-runs", locator, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        locator,
        page,
        per_page,
        undefined,
        signal,
      );
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    // Cache for 2 minutes since this shows recent activity
    staleTime: 2 * 60 * 1000,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

export const useWorkflowStatus = (workflowName: string, instanceId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: ["workflow-status", locator, workflowName, instanceId],
    queryFn: ({ signal }) =>
      getWorkflowStatus(locator, { workflowName, instanceId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.snapshot;
      const status = typeof snapshot === "string" ? snapshot : snapshot?.status;
      if (status === "success" || status === "failed") {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};

/**
 * Convert old workflow format to new format
 */
function convertToNewWorkflow(oldWorkflow: WorkflowDefinition): Workflow {
  const now = new Date().toISOString();

  return {
    id: `workflow-${oldWorkflow.name}`,
    name: oldWorkflow.name,
    description: oldWorkflow.description,
    inputSchema: oldWorkflow.inputSchema,
    outputSchema: oldWorkflow.outputSchema,
    steps: oldWorkflow.steps.map((step, index) => {
      const stepId = `step-${index}`;

      // Convert old step format to new format
      if (step.type === "mapping") {
        const def = step.def as any;
        return {
          id: stepId,
          title: def.name || `Step ${index + 1}`,
          description: def.description || "",
          prompt: def.description || "Legacy mapping step",
          code: def.execute || "",
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          usedTools: [],
        };
      } else if (step.type === "tool_call") {
        const def = step.def as any;
        return {
          id: stepId,
          title: def.name || `Tool Call ${index + 1}`,
          description: def.description || "",
          prompt: `Call ${def.tool_name} from ${def.integration}`,
          code: `export default async function(ctx) {
  return await ctx.env.${def.integration}.${def.tool_name}(${
            JSON.stringify(
              def.options || {},
              null,
              2,
            )
          });
}`,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          usedTools: [
            {
              integrationId: def.integration,
              toolName: def.tool_name,
            },
          ],
        };
      }

      // Fallback for unknown types
      return {
        id: stepId,
        title: `Step ${index + 1}`,
        description: "",
        prompt: "Unknown step type",
        code: "export default async function(ctx) { return {}; }",
        usedTools: [],
      };
    }),
    executionState: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Hook to get a workflow definition with fallback to empty workflow
 * Returns the new Workflow format
 */
export function useWorkflow(workflowName: string) {
  const { data, isLoading, error } = useSandboxWorkflow(workflowName);

  // Convert to new format or create empty workflow
  const workflow = data
    ? convertToNewWorkflow(data)
    : createEmptyWorkflow(workflowName);

  return {
    workflow,
    isLoading,
    error: error?.message || null,
  };
}

function createEmptyWorkflow(name: string): Workflow {
  const now = new Date().toISOString();

  return {
    id: `workflow-${name}`,
    name,
    description: `Workflow: ${name}`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    steps: [],
    executionState: {},
    createdAt: now,
    updatedAt: now,
  };
}
