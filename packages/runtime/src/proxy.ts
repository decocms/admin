/* oxlint-disable no-explicit-any */
import type { ToolExecutionContext as _ToolExecutionContext } from "@mastra/core";
import { convertJsonSchemaToZod } from "zod-from-json-schema";
import { MCPConnection } from "./connection.ts";
import { createServerClient } from "./mcp-client.ts";
import type { CreateStubAPIOptions } from "./mcp.ts";

const getWorkspace = (workspace?: string) => {
  if (workspace && workspace.length > 0 && !workspace.includes("/")) {
    return `/shared/${workspace}`;
  }
  return workspace ?? "";
};

const safeParse = (content: string) => {
  try {
    return JSON.parse(content as string);
  } catch {
    return content;
  }
};

const toolsMap = new Map<
  string,
  Promise<
    Array<{
      name: string;
      inputSchema: any;
      outputSchema?: any;
      description: string;
    }>
  >
>();

/**
 * The base fetcher used to fetch the MCP from API.
 */
export function createMCPClientProxy<T extends Record<string, unknown>>(
  options?: CreateStubAPIOptions,
): T {
  if (typeof options?.connection === "function") {
    // [DEPRECATED] Passing a function as 'connection' is deprecated and will be removed in a future release.
    // Please provide a connection object instead.
    throw new Error(
      "Deprecation Notice: Passing a function as 'connection' is deprecated and will be removed in a future release. Please provide a connection object instead.",
    );
  }

  const mcpPath = options?.mcpPath ?? "/mcp";

  const connection: MCPConnection = options?.connection || {
    type: "HTTP",
    token: options?.token,
    url: new URL(
      `${getWorkspace(options?.workspace)}${mcpPath}`,
      options?.decoCmsApiUrl ?? `https://api.decocms.com`,
    ).href,
  };

  return new Proxy<T>({} as T, {
    get(_, name) {
      if (name === "toJSON") {
        return null;
      }
      if (typeof name !== "string") {
        throw new Error("Name must be a string");
      }
      async function callToolFn(args: unknown) {
        const debugId = options?.debugId?.();
        const extraHeaders = debugId
          ? { "x-trace-debug-id": debugId }
          : undefined;

        // Create a connection with the tool name in the URL path for better logging
        // Only modify connections that have a URL property (HTTP, SSE, Websocket)
        // and only when supportsToolName is explicitly enabled
        let toolConnection = connection;
        if (
          options?.supportsToolName &&
          "url" in connection &&
          typeof connection.url === "string"
        ) {
          toolConnection = {
            ...connection,
            url: connection.url.endsWith("/")
              ? `${connection.url}tool/${String(name)}`
              : `${connection.url}/tool/${String(name)}`,
          };
        }

        const client = await createServerClient(
          { connection: toolConnection },
          undefined,
          extraHeaders,
        );

        const { structuredContent, isError, content } = await client.callTool(
          {
            name: String(name),
            arguments: args as Record<string, unknown>,
          },
          undefined,
          {
            timeout: 3000000,
          },
        );

        if (isError) {
          // @ts-expect-error - content is not typed
          const maybeErrorMessage = content?.[0]?.text;
          const error =
            typeof maybeErrorMessage === "string"
              ? safeParse(maybeErrorMessage)
              : null;

          const throwableError =
            error?.code && typeof options?.getErrorByStatusCode === "function"
              ? options.getErrorByStatusCode(
                  error.code,
                  error.message,
                  error.traceId,
                )
              : null;

          if (throwableError) {
            throw throwableError;
          }

          throw new Error(
            `Tool ${String(name)} returned an error: ${JSON.stringify(
              structuredContent ?? content,
            )}`,
          );
        }
        return structuredContent;
      }

      const listToolsFn = async () => {
        const client = await createServerClient({ connection });
        const { tools } = await client.listTools();

        return tools as {
          name: string;
          inputSchema: any;
          outputSchema?: any;
          description: string;
        }[];
      };

      async function listToolsOnce() {
        const conn = connection;
        const key = JSON.stringify(conn);

        try {
          if (!toolsMap.has(key)) {
            toolsMap.set(key, listToolsFn());
          }

          return await toolsMap.get(key)!;
        } catch (error) {
          console.error("Failed to list tools", error);

          toolsMap.delete(key);
          return;
        }
      }
      callToolFn.asTool = async () => {
        const tools = (await listToolsOnce()) ?? [];
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
          throw new Error(`Tool ${name} not found`);
        }

        return {
          ...tool,
          id: tool.name,
          inputSchema: tool.inputSchema
            ? convertJsonSchemaToZod(tool.inputSchema)
            : undefined,
          outputSchema: tool.outputSchema
            ? convertJsonSchemaToZod(tool.outputSchema)
            : undefined,
          execute: (input: any) => {
            return callToolFn(input.context);
          },
        };
      };
      return callToolFn;
    },
  });
}
