import type { ToolBinder } from "@/core/define-tool";
import type z from "zod";
import type { MCPMeshTools } from "./index.ts";

export type MCPClient<
  TDefinition extends readonly ToolBinder<z.ZodTypeAny, z.ZodTypeAny>[],
> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    infer TInput,
    infer TReturn
  >
    ? (params: z.infer<TInput>, init?: RequestInit) => Promise<z.infer<TReturn>>
    : never;
};

export type MeshClient = MCPClient<MCPMeshTools>;

export const UNKNOWN_CONNECTION_ID = "UNKNOWN_CONNECTION_ID";

const parseSSEResponseAsJson = async (response: Response) => {
  /**
   * example:
   * 'event: message\ndata: {"result":{"content":[{"type":"text","text":"{\\"organizations\\":[{\\"id\\":\\"1\\",\\"name\\":\\"Organization 1\\",\\"slug\\":\\"organization-1\\",\\"createdAt\\":\\"2025-11-03T18:12:46.700Z\\"}]}"}],"structuredContent":{"organizations":[{"id":"1","name":"Organization 1","slug":"organization-1","createdAt":"2025-11-03T18:12:46.700Z"}]}},"jsonrpc":"2.0","id":1}\n\n'
   */
  const raw = await response.text();
  const data = raw.split("\n").find((line) => line.startsWith("data: "));

  if (!data) {
    throw new Error("No data received from the server");
  }

  const json = JSON.parse(data.replace("data: ", ""));

  return json;
};

/**
 * Type for a generic tool caller function
 */
export type ToolCaller<TArgs = unknown, TOutput = unknown> = (
  toolName: string,
  args: TArgs,
) => Promise<TOutput>;

/**
 * Create a unified tool caller
 *
 * - If connectionId is provided: routes to /mcp/:connectionId (connection-specific tools)
 * - If connectionId is omitted/null: routes to /mcp (mesh API tools)
 *
 * This abstracts the routing logic so hooks don't need to know if they're
 * calling mesh tools or connection-specific tools.
 */
export function createToolCaller<TArgs = unknown, TOutput = unknown>(
  connectionId?: string,
): ToolCaller<TArgs, TOutput> {
  if (connectionId === UNKNOWN_CONNECTION_ID) {
    return (async () => {}) as unknown as ToolCaller<TArgs, TOutput>;
  }

  const endpoint = connectionId ? `/mcp/${connectionId}` : "/mcp";

  return async (toolName: string, args: TArgs): Promise<TOutput> => {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await parseSSEResponseAsJson(response);

    if (json.result?.isError) {
      throw new Error(json.result.content?.[0]?.text || "Tool call failed");
    }

    return json.result?.structuredContent || json.result;
  };
}

/**
 * Type for a streaming tool caller function
 */
export type StreamingToolCaller = <TOutput>(
  toolName: string,
  args: unknown,
  signal?: AbortSignal,
) => AsyncGenerator<TOutput, void, unknown>;

/**
 * Create a streaming tool caller for tools that return ndjson streams.
 *
 * Uses the dedicated streaming endpoint: /mcp/:connectionId/stream/:toolName
 * This bypasses the MCP JSON-RPC protocol and calls the tool directly.
 *
 * Usage:
 * ```ts
 * const streamCaller = createStreamingToolCaller(connectionId);
 * for await (const chunk of streamCaller<MyOutput>("STREAM_MY_TOOL", { id: "123" })) {
 *   console.log("Got update:", chunk);
 * }
 * ```
 */
export function createStreamingToolCaller(
  connectionId?: string,
): StreamingToolCaller {
  if (connectionId === UNKNOWN_CONNECTION_ID) {
    return async function* <TOutput>(): AsyncGenerator<TOutput> {
      // No-op for unknown connections
    };
  }

  // Streaming tools require a connectionId to route to the right MCP server
  if (!connectionId) {
    throw new Error("connectionId is required for streaming tool calls");
  }

  return async function* <TOutput>(
    toolName: string,
    args: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<TOutput, void, unknown> {
    // Use dedicated streaming endpoint that bypasses MCP JSON-RPC protocol
    const endpoint = `/mcp/${connectionId}/stream/${toolName}`;

    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(args),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      },
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No body received from the server");
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              yield parsed as TOutput;
            } catch {
              console.warn("Failed to parse stream chunk:", line);
            }
          }
        }
      }

      // Handle any remaining data in buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          yield parsed as TOutput;
        } catch {
          // Ignore incomplete final chunk
        }
      }
    } finally {
      reader.releaseLock();
    }
  };
}
