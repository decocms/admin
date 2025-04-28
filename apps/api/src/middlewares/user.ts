import type { User } from "@deco/sdk";
import type { MiddlewareHandler } from "hono";
import { getUser } from "../auth/index.ts";
import { AppEnv } from "../utils/context.ts";

export const setUserMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const user = false ? await getUser(ctx) : {
    id: "ec1de23c-1e7d-443e-b99c-4c7b1f75f15a",
    email: "gimenes@deco.cx",
  } as User;

  if (user) {
    ctx.set("user", user);
  }

  await next();
};
