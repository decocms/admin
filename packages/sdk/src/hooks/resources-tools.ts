import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect } from "react";
import {
  addResourceUpdateListener,
  notifyResourceUpdate,
} from "../broadcast.ts";
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import { ToolDefinitionSchema } from "../mcp/tools/schemas.ts";
import { KEYS, parseIntegrationId } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for tools
const RESOURCE_TOOL = {
  SEARCH: "DECO_RESOURCE_TOOL_SEARCH" as const,
  READ: "DECO_RESOURCE_TOOL_READ" as const,
  CREATE: "DECO_RESOURCE_TOOL_CREATE" as const,
  UPDATE: "DECO_RESOURCE_TOOL_UPDATE" as const,
  DELETE: "DECO_RESOURCE_TOOL_DELETE" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.Tools);

export function buildToolUri(name: string): string {
  // rsc://i:tools-management/tool/<id>
  return `rsc://${integrationId}/tool/${name}`;
}

// CRUD Functions (Resources V2)
export type ToolReadResult = ReadOutput<typeof ToolDefinitionSchema>;

export function getToolByName(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
): Promise<ToolReadResult> {
  // Deprecated: prefer getToolByUri with rsc:// URI
  return getToolByUri(locator, buildToolUri(name), signal);
}

export function getToolByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<ToolReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_TOOL.READ](
    { uri },
    { signal },
  ) as Promise<ToolReadResult>;
}

export interface ToolUpsertParamsV2 {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  execute: string;
  dependencies?: Array<{
    integrationId: string;
    toolNames?: string[];
  }>;
}

export function upsertToolV2(
  locator: ProjectLocator,
  params: ToolUpsertParamsV2,
  signal?: AbortSignal,
): Promise<ToolReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_TOOL.CREATE](
    {
      data: params,
    },
    { signal },
  ) as Promise<ToolReadResult>;
}

export function updateToolV2(
  locator: ProjectLocator,
  uri: string,
  params: Partial<ToolUpsertParamsV2>,
  signal?: AbortSignal,
): Promise<ToolReadResult> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_TOOL.UPDATE](
    {
      uri,
      data: params,
    },
    { signal },
  ) as Promise<ToolReadResult>;
}

export function deleteToolV2(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<void> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_TOOL.DELETE]({ uri }, { signal }) as Promise<void>;
}

// React Hooks
export function useTool(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const toolQuery = useQuery({
    queryKey: KEYS.TOOL(locator, uri),
    queryFn: ({ signal }) => getToolByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        // Invalidate this specific tool query
        queryClient.invalidateQueries({
          queryKey: KEYS.TOOL(locator, uri),
          refetchType: "all",
        });

        // Also invalidate the tool list
        const integrationId = parseIntegrationId(uri);
        queryClient.invalidateQueries({
          queryKey: KEYS.TOOLS_LIST(locator, integrationId),
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [uri, locator, queryClient]);

  return toolQuery;
}

export function useToolSuspense(uri: string) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  const suspenseToolQuery = useSuspenseQuery({
    queryKey: KEYS.TOOL(locator, uri),
    queryFn: ({ signal }) => getToolByUri(locator, uri, signal),
    retry: false,
  });

  // Listen for resource updates and auto-invalidate
  useEffect(() => {
    const cleanup = addResourceUpdateListener((message) => {
      if (message.type === "RESOURCE_UPDATED" && message.resourceUri === uri) {
        // Invalidate this specific tool query
        queryClient.invalidateQueries({
          queryKey: KEYS.TOOL(locator, uri),
          refetchType: "all",
        });

        // Also invalidate the tool list
        const integrationId = parseIntegrationId(uri);
        queryClient.invalidateQueries({
          queryKey: KEYS.TOOLS_LIST(locator, integrationId),
          refetchType: "all",
        });
      }
    });

    return cleanup;
  }, [uri, locator, queryClient]);

  return suspenseToolQuery;
}

export function useUpsertTool() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      params,
      signal,
    }: {
      params: ToolUpsertParamsV2;
      signal?: AbortSignal;
    }) => upsertToolV2(locator, params, signal),
    onSuccess: (data) => {
      // Notify about the resource update
      if (data.uri) {
        notifyResourceUpdate(data.uri);
      }
    },
  });
}

export function useUpdateTool() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      uri,
      params,
      signal,
    }: {
      uri: string;
      params: Partial<ToolUpsertParamsV2>;
      signal?: AbortSignal;
    }) => updateToolV2(locator, uri, params, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource update
      notifyResourceUpdate(variables.uri);
    },
  });
}

export function useDeleteTool() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({ uri, signal }: { uri: string; signal?: AbortSignal }) =>
      deleteToolV2(locator, uri, signal),
    onSuccess: (_data, variables) => {
      // Notify about the resource deletion
      notifyResourceUpdate(variables.uri);
    },
  });
}
