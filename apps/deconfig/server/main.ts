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
import { qsParser } from "./src/utils.ts";
import { WatchOpts, watchSSE } from "./src/watch.ts";
import { tools } from "./tools/index.ts";
import { views } from "./views.ts";
import z from "zod";

// Export Durable Objects
export { Blobs } from "./src/blobs.ts";
export { Branch } from "./src/branch.ts";

const Schema = StateSchema.extend({
  pathPrefix: z
    .string()
    .optional()
    .describe("The path prefix for this deconfig installation"),
});
/**
 * This Env type is the main context object that is passed to
 * all of your Application.
 *
 * It includes all of the generated types from your
 * Deco bindings, along with the default ones.
 */
export type Env = DefaultEnv<typeof Schema> &
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

const watchParser = qsParser<WatchOpts>({
  branchName: (value) => value,
  fromCtime: (value) => +value,
  pathFilter: (value) => value,
});

const fallbackToView =
  (viewPath: string = "/") =>
  async (req: Request, env: Env) => {
    const LOCAL_URL = "http://localhost:4000";
    const url = new URL(req.url);
    if (url.pathname === "/watch") {
      return watchSSE(env, watchParser.parse(url.searchParams));
    }
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

const { Workflow, ...runtime } = withRuntime<Env, typeof Schema>({
  oauth: {
    scopes: ["DATABASES_RUN_SQL"],
    state: Schema,
  },
  tools,
  views,
  fetch: fallbackToView("/"),
});

export { Workflow };
export default runtime;
