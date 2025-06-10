export interface MCPToolCall {
  name: string;
  payload: Record<string, unknown>;
}

export interface MCPToolCallResult {
  status: "ok" | "error";
  data: unknown;
  latency: number;
}
