import type { CreateStubAPIOptions } from "./mcp.ts";

const getWorkspace = (workspace?: string) => {
  if (
    workspace && workspace.length > 0 &&
    !workspace.includes("/")
  ) {
    return `/shared/${workspace}`;
  }
  return workspace ?? "";
};

// deno-lint-ignore no-explicit-any
const serializeData = (data: any) => {
  if (data?.structuredContent) {
    return JSON.stringify(data.structuredContent);
  }
  if (Array.isArray(data?.content)) {
    return data.content[0]?.text;
  }
  return;
};

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
          const workspace = getWorkspace(options?.workspace);
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
                ...options?.token
                  ? {
                    Authorization: `Bearer ${options.token}`,
                  }
                  : {},
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

          if (!response.ok || error || data?.isError) {
            const message = error || serializeData(data) ||
              "Internal Server Error";
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
