export type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any
    ? (
        args: Parameters<T[K]>[0],
        init?: CustomInit,
      ) => Promise<Awaited<ReturnType<T[K]>>>
    : never;
};

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

export const createClient = <T>(init?: CustomInit): MCPClient<T> => {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
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
