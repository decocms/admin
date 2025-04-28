import { User } from "@deco/sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk";
import { Context } from "hono";
import { env } from "hono/adapter";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { Client } from "../db/client.ts";
import { Database } from "../db/schema.ts";

export type AppEnv = {
  Variables: {
    db: Client;
    user: User;
  };
};

export type AppContext = Context<AppEnv>;

export interface Variables {
  db: Database;
  user: User;
}

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
  const { SUPABASE_URL, SUPABASE_KEY } = env(ctx);

  if (typeof SUPABASE_URL !== "string" || typeof SUPABASE_KEY !== "string") {
    throw new Error("Missing environment variables");
  }

  return { SUPABASE_URL, SUPABASE_KEY };
};

export const createApiHandler = <
  T extends z.ZodType = z.ZodType,
  R extends object = object,
>(definition: {
  name: string;
  description: string;
  schema: T;
  handler: (props: z.infer<T>, c: AppContext) => Promise<R>;
}) => ({
  ...definition,
  handler: async (props: z.infer<T>): Promise<CallToolResult> => {
    try {
      const response = await definition.handler(props, State.active());

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
  },
});

export type ApiHandler = ReturnType<typeof createApiHandler>;

const asyncLocalStorage = new AsyncLocalStorage<AppContext>();

export const State = {
  active: () => {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("Missing context, did you forget to call State.bind?");
    }

    return store;
  },
  bind: <R, TArgs extends unknown[]>(
    ctx: AppContext,
    f: (...args: TArgs) => R,
  ): (...args: TArgs) => R =>
  (...args: TArgs): R => asyncLocalStorage.run(ctx, f, ...args),
};
