import { RuntimeClass } from "@deco/actors";
import { withActors } from "@deco/actors/hono";
import { Hosts } from "@deco/sdk/hosts";
import type { Handler } from "hono";
import { endTime, startTime } from "hono/timing";
import type { AppEnv } from "../utils/context.ts";

export const runtime = new RuntimeClass();

const actorsRoutePath = `/${Hosts.API}/actors`;
const actorsRoute = withActors(runtime, actorsRoutePath);

export const withActorsMiddleware: Handler<AppEnv> = async (ctx, next) => {
  ctx.set("immutableRes", true);
  startTime(ctx, "actor");
  return await actorsRoute(
    ctx,
    next,
  ).finally(() => endTime(ctx, "actor"));
};
