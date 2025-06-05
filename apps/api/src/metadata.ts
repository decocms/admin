import { JwtIssuer } from "@deco/sdk/auth";
import { Context, Next } from "hono";
import { AppEnv } from "./utils/context.ts";

export const metadata = async (c: Context<AppEnv>, next: Next) => {
  const dispatchScript = c.env.DISPATCH_SCRIPT;
  const jwtSecret = c.env.ISSUER_JWT_SECRET;
  if (!dispatchScript || typeof jwtSecret !== "string") {
    await next();
    return c.res;
  }

  const { data, error } = await c.var.db
    .from("deco_chat_hosting_apps")
    .select("*")
    .eq("slug", dispatchScript).maybeSingle();
  if (error) {
    console.error("error querying script", error);
    return new Response(null, { status: 500 });
  }
  if (!data) {
    return new Response(null, { status: 404 });
  }
  const jwt = JwtIssuer.forSecret(jwtSecret);

  return {
    workspace: data.workspace,
    token: jwt.create({
      sub: `app:${dispatchScript}`,
      aud: data.workspace,
    }),
  };
};
