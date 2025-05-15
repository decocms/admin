import { ActorConstructor, StubFactory } from "@deco/actors";
import { AIAgent, Trigger } from "@deco/ai/actors";
import { API_SERVER_URL, getTraceDebugId } from "@deco/sdk";
import { Client } from "@deco/sdk/storage";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.d.ts";
import { type User as SupaUser } from "@supabase/supabase-js";
import Cloudflare from "cloudflare";
import { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import type { TimingVariables } from "hono/timing";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

export type AppEnv = {
  Variables: {
    db: Client;
    user: SupaUser;
    cf: Cloudflare;
    immutableRes?: boolean;
    stub: <
      Constructor extends
        | ActorConstructor<Trigger>
        | ActorConstructor<AIAgent>,
    >(
      c: Constructor,
    ) => StubFactory<InstanceType<Constructor>>;
  } & TimingVariables;
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_SERVER_TOKEN: string;
    TURSO_GROUP_DATABASE_TOKEN: string;
    TURSO_ORGANIZATION: string;
    CF_ACCOUNT_ID: string;
    CF_API_TOKEN: string;
    CF_DISPATCH_NAMESPACE: string;
    PROD_DISPATCHER: { get: (script: string) => { fetch: typeof fetch } };
  };
};

export type AppContext = Context<AppEnv>;

const isErrorLike = (error: unknown): error is Error =>
  Boolean((error as Error)?.message);

export const serializeError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (isErrorLike(error)) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const getEnv = (ctx: AppContext) => {
  const {
    CF_DISPATCH_NAMESPACE,
    CF_ACCOUNT_ID,
    CF_API_TOKEN,
    VITE_USE_LOCAL_BACKEND,
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    TURSO_GROUP_DATABASE_TOKEN,
    TURSO_ORGANIZATION,
    RESEND_API_KEY,
  } = honoEnv(ctx);

  if (
    typeof CF_ACCOUNT_ID !== "string" ||
    typeof SUPABASE_URL !== "string" ||
    typeof SUPABASE_SERVER_TOKEN !== "string" ||
    typeof CF_API_TOKEN !== "string" ||
    typeof CF_DISPATCH_NAMESPACE !== "string" ||
    typeof TURSO_GROUP_DATABASE_TOKEN !== "string" ||
    typeof TURSO_ORGANIZATION !== "string"
  ) {
    throw new Error("Missing environment variables");
  }

  return {
    CF_ACCOUNT_ID,
    CF_API_TOKEN,
    CF_DISPATCH_NAMESPACE,
    VITE_USE_LOCAL_BACKEND,
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    TURSO_GROUP_DATABASE_TOKEN,
    TURSO_ORGANIZATION,
    RESEND_API_KEY,
  };
};

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

export const createAIHandler =
  // deno-lint-ignore no-explicit-any
  (cb: (...args: any[]) => Promise<any> | any) =>
  // deno-lint-ignore no-explicit-any
  async (...args: any[]): Promise<CallToolResult> => {
    try {
      const response = await cb(...args);

      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(response) }],
      };
    } catch (error) {
      console.error(error);

      return {
        isError: true,
        content: [{ type: "text", text: serializeError(error) }],
      };
    }
  };

export interface ApiHandlerDefinition<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
> {
  name: TName;
  description: string;
  schema: T;
  handler: (props: z.infer<T>, c: AppContext) => Promise<R> | R;
}

export const createApiHandler = <
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
>(definition: ApiHandlerDefinition<TName, T, R>) => ({
  ...definition,
  handler: (props: z.infer<T>): Promise<R> | R =>
    definition.handler(props, State.getStore()),
});

export type ApiHandler<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object | boolean,
> = ReturnType<typeof createApiHandler<TName, T, R>>;

export type MCPDefinition = ApiHandler[];

const asyncLocalStorage = new AsyncLocalStorage<AppContext>();

export const State = {
  getStore: () => {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("Missing context, did you forget to call State.bind?");
    }

    return store;
  },
  run: <R, TArgs extends unknown[]>(
    ctx: AppContext,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};

export type MCPClientStub<TDefinition extends readonly ApiHandler[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
  ) => Promise<Awaited<ReturnType<K["handler"]>>>;
};

export type MCPClientFetchStub<TDefinition extends readonly ApiHandler[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
    init?: RequestInit,
  ) => Promise<Awaited<ReturnType<K["handler"]>>>;
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

/**
 * @param fetcher the function that will be used to invoke the tool
 * @returns a client that can be used to call the api
 */
export const createMCPStub = <
  TDefinition extends readonly ApiHandler[] = readonly ApiHandler[],
  TOptions extends CreateStubOptions<TDefinition> = CreateStubOptions<
    TDefinition
  >,
>(
  options?: TOptions,
): TOptions extends CreateStubHandlerOptions<TDefinition>
  ? MCPClientStub<TDefinition>
  : MCPClientFetchStub<TDefinition> => {
  if (options && "tools" in options) {
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
          );
        };
      },
    },
  );
};
