type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any ? (
      args: Parameters<T[K]>[0],
      init?: RequestInit,
    ) => Promise<ReturnType<T[K]>>
    : never;
};

export const createClient = <T>(init?: RequestInit): MCPClient<T> => {
  return new Proxy({}, {
    get: (_, prop) => {
      return async (args: unknown, innerInit?: RequestInit) => {
        const response = await fetch(`/mcp/call-tool/${String(prop)}`, {
          method: "POST",
          body: JSON.stringify(args),
          credentials: "include",
          ...init,
          ...innerInit,
        });
        return response.json();
      };
    },
  }) as MCPClient<T>;
};
