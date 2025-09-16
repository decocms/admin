import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../utils/context.ts";
import { stubFor } from "./actors.ts";

export const withActorsStubMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  ctx.set("stub", stubFor(ctx.env));
  await next();
};
