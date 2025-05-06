import { Hono } from "hono";
import { AppEnv } from "./utils/context.ts";
import { appsDomainOf } from "./app.ts";
import { Entrypoint } from "./api/hosting/api.ts";

export type DispatcherFetch = typeof fetch;
export const app = new Hono<AppEnv>();
app.all("/*", async (c) => {
  const host = appsDomainOf(c.req.raw) ?? c.req.header("host");
  if (!host) {
    return new Response("No host", { status: 400 });
  }
  const script = Entrypoint.script(host);
  const dispatcher = c.env.PROD_DISPATCHER.get(script);

  return await dispatcher.fetch(c.req.raw);
});
export default app;
