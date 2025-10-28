import { useMutation, useQuery } from "@tanstack/react-query";
import { notifyResourceUpdate } from "../broadcast.ts";
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import {
  WorkflowDefinition,
  WorkflowDefinitionSchema,
} from "../mcp/workflows/schemas.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for workflow
const RESOURCE_WORKFLOW = {
  SEARCH: "DECO_RESOURCE_WORKFLOW_SEARCH" as const,
  READ: "DECO_RESOURCE_WORKFLOW_READ" as const,
  CREATE: "DECO_RESOURCE_WORKFLOW_CREATE" as const,
  UPDATE: "DECO_RESOURCE_WORKFLOW_UPDATE" as const,
  DELETE: "DECO_RESOURCE_WORKFLOW_DELETE" as const,
};

// Workflow execution tools
const WORKFLOW_TOOLS = {
  START: "DECO_WORKFLOW_START" as const,
  RUN_STEP: "DECO_WORKFLOW_RUN_STEP" as const,
  CREATE_STEP: "DECO_WORKFLOW_CREATE_STEP" as const,
  EDIT_STEP: "DECO_WORKFLOW_EDIT_STEP" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.Workflows);

export function buildWorkflowUri(name: string): string {
  // rsc://i:workflows-management/workflow/<id>
  return `rsc://${integrationId}/workflow/${name}`;
}

// CRUD Functions (Resources V2)
export type WorkflowReadResult = ReadOutput<typeof WorkflowDefinitionSchema>;

export function getWorkflowByName(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
): Promise<WorkflowReadResult> {
  // Deprecated: prefer getWorkflowByUri with rsc:// URI
  return getWorkflowByUri(locator, buildWorkflowUri(name), signal);
}

export function getWorkflowByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<WorkflowReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_WORKFLOW.READ](
    { uri },
    { signal },
  ) as Promise<WorkflowReadResult>;
}

export function upsertWorkflow(
  locator: ProjectLocator,
  params: WorkflowDefinition,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);

  // Try update by URI first, fallback to create on not found
  // oxlint-disable-next-line no-explicit-any
  return (client as any)
    [RESOURCE_WORKFLOW.UPDATE](
      {
        uri: buildWorkflowUri(params.name),
        data: {
          name: params.name,
          description: params.description,
          steps: params.steps,
        },
      },
      { signal },
    )
    .catch(() =>
      // oxlint-disable-next-line no-explicit-any
      (client as any)[RESOURCE_WORKFLOW.CREATE](
        {
          data: {
            name: params.name,
            description: params.description,
            steps: params.steps,
          },
        },
        { signal },
      ),
    );
}

export function deleteWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_WORKFLOW.DELETE](
    {
      uri: buildWorkflowUri(name),
    },
    { signal },
  );
}

// Workflow execution
export interface WorkflowStartParamsV2 {
  uri: string;
  input: Record<string, unknown>;
  stopAfter?: string;
  state?: Record<string, unknown>;
}

export interface WorkflowRunStepParams {
  stepName: string;
  input: Record<string, unknown>;
}

export function startWorkflow(
  locator: ProjectLocator,
  params: WorkflowStartParamsV2,
  signal?: AbortSignal,
) {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  // oxlint-disable-next-line no-explicit-any
  return client[WORKFLOW_TOOLS.START](params as any, { signal });
}

/**
 * Hook to fetch a workflow by URI
 *
 * ✅ Clean query hook - no hidden side effects
 * ✅ Callers control their own invalidation strategy via file watcher
 *
 * Note: Broadcast listener removed to prevent double invalidations
 * File watcher in Canvas component is the single source of change detection
 */
export const useWorkflow = (workflowUri: string) => {
  const { locator } = useSDK();

  const query = useQuery({
    queryKey: KEYS.WORKFLOW_BY_URI(locator, workflowUri),
    queryFn: ({ signal }) => getWorkflowByUri(locator, workflowUri, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(workflowUri),
  });

  return query;
};

export const useUpsertWorkflow = () => {
  const { locator } = useSDK();
  return useMutation({
    mutationFn: async (params: WorkflowDefinition) => {
      const result = await upsertWorkflow(locator, params);
      return result;
    },
    onSuccess: (data) => {
      // Broadcast workflow upsert to other tabs/components for consistency
      // with other resource types (agents, tools, etc.) and to ensure
      // all listeners react to workflow changes
      if (data.uri) {
        notifyResourceUpdate(data.uri);
      }
    },
  });
};

export const useStartWorkflow = () => {
  const { locator } = useSDK();
  return useMutation({
    mutationFn: async (params: WorkflowStartParamsV2) => {
      const result = (await startWorkflow(locator, params)) as {
        error?: string;
        runId?: string;
        uri?: string;
      };
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (data) => {
      // Notify about the workflow start (updates the workflow resource)
      if (data.uri) {
        notifyResourceUpdate(data.uri);
      }
    },
  });
};
