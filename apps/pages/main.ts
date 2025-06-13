export interface Env {
  PROD_DISPATCHER: DispatchNamespace; // for local development
}
const APPS_DOMAIN_QS = "app_host";

const appsDomainOf = (req: Request, url?: URL) => {
  url ??= new URL(req.url);
  const referer = req.headers.get("referer");

  return url.searchParams.get(APPS_DOMAIN_QS) ||
    (referer && new URL(referer).searchParams.get(APPS_DOMAIN_QS));
};
export default {
  fetch: async (req: Request, env: Env) => {
    const url = new URL(req.url);
    const host = appsDomainOf(req) ?? req.headers.get("host") ??
      url.host;
    if (!host) {
      return new Response("No host", { status: 400 });
    }
    const script = host.replace(".deco.page", "");
    if (url.host !== host) {
      url.host = host;
      url.protocol = "https";
      url.port = `443`;
      url.searchParams.delete(APPS_DOMAIN_QS);
    }
    const scriptFetcher = env.PROD_DISPATCHER.get(script, {}, {
      outbound: {
        DECO_CHAT_APP_ORIGIN: script,
      },
    });
    return await scriptFetcher.fetch(req).catch((err: Error) => {
      if ("message" in err && err.message.startsWith("Worker not found")) {
        // we tried to get a worker that doesn't exist in our dispatch namespace
        return new Response("worker not found", { status: 404 });
      }
      throw err;
    });
  },
};
