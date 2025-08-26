import { getActorLocator, RuntimeClass } from "@deco/actors";
import { withActors } from "@deco/actors/hono";
import { Hosts } from "@deco/sdk/hosts";
import type { Handler } from "hono";
import { endTime, startTime } from "hono/timing";
import { AIAgent2 } from "packages/ai/src/agent.ts";
import type { AppEnv } from "../utils/context.ts";

export const runtime = new RuntimeClass();

const storage = (() => {
  const map = new Map<string, string>();

  return {
    get: async (key: string) => {
      return map.get(key) ?? null;
    },
    set: async (key: string, value: string) => {
      map.set(key, value);
    },
    delete: async (key: string) => {
      map.delete(key);
    },
    put: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
})();

const actorsRoutePath = `/${Hosts.API}/actors`;
const actorsRoute = withActors(runtime, actorsRoutePath);

export const withActorsMiddleware: Handler<AppEnv> = async (ctx, next) => {
  ctx.set("immutableRes", true);

  const shouldUseDebugStream = ctx.req.header("x-trace-debug-id") === "trace";

  if (shouldUseDebugStream) {
    const locator = getActorLocator(ctx.req.raw);

    if (locator?.name === "AIAgent" && locator.method === "stream") {
      const { args, metadata } = await ctx.req.json();

      const promise = Promise.withResolvers();

      const aiAgent = new AIAgent2(
        {
          metadata,
          // @ts-ignore debugging only
          id: locator.id,
          // @ts-ignore debugging only
          stub: ctx.var.stub,
          // @ts-ignore debugging only
          storage: storage,
          // @ts-ignore debugging only
          blockConcurrencyWhile: (cb: () => Promise<void>) => {
            return cb().then(() => {
              // @ts-ignore debugging only
              promise.resolve();
            });
          },
        },
        ctx.env,
      );
      await promise.promise;

      // @ts-ignore debugging only
      ctx.res = await aiAgent.stream(...args);
      return;
    }
  }

  startTime(ctx, "actor");
  return await actorsRoute(
    // deno-lint-ignore no-explicit-any
    ctx as any, // TODO: maybe bump hono version in deco/actors
    next,
  ).finally(() => endTime(ctx, "actor"));
};
