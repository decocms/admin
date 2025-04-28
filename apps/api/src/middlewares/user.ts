import type { MiddlewareHandler } from "hono";
import { getUser } from "../auth/index.ts";
import { AppEnv } from "../utils/context.ts";

export const setUserMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const user = await getUser(ctx);

  if (user) {
    ctx.set("user", user);
  }

  await next();
};
