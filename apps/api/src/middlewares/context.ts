import type { MiddlewareHandler } from "hono";
import { getServerClient } from "../db/client.ts";
import { AppEnv, getEnv } from "../utils/context.ts";
import Cloudflare from "cloudflare";
export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    CF_API_TOKEN,
  } = getEnv(ctx);

  ctx.set(
    "db",
    getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN),
  );

  ctx.set(
    "cf",
    new Cloudflare({
      apiToken: CF_API_TOKEN,
    }),
  );

  await next();
};
