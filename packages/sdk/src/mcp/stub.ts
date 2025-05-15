// deno-lint-ignore-file no-explicit-any
import { API_SERVER_URL, getTraceDebugId } from "../constants.ts";
import { type ApiHandler } from "./context.ts";

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

export function createMCPToolsStub<TDefinition extends readonly ApiHandler[]>(
  options: CreateStubHandlerOptions<TDefinition>,
): MCPClientStub<TDefinition> {
  return new Proxy<MCPClientStub<TDefinition>>(
    {} as MCPClientStub<TDefinition>,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }
        const toolMap = new Map<string, ApiHandler>(
          options.tools.map((h) => [h.name, h]),
        );
        return (props: unknown) => {
          const tool = toolMap.get(name);
          if (!tool) {
            throw new Error(`Tool ${name} not found`);
          }
          return tool.handler(props);
        };
      },
    },
  );
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

        return (args: unknown, init?: RequestInit) => {
          const workspace = options?.workspace ?? "";
          return fetch(
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
                "x-trace-debug-id": getTraceDebugId(),
              },
            },
          ).then(async (r) => {
            const data = await r.json() as any;
            return {
              ...data,
              status: r.status,
              ok: r.ok,
            };
          });
        };
      },
    },
  );
}
