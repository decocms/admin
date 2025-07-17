// Custom error classes for different HTTP status codes
export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "ClientError";
  }
}

export class ServerError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "ServerError";
  }
}

export class RedirectError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response,
    public location?: string,
  ) {
    super(message);
    this.name = "RedirectError";
  }
}

type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any ? (
      args: Parameters<T[K]>[0],
      init?: RequestInit,
    ) => Promise<Awaited<ReturnType<T[K]>>>
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

        // Check response status before parsing JSON
        if (!response.ok) {
          const status = response.status;

          // Handle redirects (3xx)
          if (status >= 300 && status < 400) {
            throw new RedirectError(
              `Redirect response received: ${status} ${response.statusText}`,
              status,
              response,
              response.headers.get("location") ?? undefined,
            );
          }

          // Handle client errors (4xx)
          if (status >= 400 && status < 500) {
            throw new ClientError(
              `Client error: ${status} ${response.statusText}`,
              status,
              response,
            );
          }

          // Handle server errors (5xx)
          if (status >= 500) {
            throw new ServerError(
              `Internal server error: ${status} ${response.statusText}`,
              status,
              response,
            );
          }
        }

        return response.json();
      };
    },
  }) as MCPClient<T>;
};
