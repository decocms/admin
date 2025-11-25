import type { ToolBinder } from "@/core/define-tool";
import type z from "zod/v3";
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

export const fetcher = new Proxy({} as MeshClient, {
  get(_, prop) {
    return async (params: Record<string, unknown>, init?: RequestInit) => {
      const tool = prop;

      if (typeof tool !== "string") {
        throw new Error("Tool name must be a string");
      }

      const response = await fetch(`/mcp`, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: tool,
            arguments: params,
          },
        }),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        ...init,
      });

      const json = await parseSSEResponseAsJson(response);

      if (json.result.isError) {
        throw new Error(json.result.content[0].text);
      }

      return json.result.structuredContent;
    };
  },
}) as MeshClient;

/**
 * Create a tool caller for a specific connection
 * Routes through mesh backend at /mcp/:connectionId
 */
export function createConnectionToolCaller(connectionId: string) {
  return async (toolName: string, args: unknown) => {
    const response = await fetch(`/mcp/${connectionId}`, {
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
