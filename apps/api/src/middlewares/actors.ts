import { RuntimeClass } from "@deco/actors";
import { withActors } from "@deco/actors/hono";
import { Hosts } from "@deco/sdk/hosts";
import type { Handler } from "hono";
import { endTime, startTime } from "hono/timing";
import type { AppEnv } from "../utils/context.ts";

export const runtime = new RuntimeClass();

// Create actors routes for both API hosts
const actorsRoutePathLegacy = `/${Hosts.API_LEGACY}/actors`;
const actorsRoutePath = `/${Hosts.API}/actors`;

const actorsRouteLegacy = withActors(runtime, actorsRoutePathLegacy);
const actorsRoute = withActors(runtime, actorsRoutePath);

const createActorsHandler =
  (actorsRoute: ReturnType<typeof withActors>): Handler<AppEnv> =>
  async (ctx, next) => {
    ctx.set("immutableRes", true);
    startTime(ctx, "actor");
    return await actorsRoute(
      // deno-lint-ignore no-explicit-any
      ctx as any, // TODO: maybe bump hono version in deco/actors
      next,
    ).finally(() => endTime(ctx, "actor"));
  };

export const withActorsMiddlewareLegacy: Handler<AppEnv> =
  createActorsHandler(actorsRouteLegacy);
export const withActorsMiddleware: Handler<AppEnv> =
  createActorsHandler(actorsRoute);
