import { RuntimeClass } from "@deco/actors";
import { withActors } from "@deco/actors/hono";
import { endTime, startTime } from "hono/timing";
import type { Handler } from "hono";
import { Hosts } from "@deco/sdk/hosts";
import { AppEnv } from "../utils/context.ts";

export const runtime = new RuntimeClass();

const actorsRoute = withActors(runtime, `/${Hosts.API}/actors`);

export const withActorsMiddleware: Handler<AppEnv> = async (ctx, next) => {
  ctx.set("immutableRes", true);
  startTime(ctx, "actor");
  return await actorsRoute(
    ctx,
    next,
  ).finally(() => endTime(ctx, "actor"));
};
