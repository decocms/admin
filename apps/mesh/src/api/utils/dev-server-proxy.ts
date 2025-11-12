import { proxy } from "hono/proxy";
import { Context } from "hono";

export const devServerProxy = (c: Context) => {
  const incomingUrl = new URL(c.req.raw.url);
  const target = new URL(
    process.env.VITE_SERVER_URL ?? "http://localhost:4000",
  );
  target.pathname = incomingUrl.pathname;
  target.search = incomingUrl.search;

  return proxy(target, {
    raw: c.req.raw,
    headers: {
      ...c.req.raw.headers,
    },
  });
};
