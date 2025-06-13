import { createServerClient } from "@supabase/ssr";
import { JwtIssuer } from "./jwt.ts";

const Hosts = {
  API: "api.deco.chat",
  APPS: "deco.page",
} as const;

type Client = ReturnType<typeof createServerClient>;
let client: Client | undefined;
const getServerClient = (
  supabaseUrl: string,
  supabaseKey: string,
): Client => {
  client ??= createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: { getAll: () => [] } },
  );

  return client;
};

export interface Env {
  DECO_CHAT_APP_ORIGIN: string;
  ISSUER_JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
  DECO_CHAT_API: Service;
}

const wellKnownHosts = Object.values(Hosts) as string[];
export const isWellKnownHost = (host: string): boolean => {
  return wellKnownHosts.includes(host) || host.endsWith(Hosts.APPS);
};

export default {
  fetch: async (req: Request, env: Env) => {
    const host = req.headers.get("host") ?? new URL(req.url).hostname;
    const fetcher = isWellKnownHost(host)
      ? (req: Request, opts?: RequestInit) => env.DECO_CHAT_API.fetch(req, opts)
      : fetch;
    if (host !== Hosts.API) { // just forward the request to the target url
      return fetcher(
        req,
      );
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

    return fetcher(
      new Request(req.url, {
        method: req.method,
        headers: reqHeaders,
        body: req.body,
        redirect: req.redirect,
      }),
    );
  },
};
