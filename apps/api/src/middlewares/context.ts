import type { MiddlewareHandler } from "hono";
import { client } from "../db/client.ts";
import { AppEnv } from "../utils/context.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  ctx.set("db", client);

  await next();
};
