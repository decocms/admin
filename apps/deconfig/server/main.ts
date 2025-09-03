/**
 * This is the main entry point for your application and
 * MCP server. This is a Cloudflare workers app, and serves
 * both your MCP server at /mcp and your views as a react
 * application at /.
 */
import { DefaultEnv, withRuntime } from "@deco/workers-runtime";
import { type Env as DecoEnv, StateSchema } from "./deco.gen.ts";

import { Blobs } from "./src/blobs.ts";
import { Branch } from "./src/branch.ts";
import { tools } from "./tools/index.ts";
import { views } from "./views.ts";

// Export Durable Objects
export { Blobs } from "./src/blobs.ts";
export { Branch } from "./src/branch.ts";

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
    BRANCH: DurableObjectNamespace<Branch>;
  };

const fallbackToView =
  (viewPath: string = "/") =>
  async (request: Request, env: Env): Promise<Response> => {
    try {
      const url = new URL(request.url);
      // Redirect root to viewPath
      if (url.pathname === "/") {
        url.pathname = viewPath;
        return Promise.resolve(Response.redirect(url.toString(), 302));
      }
      // Serve assets from bound assets
      return env.ASSETS.fetch(request);
    } catch (error) {
      return Promise.resolve(
        new Response("Internal server error", { status: 500 }),
      );
    }
  };

const { Workflow, ...runtime } = withRuntime<Env, typeof StateSchema>({
  tools,
  fetch: fallbackToView("/"),
});

export { Workflow };
export default runtime;
