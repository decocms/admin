// deno-lint-ignore-file no-explicit-any
import { ActorConstructor, StubFactory } from "@deco/actors";
import { AIAgent, Trigger } from "@deco/ai/actors";
import { Client } from "@deco/sdk/storage";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.d.ts";
import { type User as SupaUser } from "@supabase/supabase-js";
import Cloudflare from "cloudflare";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { ForbiddenError } from "../errors.ts";
import { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

export interface Vars {
  params: Record<string, string>;
  workspace?: {
    root: string;
    slug: string;
    value: string;
  };
  cookie?: string;
  db: Client;
  user: SupaUser;
  policy: PolicyClient;
  authorization: AuthorizationClient;
  isLocal?: boolean;
  cf: Cloudflare;
  immutableRes?: boolean;
  stub: <
    Constructor extends
      | ActorConstructor<Trigger>
      | ActorConstructor<AIAgent>,
  >(
    c: Constructor,
  ) => StubFactory<InstanceType<Constructor>>;
}

export type EnvVars = z.infer<typeof envSchema>;

export type AppContext = Vars & {
  envVars: EnvVars;
};

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

const envSchema = z.object({
  CF_DISPATCH_NAMESPACE: z.string().readonly(),
  CF_ACCOUNT_ID: z.string().readonly(),
  CF_API_TOKEN: z.string().readonly(),
  CF_R2_ACCESS_KEY_ID: z.any().optional().readonly(),
  CF_R2_SECRET_ACCESS_KEY: z.any().optional().readonly(),
  VITE_USE_LOCAL_BACKEND: z.any().optional().readonly(),
  SUPABASE_URL: z.string().readonly(),
  SUPABASE_SERVER_TOKEN: z.string().readonly(),
  TURSO_GROUP_DATABASE_TOKEN: z.string().readonly(),
  TURSO_ORGANIZATION: z.string().readonly(),
  RESEND_API_KEY: z.any().optional().readonly(),
  OPENROUTER_API_KEY: z.string().readonly(),
  TURSO_ADMIN_TOKEN: z.any().optional().readonly(),
  OPENAI_API_KEY: z.any().optional().readonly(),
});

export const getEnv = (ctx: AppContext): EnvVars =>
  envSchema.parse(ctx.envVars);

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

export const createAIHandler =
  (cb: (...args: any[]) => Promise<any> | any) =>
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
  TAppContext extends AppContext = AppContext,
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
  THandler extends (
    props: z.infer<T>,
    c: TAppContext,
  ) => Promise<R> | R = (
    props: z.infer<T>,
    c: TAppContext,
  ) => Promise<R> | R,
  CanAccessHandler extends (
    name: TName,
    props: z.infer<T>,
    c: AppContext,
  ) => Promise<boolean> = (
    name: TName,
    props: z.infer<T>,
    c: AppContext,
  ) => Promise<boolean>,
> {
  group?: string;
  name: TName;
  description: string;
  schema: T;
  handler: THandler;
  canAccess: CanAccessHandler;
}

export interface ApiHandler<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
  THandler extends (props: z.infer<T>) => Promise<R> | R = (
    props: z.infer<T>,
  ) => Promise<R> | R,
> {
  group?: string;
  name: TName;
  description: string;
  schema: T;
  handler: THandler;
}
export const createApiHandlerFactory = <
  TAppContext extends AppContext = AppContext,
>(contextFactory: (c: AppContext) => TAppContext, group?: string) =>
<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object | boolean,
  THandler extends (props: z.infer<T>, c: TAppContext) => Promise<R> | R = (
    props: z.infer<T>,
    c: TAppContext,
  ) => Promise<R> | R,
>(
  definition: ApiHandlerDefinition<TAppContext, TName, T, R, THandler>,
): ApiHandler<
  TName,
  T,
  R,
  (props: Parameters<THandler>[0]) => Promise<Awaited<ReturnType<THandler>>>
> => ({
  group,
  ...definition,
  handler: async (
    props: Parameters<THandler>[0],
  ): Promise<Awaited<ReturnType<THandler>>> => {
    const context = contextFactory(State.getStore());

    const hasAccess = await definition.canAccess?.(
      definition.name,
      props,
      context,
    );
    if (!hasAccess) {
      throw new ForbiddenError(
        `User cannot access this tool ${definition.name}`,
      );
    }

    return await definition.handler(props, context) as Awaited<
      ReturnType<
        THandler
      >
    >;
  },
});

export const createApiHandler = createApiHandlerFactory<AppContext>((c) => c);

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

export * from "./stub.ts";
