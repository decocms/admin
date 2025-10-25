import { useMutation, useQuery } from "@tanstack/react-query";
import { MCPClient } from "../fetcher.ts";
import type { MCPConnection } from "../models/mcp.ts";
import { ProjectLocator } from "../locator.ts";
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResult<T = unknown> {
  content: Array<{
    text: string;
    type: "text";
  }>;
  structuredContent?: T;
  isError?: boolean;
}

export type ToolsData = {
  tools: MCPTool[];
  instructions: string;
  version?: {
    name: string;
    version?: string;
  };
  capabilities?: Record<string, unknown>;
};

const INITIAL_DATA: ToolsData = { tools: [], instructions: "" };

export const listTools = (
  connection: MCPConnection,
  init?: RequestInit,
  ignoreCache?: boolean,
): Promise<ToolsData> =>
  MCPClient.INTEGRATIONS_LIST_TOOLS(
    { connection, ignoreCache },
    init,
  ) as Promise<ToolsData>;

export const callTool = (
  connection: MCPConnection | { id: string },
  toolCallArgs: MCPToolCall,
  locator?: ProjectLocator,
) => {
  const client = locator ? MCPClient.forLocator(locator) : MCPClient;
  return client.INTEGRATIONS_CALL_TOOL({
    ...("id" in connection ? { id: connection.id } : { connection }),
    // oxlint-disable-next-line no-explicit-any
    params: toolCallArgs as any,
  });
};

export function useTools(connection: MCPConnection, ignoreCache?: boolean) {
  const response = useQuery({
    retry: false,
    queryKey: [
      "tools",
      connection.type,
      // oxlint-disable-next-line no-explicit-any
      (connection as any).url ||
        // oxlint-disable-next-line no-explicit-any
        (connection as any).tenant ||
        // oxlint-disable-next-line no-explicit-any
        (connection as any).name,
      ignoreCache,
    ],
    queryFn: ({ signal }) => listTools(connection, { signal }, ignoreCache),
    // Aggressive caching to prevent rate limit issues
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on remount if data exists
  });

  return {
    ...response,
    data: response.data || INITIAL_DATA,
  };
}

export function useToolCall<T = unknown>(
  params: MCPConnection | { id: string },
  locator?: ProjectLocator,
) {
  return useMutation<MCPToolCallResult<T>, Error, MCPToolCall>({
    mutationFn: (toolCall: MCPToolCall) =>
      callTool(params, toolCall, locator) as Promise<MCPToolCallResult<T>>,
  });
}
