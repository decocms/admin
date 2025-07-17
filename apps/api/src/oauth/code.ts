import { JwtIssuer, type JWTPayload } from "@deco/sdk/auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import type { AppEnv } from "../utils/context.ts";

export const handleCodeExchange = async (c: Context<AppEnv>) => {
  const appCtx = honoCtxToAppCtx(c);

  const { code } = await c.req.json();

  const { data, error } = await appCtx.db.from("deco_chat_oauth_codes").select(
    "*",
  ).eq("code", code);

  if (error || !data) {
    throw new HTTPException(500, { message: "Failed to exchange code" });
  }

  const { claims } = data as unknown as { claims: JWTPayload };

  const keyPair = appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
      appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
    ? {
      public: appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
      private: appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
    }
    : undefined;
  const issuer = await JwtIssuer.forKeyPair(keyPair);
  const token = await issuer.issue(claims);

  return c.json({ access_token: token });
};
