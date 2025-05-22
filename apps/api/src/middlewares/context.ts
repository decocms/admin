import { getServerClient } from "@deco/sdk/storage";
import Cloudflare from "cloudflare";
import type { MiddlewareHandler } from "hono";
import { honoCtxToAppCtx } from "../api.ts";
import { AppEnv, getEnv } from "../utils/context.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const {
    CF_API_TOKEN,
  } = getEnv(honoCtxToAppCtx(ctx));

  ctx.set(
    "db",
    getServerClient(),
  );

  ctx.set(
    "cf",
    new Cloudflare({ apiToken: CF_API_TOKEN }),
  );

  await next();
};
