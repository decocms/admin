import { type JWTPayload } from "@deco/sdk/auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import { type AppEnv, issuerFromContext } from "../utils/context.ts";

const tryParseUser = (user: unknown) => {
  if (typeof user === "string") {
    const { id, email, user_metadata } = JSON.parse(user);
    return { id, email, user_metadata };
  }
  return user;
};

export const handleCodeExchange = async (c: Context<AppEnv>) => {
  try {
    const appCtx = honoCtxToAppCtx(c);

    const { code } = await c.req.json();

    const { data, error } = await appCtx.db
      .from("deco_chat_oauth_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error || !data) {
      console.error(`error on code exchange ${error}`);
      throw new HTTPException(500, { message: "Failed to exchange code" });
    }

    const { claims } = data as unknown as { claims: JWTPayload };
    const issuer = await issuerFromContext(appCtx);
    const token = await issuer.issue({
      ...claims,
      user: "user" in claims ? tryParseUser(claims.user) : undefined,
    });

    await appCtx.db.from("deco_chat_oauth_codes").delete().eq("code", code);

    return c.json({ access_token: token });
  } catch {
    throw new HTTPException(500, { message: "Failed to exchange code" });
  }
};
