import { Context } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { AppEnv } from "./utils/context.ts";
export type DispatcherFetch = typeof fetch;

export const fetchScript = async (
  c: Context<AppEnv>,
  script: string,
  req: Request,
) => {
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
  const scriptFetcher = dispatcher.get<{
    DECO_CHAT_APP_ORIGIN: string;
  }>(script, {}, {
    outbound: {
      DECO_CHAT_APP_ORIGIN: script,
    },
  });
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
};
