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

// In-flight request deduplication cache
const inflightCalls = new Map<string, Promise<any>>();

// Default timeout for tool calls (3 minutes)
const DEFAULT_TOOL_TIMEOUT = 180_000;

// Periodic cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 300_000;

// Maximum age for stale entries (10 minutes)
const MAX_ENTRY_AGE = 600_000;

// Track entry creation times for cleanup
const entryTimestamps = new Map<string, number>();

// Periodic cleanup of stale in-flight calls to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of entryTimestamps.entries()) {
    if (now - timestamp > MAX_ENTRY_AGE) {
      inflightCalls.delete(key);
      entryTimestamps.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

// Generate cache key for deduplication
const getCacheKey = (toolName: string, args: unknown): string => {
  return `${toolName}:${JSON.stringify(args)}`;
};

// Add tool name to URL path for better logging and CDN filtering
function addToolNameToUrl(connection: any, toolName: string): any {
  if (!("url" in connection) || !connection.url) {
    return connection;
  }

  const url = new URL(connection.url);
  // Change from ?tool=NAME to /tool/NAME for easier CDN filtering
  url.pathname = url.pathname.replace(/\/$/, "") + `/tool/${toolName}`;

  return {
    ...connection,
    url: url.href,
  };
}

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
        // Check for in-flight request with same tool name and args
        const cacheKey = getCacheKey(String(name), args);
        const existingCall = inflightCalls.get(cacheKey);
        if (existingCall) {
          return existingCall;
        }

        // Create new request with timeout
        const requestPromise = withTimeout(
          (async () => {
            const debugId = options?.debugId?.();
            const extraHeaders = debugId
              ? { "x-trace-debug-id": debugId }
              : undefined;

            // Add tool name to URL path for better logging and CDN filtering
            const connectionWithTool = addToolNameToUrl(
              connection,
              String(name),
            );

            const client = await createServerClient(
              { connection: connectionWithTool },
              undefined,
              extraHeaders,
            );

            try {
              const { structuredContent, isError, content } =
                await client.callTool(
                  {
                    name: String(name),
                    arguments: args as Record<string, unknown>,
                  },
                  undefined,
                  {
                    timeout: 3000000,
                  },
                );

              return { structuredContent, isError, content };
            } finally {
              // Properly dispose of the MCP client to avoid RPC leaks
              await client.close();
            }
          })(),
          DEFAULT_TOOL_TIMEOUT,
        );

        // Store in cache with timestamp
        inflightCalls.set(cacheKey, requestPromise);
        entryTimestamps.set(cacheKey, Date.now());

        // Clean up after request completes
        try {
          const result = await requestPromise;
          return result;
        } finally {
          inflightCalls.delete(cacheKey);
          entryTimestamps.delete(cacheKey);
        }
      }

      // Main tool call wrapper
      async function mainToolCall(args: unknown) {
        const callResult = await callToolFn(args);
        const { structuredContent, isError, content } = callResult;

        if (isError) {
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
        try {
          const { tools } = await client.listTools();

          return tools as {
            name: string;
            inputSchema: any;
            outputSchema?: any;
            description: string;
          }[];
        } finally {
          // Properly dispose of the MCP client to avoid RPC leaks
          await client.close();
        }
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
      mainToolCall.asTool = async () => {
        const tools = (await listToolsOnce()) ?? [];
        const tool = tools.find((t) => t.name === String(name));
        if (!tool) {
          throw new Error(`Tool ${String(name)} not found`);
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
            return mainToolCall(input.context);
          },
        };
      };
      return mainToolCall;
    },
  });
}
