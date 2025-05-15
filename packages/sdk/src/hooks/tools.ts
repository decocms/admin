import { useMutation, useQuery } from "@tanstack/react-query";
import { callTool as toolCall } from "../fetcher.ts";
import type { MCPConnection } from "../models/mcp.ts";

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
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

export const listTools = async (
  connection: MCPConnection,
): Promise<ToolsData> => {
  const response = await toolCall("INTEGRATIONS_LIST_TOOLS", { connection });

  if (!response.ok) {
    throw new Error("Failed to list tools");
  }

  return response.json<{ data: ToolsData }>().then((resp) => resp.data);
};

export const callTool = async (
  connection: MCPConnection,
  toolCallArgs: MCPToolCall,
) => {
  const response = await toolCall("INTEGRATIONS_CALL_TOOL", {
    connection,
    params: toolCallArgs,
  });

  if (!response.ok) {
    throw new Error("Failed to call tool");
  }

  return response.json<{ data: MCPToolCallResult }>().then((resp) => resp.data);
};

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
    queryFn: () => listTools(connection),
  });

  return {
    ...response,
    data: response.data || INITIAL_DATA,
  };
}

export function useToolCall(connection: MCPConnection) {
  return useMutation({
    mutationFn: (toolCall: MCPToolCall) => callTool(connection, toolCall),
  });
}
