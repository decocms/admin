import { useMutation, useQuery } from "@tanstack/react-query";
import { callToolFor } from "../fetcher.ts";
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

type ToolsData = {
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
  const response = await callToolFor("", "MCP_LIST_TOOLS", {
    connection,
  });

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return data as ToolsData;
};

export const callTool = async (
  connection: MCPConnection,
  toolCall: MCPToolCall,
) => {
  const response = await callToolFor("", "MCP_CALL_TOOL", {
    connection,
    tool: toolCall,
  });

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return data as MCPToolCallResult;
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
