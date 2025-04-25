import type { MiddlewareHandler } from "hono";

export const setUserMiddleware: MiddlewareHandler = async (ctx, next) => {
  // TODO: Implement actual user retrieval
  const user = {
    id: "ec1de23c-1e7d-443e-b99c-4c7b1f75f15a",
    email: "gimenes@deco.cx",
  };

  if (user) {
    ctx.set("user", user);
  }

  await next();
};
