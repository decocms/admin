import type { MiddlewareHandler } from "hono";
import { getServerClient } from "../db/client.ts";
import { AppEnv, getEnv } from "../utils/context.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const { SUPABASE_URL, SUPABASE_KEY } = getEnv(ctx);

  ctx.set(
    "db",
    getServerClient(SUPABASE_URL, SUPABASE_KEY),
  );

  await next();
};
