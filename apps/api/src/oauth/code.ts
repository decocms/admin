import { type JWTPayload } from "@deco/sdk/auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import { type AppEnv } from "../utils/context.ts";

const tryParseUser = (user: unknown) => {
  if (typeof user === "string") {
    const { id, email, user_metadata } = JSON.parse(user);
    return { id, email, user_metadata };
  }
  return user;
};
// http://localhost:3001/candy-testing/default/i:5b83e510-1eb8-4364-84d8-0af7069f4e36/mcp
export const handleCodeExchange = async (c: Context<AppEnv>) => {
  try {
    const appCtx = honoCtxToAppCtx(c);

    // Support both JSON and form-encoded requests
    const contentType = c.req.header("content-type");
    let requestData: {
      code?: string;
      client_id?: string;
      code_verifier?: string;
    };

    if (contentType?.includes("application/x-www-form-urlencoded")) {
      const formData = await c.req.formData();
      requestData = {
        code: formData.get("code")?.toString(),
      };
    } else {
      requestData = await c.req.json();
    }

    const { code } = requestData;

    if (!code) {
      throw new HTTPException(400, { message: "code is required" });
    }

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
    const issuer = await appCtx.jwtIssuer();
    const token = await issuer.issue({
      ...claims,
      user: "user" in claims ? tryParseUser(claims.user) : undefined,
    });

    await appCtx.db.from("deco_chat_oauth_codes").delete().eq("code", code);

    // Return OAuth 2.1 compliant token response
    return c.json({
      access_token: token,
      token_type: "Bearer",
    });
  } catch {
    throw new HTTPException(500, { message: "Failed to exchange code" });
  }
};
