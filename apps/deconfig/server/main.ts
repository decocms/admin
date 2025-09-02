/**
 * This is the main entry point for your application and
 * MCP server. This is a Cloudflare workers app, and serves
 * both your MCP server at /mcp and your views as a react
 * application at /.
 */
import { DefaultEnv, withRuntime } from "@deco/workers-runtime";
import { type Env as DecoEnv, StateSchema } from "./deco.gen.ts";

import { Blobs } from "./src/blobs.ts";
import { Namespace } from "./src/namespace.ts";
import { tools } from "./tools/index.ts";
import { views } from "./views.ts";

// Export Durable Objects
export { Blobs } from "./src/blobs.ts";
export { Namespace } from "./src/namespace.ts";

/**
 * This Env type is the main context object that is passed to
 * all of your Application.
 *
 * It includes all of the generated types from your
 * Deco bindings, along with the default ones.
 */
export type Env = DefaultEnv &
  DecoEnv & {
    ASSETS: {
      fetch: (request: Request) => Promise<Response>;
    };
    // R2 bucket for large blob storage
    DECONFIG_BLOBS: R2Bucket;
    // Durable Object bindings
    BLOBS: DurableObjectNamespace<Blobs>;
    NAMESPACE: DurableObjectNamespace<Namespace>;
  };

const fallbackToView =
  (viewPath: string = "/") =>
    async (req: Request, env: Env) => {
      const LOCAL_URL = "http://localhost:4000";
      const url = new URL(req.url);
      const useDevServer = (
        req.headers.get("origin") || req.headers.get("host")
      )?.includes("localhost");

      const request = new Request(
        useDevServer
          ? new URL(`${url.pathname}${url.search}`, LOCAL_URL)
          : new URL(viewPath, req.url),
        req,
      );

      return useDevServer ? fetch(request) : env.ASSETS.fetch(request);
    };

const { Workflow, ...runtime } = withRuntime<Env, typeof StateSchema>({
  oauth: {
    scopes: ["DATABASES_RUN_SQL"],
    state: StateSchema,
  },
  views,
  tools,
  fetch: fallbackToView("/"),
});
export { Workflow };
export default runtime;
