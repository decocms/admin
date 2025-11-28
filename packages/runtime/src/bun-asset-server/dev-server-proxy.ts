import { proxy } from "hono/proxy";
import { Context } from "hono";

export const devServerProxy = (url: string | URL) => (c: Context) => {
  const incomingUrl = new URL(c.req.raw.url);
  const target = new URL(url);
  target.pathname = incomingUrl.pathname;
  target.search = incomingUrl.search;

  return proxy(target, {
    raw: c.req.raw,
    headers: {
      ...c.req.raw.headers,
    },
  });
};
