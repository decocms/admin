// deno-lint-ignore-file no-explicit-any
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
 * Creates a subscribe method for a resource that returns an async iterator
 * yielding {uri, data} objects as resources are updated via SSE.
 */
function createSubscribeMethod(
  resourceName: string,
  options: CreateStubAPIOptions | undefined,
  connection: MCPConnection,
): (args: { id: string }) => AsyncIterableIterator<{
  uri: string;
  data: unknown;
}> {
  return async function* (args: { id: string }) {
    // Step 1: Call DESCRIBE to get watch endpoint configuration and URI template
    const describeMethodName = `DECO_RESOURCE_${resourceName}_DESCRIBE`;
    const readMethodName = `DECO_RESOURCE_${resourceName}_READ`;

    const debugId = options?.debugId?.();
    const extraHeaders = debugId ? { "x-trace-debug-id": debugId } : undefined;

    // Get describe information
    const client = await createServerClient(
      { connection },
      undefined,
      extraHeaders,
    );

    const describeResult = await client.callTool({
      name: describeMethodName,
      arguments: {},
    });

    if (describeResult.isError) {
      throw new Error(
        `Failed to describe resource ${resourceName}: ${JSON.stringify(
          describeResult.content,
        )}`,
      );
    }

    const describeData = describeResult.structuredContent as {
      uriTemplate?: string;
      features?: {
        watch?: {
          pathname?: string;
        };
      };
    };

    const watchPathname = describeData?.features?.watch?.pathname;
    const uriTemplate = describeData?.uriTemplate;

    if (!watchPathname) {
      throw new Error(
        `Resource ${resourceName} does not support watch functionality`,
      );
    }

    if (!uriTemplate) {
      throw new Error(`Resource ${resourceName} does not provide uriTemplate`);
    }

    // Step 2: Construct URI from template by replacing * with id
    const resourceUri = uriTemplate.replace("*", args.id);

    // Step 3: Construct watch URL and create EventSource
    // Build base URL from connection or options
    let baseUrl: string;
    if (
      connection.type === "HTTP" ||
      connection.type === "SSE" ||
      connection.type === "Websocket"
    ) {
      baseUrl = connection.url;
    } else {
      baseUrl = options?.decoCmsApiUrl || "https://api.decocms.com";
    }

    const watchUrl = new URL(watchPathname, baseUrl);
    watchUrl.searchParams.set("path-filter", resourceUri);

    const eventSource = new EventSource(watchUrl.href);

    // Step 4: Use toAsyncIterator to consume SSE events and enrich with READ data
    const { toAsyncIterator } = await import("./bindings/deconfig/helpers.ts");

    const eventStream = toAsyncIterator<{ uri: string }>(
      eventSource,
      "message",
    );

    // Iterate over SSE events and enrich with full data
    for await (const event of eventStream) {
      const uri = event.uri;

      if (uri) {
        // Call READ to get full resource data
        const readClient = await createServerClient(
          { connection },
          undefined,
          extraHeaders,
        );

        const readResult = await readClient.callTool({
          name: readMethodName,
          arguments: { uri },
        });

        if (readResult.isError) {
          throw new Error(
            `Failed to read resource ${uri}: ${JSON.stringify(readResult.content)}`,
          );
        }

        const readData = readResult.structuredContent as { data: unknown };
        yield { uri, data: readData.data };
      }
    }
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

      // Check if this is a SUBSCRIBE method call
      const subscribeMatch = String(name).match(
        /^DECO_RESOURCE_(.+)_SUBSCRIBE$/,
      );
      if (subscribeMatch) {
        const resourceName = subscribeMatch[1];
        return createSubscribeMethod(resourceName, options, connection);
      }

      async function callToolFn(args: unknown) {
        const debugId = options?.debugId?.();
        const extraHeaders = debugId
          ? { "x-trace-debug-id": debugId }
          : undefined;
        const client = await createServerClient(
          { connection },
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
