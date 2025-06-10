import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { AppEnv } from "./utils/context.ts";
export const app = new Hono<AppEnv>();

app.all("/*", async (c) => {
  console.log("proxying outbound request", c.req.url);
  const response = await fetch(c.req.raw);
  if (getRuntimeKey() === "workerd") { // needs to be copied when resp is from an a external dispatcher.
    return new Response(response.body, response);
  }
  return response;
});
export default app;
