import { useMutation, useQuery } from "@tanstack/react-query";
import { API_HEADERS, API_SERVER_URL } from "../constants.ts";
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

const fetchAPI = (path: string, init?: RequestInit) =>
  fetch(new URL(path, API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const listTools = async (
  connection: MCPConnection,
): Promise<ToolsData> => {
  const response = await fetchAPI(`/inspect/list-tools`, {
    method: "POST",
    body: JSON.stringify(connection),
  });

  if (!response.ok) {
    throw new Error("Failed to list tools");
  }

  return response.json() as Promise<ToolsData>;
};

export const callTool = async (
  connection: MCPConnection,
  toolCall: MCPToolCall,
) => {
  const response = await fetchAPI("/inspect/call-tool", {
    method: "POST",
    body: JSON.stringify({ connection, toolCall }),
  });

  if (!response.ok) {
    throw new Error("Failed to call tool");
  }

  return response.json() as Promise<MCPToolCallResult>;
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
