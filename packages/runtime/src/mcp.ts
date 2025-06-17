import { z } from "zod";
import type { MCPConnection } from "./connection.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

const workspaceTools = [{
  name: "INTEGRATIONS_GET",
  inputSchema: z.object({
    id: z.string(),
  }),
  outputSchema: z.object({
    connection: z.object({}),
  }),
}] satisfies ToolBinder<string, unknown, object>[];

// Default fetcher instance with API_SERVER_URL and API_HEADERS
const global = createMCPFetchStub<[]>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forWorkspace: (
      workspace: string,
    ) => MCPClientFetchStub<typeof workspaceTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnectionProvider,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forWorkspace") {
        return (workspace: string) => createMCPFetchStub<[]>({ workspace });
      }
      if (name === "forConnection") {
        return <TDefinition extends readonly ToolBinder[]>(
          connection: MCPConnectionProvider,
        ) => createMCPFetchStub<TDefinition>({ connection });
      }
      return global[name as keyof typeof global];
    },
  },
);

export interface ToolBinder<
  TName extends string = string,
  // deno-lint-ignore no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  name: TName;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  opt?: true;
}
export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export type MCPConnectionProvider =
  | (() => Promise<MCPConnection>)
  | MCPConnection;

export interface CreateStubAPIOptions {
  decoChatApiUrl?: string;
  workspace?: string;
  connection?: MCPConnectionProvider;
  debugId?: () => string;
  getErrorByStatusCode?: (
    statusCode: number,
    message?: string,
    traceId?: string,
  ) => Error;
}

export function createMCPFetchStub<TDefinition extends readonly ToolBinder[]>(
  options?: CreateStubAPIOptions,
): MCPClientFetchStub<TDefinition> {
  return new Proxy<MCPClientFetchStub<TDefinition>>(
    {} as MCPClientFetchStub<TDefinition>,
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
          if (options?.connection && typeof args === "object") {
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
                `http error ${response.status} ${message} ${traceDebugId}`,
              );
            throw err;
          }

          return mapper(data);
        };
      },
    },
  );
}
