// deno-lint-ignore-file no-explicit-any
import { API_SERVER_URL, getTraceDebugId } from "../constants.ts";
import { getErrorByStatusCode } from "../errors.ts";
import type { ApiHandler, AppContext } from "./context.ts";

export type MCPClientStub<TDefinition extends readonly ApiHandler[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
  ) => Promise<Awaited<ReturnType<K["handler"]>>>;
};

export type MCPClientFetchStub<TDefinition extends readonly ApiHandler[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
    init?: RequestInit,
  ) => Promise<
    {
      data: Awaited<ReturnType<K["handler"]>>;
      error?: undefined;
      status: number;
      ok: true;
    } | {
      data: undefined;
      error: { message: string };
      status: number;
      ok: false;
    }
  >;
};

export interface CreateStubHandlerOptions<
  TDefinition extends readonly ApiHandler[],
> {
  tools: TDefinition;
  context?: AppContext;
}

export interface CreateStubAPIOptions {
  workspace?: string;
}

export type CreateStubOptions<TDefinition extends readonly ApiHandler[]> =
  | CreateStubHandlerOptions<TDefinition>
  | CreateStubAPIOptions;

export function isStubHandlerOptions<TDefinition extends readonly ApiHandler[]>(
  options?: CreateStubOptions<TDefinition>,
): options is CreateStubHandlerOptions<TDefinition> {
  return typeof options === "object" && "tools" in options;
}

export function createMCPFetchStub<TDefinition extends readonly ApiHandler[]>(
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
          const traceDebugId = getTraceDebugId();
          const workspace = options?.workspace ?? "";
          const response = await fetch(
            new URL(
              `${workspace}/tools/call/${name}`.split("/").filter(Boolean).join(
                "/",
              ),
              API_SERVER_URL,
            ),
            {
              body: JSON.stringify(args),
              method: "POST",
              credentials: "include",
              ...init,
              headers: {
                ...init?.headers,
                "x-trace-debug-id": traceDebugId,
              },
            },
          );

          const data = await response.json() as any;

          if (!response.ok) {
            throw getErrorByStatusCode(
              response.status,
              data.error || "Internal Server Error",
              traceDebugId,
            );
          }

          return {
            ...data,
            status: response.status,
            ok: response.ok,
          };
        };
      },
    },
  );
}
