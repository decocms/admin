import type { CallToolResult } from "@modelcontextprotocol/sdk";
import { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { Client } from "../db/client.ts";
import { type User as SupaUser } from "npm:@supabase/supabase-js@^2.49.4";

export type AppEnv = {
  Variables: {
    db: Client;
    user: SupaUser;
  };
  Bindings: {
    SUPABASE_URL?: string;
    SUPABASE_SERVER_TOKEN?: string;
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
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN, VITE_USE_LOCAL_BACKEND } =
    honoEnv(ctx);

  if (
    typeof SUPABASE_URL !== "string" ||
    typeof SUPABASE_SERVER_TOKEN !== "string"
  ) {
    throw new Error("Missing environment variables");
  }

  return { SUPABASE_URL, SUPABASE_SERVER_TOKEN, VITE_USE_LOCAL_BACKEND };
};

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

export const createAIHandler =
  // deno-lint-ignore no-explicit-any
  (cb: (...args: any[]) => Promise<any>) =>
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

export const createApiHandler = <
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
>(definition: {
  name: string;
  description: string;
  schema: T;
  handler: (props: z.infer<T>, c: AppContext) => Promise<R> | R;
}) => ({
  ...definition,
  handler: (props: z.infer<T>): Promise<R> | R =>
    definition.handler(props, State.getStore()),
});

export type ApiHandler = ReturnType<typeof createApiHandler>;

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
