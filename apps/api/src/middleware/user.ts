import type { MiddlewareHandler } from "hono";
import { getUser } from "../auth/index.ts";

export const setUserMiddleware: MiddlewareHandler = async (ctx, next) => {
  // pegar o user,
  const user = await getUser(ctx.req.raw);
  ctx.set("user", user);
  return await next();
};
