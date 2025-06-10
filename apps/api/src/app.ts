import { Hosts } from "@deco/sdk/hosts";
import { Hono } from "hono";
import { timing } from "hono/timing";
import api from "./api.ts";
import apps, { withAppsJWTToken } from "./apps.ts";
import { AppEnv } from "./utils/context.ts";
import outbound from "./outbound.ts";

export const APPS_DOMAIN_QS = "app_host";

export const appsDomainOf = (req: Request, url?: URL) => {
  url ??= new URL(req.url);
  const referer = req.headers.get("referer");

  return url.searchParams.get(APPS_DOMAIN_QS) ||
    (referer && new URL(referer).searchParams.get(APPS_DOMAIN_QS));
};

const normalizeHost = (req: Request, env?: AppEnv["Bindings"]) => {
  const host = req.headers.get("host") ?? "localhost";
  const appsHost = appsDomainOf(req);
  if (appsHost) {
    return Hosts.APPS;
  }
  const catchall = env?.DECO_CHAT_APP_ORIGIN ? Hosts.APPS_OUTBOUND : Hosts.APPS;
  return {
    [Hosts.API]: Hosts.API,
    localhost: Hosts.API,
    "localhost:3001": Hosts.API,
    "localhost:8000": Hosts.API,
  }[host] ?? catchall;
};

export const app = new Hono<AppEnv>({
  getPath: (req, env) =>
    "/" +
    normalizeHost(req, env?.env) +
    req.url.replace(/^https?:\/\/[^/]+(\/[^?]*)(?:\?.*)?$/, "$1"),
});

app.use(timing({ crossOrigin: true, total: true }));

app.use(`/${Hosts.API}/*`, withAppsJWTToken);
app.route(`/${Hosts.API}`, api);
app.route(`/${Hosts.APPS}`, apps);
app.route(`/${Hosts.APPS_OUTBOUND}`, outbound);
export default app;
