import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import { ToolDefinitionSchema } from "../mcp/tools/schemas.ts";
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
  // deno-lint-ignore no-explicit-any
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
}

export function upsertToolV2(
  locator: ProjectLocator,
  params: ToolUpsertParamsV2,
  signal?: AbortSignal,
): Promise<ToolReadResult> {
  // deno-lint-ignore no-explicit-any
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
  // deno-lint-ignore no-explicit-any
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
  // deno-lint-ignore no-explicit-any
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_TOOL.DELETE]({ uri }, { signal }) as Promise<void>;
}

// React Hooks
export function useTool(uri: string) {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useQuery({
    queryKey: ["tool", uri],
    queryFn: ({ signal }) => getToolByUri(locator, uri, signal),
    retry: false,
  });
}

export function useToolSuspense(uri: string) {
  const { locator } = useSDK();
  if (!locator) {
    throw new InternalServerError("No locator available");
  }

  return useSuspenseQuery({
    queryKey: ["tool", uri],
    queryFn: ({ signal }) => getToolByUri(locator, uri, signal),
    retry: false,
  });
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

export function callToolV2(
  locator: ProjectLocator,
  params: ToolCallParamsV2,
  signal?: AbortSignal,
): Promise<ToolCallResultV2> {
  // deno-lint-ignore no-explicit-any
  const client = workspaceResourceClient(locator) as any;
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
