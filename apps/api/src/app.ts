import { Hono } from "hono";
import api from "./api.ts";
import apps from "./apps.ts";
import { AppEnv } from "./utils/context.ts";

const Hosts = {
  API: "api.deco.chat",
  APPS: "deco.page",
} as const;

const normalizeHost = (req: Request) => {
  const host = req.headers.get("host") ?? "localhost";
  return {
    [Hosts.API]: Hosts.API,
    localhost: Hosts.API,
    "localhost:8000": Hosts.API,
  }[host] ?? Hosts.APPS;
};

export const app = new Hono<AppEnv>({
  getPath: (req) =>
    "/" +
    normalizeHost(req) +
    req.url.replace(/^https?:\/\/[^/]+(\/[^?]*)(?:\?.*)?$/, "$1"),
});

app.route(`/${Hosts.API}`, api);
app.route(`/${Hosts.APPS}`, apps);
export default app;
