import { Context } from "hono";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

type AppContext = Context;

export const createApiHandler = <
  T extends z.ZodType = z.ZodType,
  R extends object = object,
>(props: {
  name: string;
  description: string;
  schema: T;
  handler: (props: z.infer<T>, c: AppContext) => Promise<R>;
}) => ({
  ...props,
  handler: (props: z.infer<T>) => props.handler(props, State.active()),
});

export type ApiHandler = ReturnType<typeof createApiHandler>;

export const getEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

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
