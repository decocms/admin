import type { CreateStubAPIOptions } from "./mcp.ts";

/**
 * The base fetcher used to fetch the MCP from API.
 */
export function createMCPClientProxy<T extends Record<string, unknown>>(
  options?: CreateStubAPIOptions,
): T {
  return new Proxy<T>(
    {} as T,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }

        return async (args: unknown, init?: RequestInit) => {
          const traceDebugId = options?.debugId?.() ?? crypto.randomUUID();
          const workspace = options?.workspace ?? "";
          let payload = args;
          let toolName = name;
          let mapper = (data: unknown) => data;
          if (options?.connection) {
            payload = {
              connection: typeof options.connection === "function"
                ? await options.connection()
                : options.connection,
              params: {
                name: name,
                arguments: args,
              },
            };
            toolName = "INTEGRATIONS_CALL_TOOL";
            mapper = (data) =>
              (data as {
                structuredContent: unknown;
              }).structuredContent;
          }
          const response = await fetch(
            new URL(
              `${workspace}/tools/call/${toolName}`,
              options?.decoChatApiUrl ?? `https://api.deco.chat`,
            ),
            {
              body: JSON.stringify(payload),
              method: "POST",
              credentials: "include",
              ...init,
              headers: {
                "content-type": "application/json",
                ...init?.headers,
                "accept": "application/json",
                "x-trace-debug-id": traceDebugId,
              },
            },
          );

          const { data, error } = await response.json() as {
            data: Record<string, unknown>;
            error: string | undefined;
          };

          if (!response.ok) {
            const message = error || "Internal Server Error";
            const err = options?.getErrorByStatusCode?.(
              response.status,
              message,
              traceDebugId,
            ) ??
              new Error(
                `http error ${response.status} ${
                  JSON.stringify(payload)
                } ${toolName} ${message} ${traceDebugId}`,
              );
            throw err;
          }

          return mapper(data);
        };
      },
    },
  );
}
