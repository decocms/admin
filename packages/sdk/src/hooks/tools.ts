import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { MCPConnection } from "../models/mcp.ts";
import { MCPClient } from "../fetcher.ts";
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
  timeout?: number; // Timeout in milliseconds for streaming tools
}

export interface MCPToolCallResult {
  content: unknown;
  error?: string;
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
): Promise<ToolsData> =>
  MCPClient.INTEGRATIONS_LIST_TOOLS({ connection }, init) as Promise<ToolsData>;

export const callTool = (
  connection: MCPConnection,
  toolCallArgs: MCPToolCall,
) =>
  MCPClient.INTEGRATIONS_CALL_TOOL({
    connection,
    // deno-lint-ignore no-explicit-any
    params: toolCallArgs as any,
    timeout: toolCallArgs.timeout,
  });

export function useTools(connection: MCPConnection) {
  const response = useQuery({
    retry: false,
    queryKey: [
      "tools",
      connection.type,
      // deno-lint-ignore no-explicit-any
      (connection as any).url || (connection as any).tenant ||
      // deno-lint-ignore no-explicit-any
      (connection as any).name,
    ],
    queryFn: ({ signal }) => listTools(connection, { signal }),
  });

  return {
    ...response,
    data: response.data || INITIAL_DATA,
  };
}

export function useResources(connection: MCPConnection) {
  return useQuery({
    queryKey: ["resources", connection.type],
    queryFn: () =>
      MCPClient.INTEGRATIONS_LIST_RESOURCES({ connection }).then((r) => r),
    retry: false,
  });
}

export function useToolCall(connection: MCPConnection) {
  return useMutation({
    mutationFn: (toolCall: MCPToolCall) => callTool(connection, toolCall),
  });
}

/**
 * Hook to listen for streaming tool notifications and trigger refetches
 */
export function useStreamingToolNotifications(
  connection: MCPConnection,
  onNotification?: (notification: {
    toolName: string;
    connectionId: string;
    notification: unknown;
  }) => void,
) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      console.log(
        "BroadcastChannel not available, skipping streaming notifications",
      );
      return;
    }

    const channel = new BroadcastChannel("streaming-tool-updates");

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "STREAMING_TOOL_NOTIFICATION") {
        const { toolName, connectionId, notification } = event.data;

        console.log("Received streaming tool notification:", {
          toolName,
          connectionId,
          notification,
        });

        // Call the callback if provided
        if (onNotification) {
          onNotification({ toolName, connectionId, notification });
        }
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, [connection, onNotification]);
}
