import { createSessionTokenCookie, JwtIssuer } from "@deco/sdk/auth";
import { Entrypoint } from "@deco/sdk/mcp";
import { Context, Hono, Next } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { APPS_DOMAIN_QS, appsDomainOf } from "./app.ts";
import { AppEnv } from "./utils/context.ts";
export type DispatcherFetch = typeof fetch;
export const app = new Hono<AppEnv>();
app.all("/*", async (c) => {
  const host = appsDomainOf(c.req.raw) ?? c.req.header("host");
  if (!host) {
    return new Response("No host", { status: 400 });
  }
  const script = Entrypoint.script(host);
  let dispatcher: typeof c.env.PROD_DISPATCHER;
  if ("PROD_DISPATCHER" in c.env) {
    dispatcher = c.env.PROD_DISPATCHER;
  } else {
    dispatcher = {
      get: () => {
        return {
          fetch: (req, opts) => fetch(req, opts),
        };
      },
    };
  }
  const url = new URL(c.req.url);
  if (url.host !== host) {
    url.host = host;
    url.protocol = "https";
    url.port = `443`;
    url.searchParams.delete(APPS_DOMAIN_QS);
  }
  const scriptFetcher = dispatcher.get(script, {}, {
    outbound: {
      params_object: {
        DECO_CHAT_APP_ORIGIN: script,
      },
    },
  });
  const req = new Request(url, c.req.raw);
  const response = await scriptFetcher.fetch(req).catch((err) => {
    if ("message" in err && err.message.startsWith("Worker not found")) {
      // we tried to get a worker that doesn't exist in our dispatch namespace
      return new Response("worker not found", { status: 404 });
    }
    throw err;
  });

  if (getRuntimeKey() === "workerd") { // needs to be copied when resp is from an a external dispatcher.
    return new Response(response.body, response);
  }
  return response;
});
export default app;

/**
 * Issues a token for the given app origin.
 *
 * This is used to allow apps to make outbound requests to the API.
 *
 * @param c
 * @param next
 * @returns
 */
export const withAppsJWTToken = async (c: Context<AppEnv>, next: Next) => {
  const dispatchScript = c.env.DECO_CHAT_APP_ORIGIN;
  const jwtSecret = c.env.ISSUER_JWT_SECRET;
  if (!dispatchScript || typeof jwtSecret !== "string") {
    await next();
    return c.res;
  }
  console.log("invoking with dispatcher", dispatchScript);

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
  const token = await jwt.create({
    sub: `app:${dispatchScript}`,
    aud: data.workspace,
  });

  const cookie = createSessionTokenCookie(
    token,
    new URL(c.req.raw.url).hostname,
  );

  c.req.raw.headers.append("Cookie", cookie);
  return next();
};
