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

// Tool execution tools
const TOOL_TOOLS = {
  CALL: "DECO_TOOL_CALL_TOOL" as const,
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

// Tool execution
export interface ToolCallParamsV2 {
  uri: string;
  input: Record<string, unknown>;
}

export interface ToolCallResultV2 {
  result?: unknown;
  error?: unknown;
  logs?: Array<{
    type: "log" | "warn" | "error";
    content: string;
  }>;
}

export async function callToolV2(
  locator: ProjectLocator,
  params: ToolCallParamsV2,
  signal?: AbortSignal,
): Promise<ToolCallResultV2> {
  // oxlint-disable-next-line no-explicit-any
  const client = workspaceResourceClient(locator) as any;

  // Check if this is an integration tool or a custom tool
  // Integration tools have URIs like: rsc://i:integration-id/tool/tool-name
  // Custom tools have URIs like: rsc://i:tools-management/tool/tool-name
  const isCustomTool = params.uri.includes("i:tools-management");

  if (!isCustomTool) {
    // This is an integration tool - route to INTEGRATIONS_CALL_TOOL
    try {
      // Parse the URI to extract integration ID and tool name
      // Format: rsc://i:integration-id/tool/tool-name
      const uriWithoutPrefix = params.uri.replace("rsc://", "");
      const parts = uriWithoutPrefix.split("/");
      const integrationId = parts[0];
      const toolName = decodeURIComponent(parts[parts.length - 1]);

      // Call INTEGRATIONS_CALL_TOOL with the integration ID
      const result = await client.INTEGRATIONS_CALL_TOOL({
        id: integrationId,
        params: {
          name: toolName,
          arguments: params.input,
        },
      }, { signal });

      // Transform the MCP result to match ToolCallResultV2 format
      if (result.isError) {
        let errorMessage = "Tool execution failed";
        let errorStack = undefined;
        
        if (result.structuredContent) {
          errorMessage = result.structuredContent.message || errorMessage;
          errorStack = result.structuredContent.stack;
        } else if (result.content && result.content[0]?.text) {
          errorMessage = result.content[0].text;
        }
        
        return {
          error: errorStack ? `${errorMessage}\n\nStack trace:\n${errorStack}` : errorMessage,
          logs: [],
        };
      }

      return {
        result: result.structuredContent || result.content,
        logs: [],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? `${error.message}\n\n${error.stack}` : String(error),
        logs: [],
      };
    }
  }

  // This is a custom tool - use the normal flow
  return client[TOOL_TOOLS.CALL](params, {
    signal,
  }) as Promise<ToolCallResultV2>;
}

export function useToolCallV2() {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useMutation({
    mutationFn: ({
      params,
      signal,
    }: {
      params: ToolCallParamsV2;
      signal?: AbortSignal;
    }) => callToolV2(locator, params, signal),
  });
}
