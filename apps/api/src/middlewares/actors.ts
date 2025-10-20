import { withActors } from "@deco/actors/hono";
import { Hosts } from "@deco/sdk/hosts";
import type { Handler } from "hono";
import { endTime, startTime } from "hono/timing";
import type { AppEnv } from "../utils/context.ts";
import { runtime, stubFor } from "@deco/sdk/actors";
export { runtime, stubFor };
// Create actors routes for both API hosts
const actorsRoutePathLegacy = `/${Hosts.API_LEGACY}/actors`;
const actorsRoutePath = `/${Hosts.API}/actors`;

const actorsRouteLegacy = withActors(runtime, actorsRoutePathLegacy);
const actorsRoute = withActors(runtime, actorsRoutePath);

export const withActorsMiddleware: Handler<AppEnv> = async (ctx, next) => {
  const actorsMiddleware = ctx.req.path.startsWith(`/${Hosts.API_LEGACY}`)
    ? actorsRouteLegacy
    : actorsRoute;
  ctx.set("immutableRes", true);
  startTime(ctx, "actor");
  return await actorsMiddleware(
    // oxlint-disable-next-line no-explicit-any
    ctx as any,
    next,
  ).finally(() => endTime(ctx, "actor"));
};
