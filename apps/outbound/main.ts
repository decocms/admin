import { JwtIssuer } from "@deco/sdk/auth";
import { Hosts } from "@deco/sdk/hosts";
import { getServerClient } from "@deco/sdk/storage";

export interface Env {
  DECO_CHAT_APP_ORIGIN: string;
  ISSUER_JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
}

export default {
  fetch: async (req: Request, env: Env) => {
    const host = req.headers.get("host") ?? new URL(req.url).hostname;
    if (host !== Hosts.API) { // just forward the request to the target url
      return fetch(req);
    }

    // otherwise, we need to authenticate the request
    const {
      DECO_CHAT_APP_ORIGIN,
      ISSUER_JWT_SECRET,
      SUPABASE_URL,
      SUPABASE_SERVER_TOKEN,
    } = env;

    if (
      !DECO_CHAT_APP_ORIGIN || !ISSUER_JWT_SECRET || !SUPABASE_URL ||
      !SUPABASE_SERVER_TOKEN
    ) {
      return new Response("Missing environment variables", { status: 500 });
    }

    const db = getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN);
    const { data, error } = await db
      .from("deco_chat_hosting_apps")
      .select("*")
      .eq("slug", DECO_CHAT_APP_ORIGIN)
      .maybeSingle();

    if (error) {
      return new Response("Error querying script", { status: 500 });
    }

    if (!data) {
      return new Response("App not found", { status: 404 });
    }

    const issuer = JwtIssuer.forSecret(ISSUER_JWT_SECRET);
    const token = await issuer.create({
      sub: `app:${DECO_CHAT_APP_ORIGIN}`,
      aud: data?.workspace,
    });

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("Authorization", `Bearer ${token}`);

    return fetch(
      new Request(req.url, {
        method: req.method,
        headers: reqHeaders,
        body: req.body,
        redirect: req.redirect,
      }),
    );
  },
};
