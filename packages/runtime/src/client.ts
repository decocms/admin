import { toAsyncIterator } from "./bindings/deconfig/helpers.ts";
// Extract resource name from DECO_RESOURCE_${NAME}_READ pattern
type ExtractResourceName<K> = K extends `DECO_RESOURCE_${infer Name}_READ`
  ? Name
  : never;

// Generate SUBSCRIBE method name from resource name
type SubscribeMethodName<Name extends string> =
  `DECO_RESOURCE_${Name}_SUBSCRIBE`;

// Extract data type from READ method return type
type ExtractReadData<T> = T extends Promise<{ data: infer D }>
  ? D
  : T extends { data: infer D }
    ? D
    : never;

// Generate all SUBSCRIBE method names for a given type
type SubscribeMethods<T> = {
  [K in keyof T as K extends `DECO_RESOURCE_${string}_READ`
    ? SubscribeMethodName<ExtractResourceName<K>>
    : never]: K extends `DECO_RESOURCE_${string}_READ`
    ? // deno-lint-ignore no-explicit-any
      T[K] extends (...args: any) => any
      ? (args: { id: string } | { uri: string }) => AsyncIterableIterator<{
          uri: string;
          data: ExtractReadData<Awaited<ReturnType<T[K]>>>;
        }>
      : never
    : never;
};

export type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any
    ? (
        args: Parameters<T[K]>[0],
        init?: CustomInit,
      ) => Promise<Awaited<ReturnType<T[K]>>>
    : never;
} & SubscribeMethods<T>;

export type CustomInit = RequestInit & {
  handleResponse?: (response: Response) => Promise<unknown>;
};

export const DECO_MCP_CLIENT_HEADER = "X-Deco-MCP-Client";

export const DEFAULT_INIT: CustomInit = {
  credentials: "include",
  headers: {
    [DECO_MCP_CLIENT_HEADER]: "true",
  },
};

/**
 * Helper function to call an MCP tool via fetch
 */
async function callMCPTool<T = unknown>(
  methodName: string,
  args: unknown,
  init?: CustomInit,
): Promise<T> {
  const mergedInit: CustomInit = {
    ...init,
    headers: {
      ...DEFAULT_INIT.headers,
      ...init?.headers,
    },
  };

  const response = await fetch(`/mcp/call-tool/${methodName}`, {
    method: "POST",
    body: JSON.stringify(args),
    credentials: "include",
    ...mergedInit,
  });

  if (!response.ok) {
    throw new Error(`Failed to call ${methodName}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Creates a subscribe method for a resource that returns an async iterator
 * yielding {uri, data} objects as resources are updated.
 */
function createSubscribeMethod(
  resourceName: string,
  init?: CustomInit,
): (args: { id: string }) => AsyncIterableIterator<{
  uri: string;
  data: unknown;
}> {
  return async function* (args: { id: string } | { uri: string }) {
    // Step 1: Call DESCRIBE to get watch endpoint configuration and URI template
    const describeMethodName = `DECO_RESOURCE_${resourceName}_DESCRIBE`;
    const readMethodName = `DECO_RESOURCE_${resourceName}_READ`;

    // Get describe information
    const describeData = await callMCPTool<{
      uriTemplate?: string;
      features?: {
        watch?: {
          pathname?: string;
        };
      };
    }>(describeMethodName, {}, init);

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
    const resourceUri =
      "uri" in args ? args.uri : uriTemplate.replace("*", args.id);

    // Step 3: Construct watch URL and create EventSource
    const watchUrl = new URL(watchPathname, globalThis.location.origin);
    watchUrl.searchParams.set("uri", resourceUri);

    const eventSource = new EventSource(watchUrl.href);

    // Step 4: Use toAsyncIterator to consume SSE events and enrich with READ data
    const eventStream = toAsyncIterator<{ uri: string }>(
      eventSource,
      "message",
    );

    // Iterate over SSE events and enrich with full data
    for await (const event of eventStream) {
      const uri = event.uri;

      if (uri) {
        // Call READ to get full resource data
        const readData = await callMCPTool<{ data: unknown }>(
          readMethodName,
          { uri },
          init,
        );

        yield { uri, data: readData.data };
      }
    }
  };
}

export const createClient = <T>(init?: CustomInit): MCPClient<T> => {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        const propStr = String(prop);

        // Check if this is a SUBSCRIBE method call
        const subscribeMatch = propStr.match(/^DECO_RESOURCE_(.+)_SUBSCRIBE$/);
        if (subscribeMatch) {
          const resourceName = subscribeMatch[1];
          return createSubscribeMethod(resourceName, init);
        }

        // Regular method call
        return async (args: unknown, innerInit?: CustomInit) => {
          const mergedInit: CustomInit = {
            ...init,
            ...innerInit,
            headers: {
              ...DEFAULT_INIT.headers,
              ...init?.headers,
              ...innerInit?.headers,
            },
          };

          const response = await fetch(`/mcp/call-tool/${String(prop)}`, {
            method: "POST",
            body: JSON.stringify(args),
            credentials: "include",
            ...mergedInit,
          });

          if (typeof mergedInit.handleResponse === "function") {
            return mergedInit.handleResponse(response);
          }

          return response.json();
        };
      },
    },
  ) as MCPClient<T>;
};
