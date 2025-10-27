import type { MiddlewareHandler } from "hono";
import { endTime, startTime } from "hono/timing";
import { getUser } from "../auth/index.ts";
import type { AppEnv } from "../utils/context.ts";

export const setUserMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  startTime(ctx, "get-user");

  const user = await getUser(ctx);
  if (user) {
    ctx.set("user", user);
    // Pass cache status for logging
    const cacheStatus = (user as unknown as { _cacheStatus?: string })
      ._cacheStatus;
    if (cacheStatus) {
      // @ts-expect-error - cacheStatus is a custom property not in Vars type
      ctx.set("cacheStatus", `auth:${cacheStatus}`);
    }
  }

  endTime(ctx, "get-user");

  await next();
};
