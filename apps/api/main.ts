// deno-lint-ignore-file no-explicit-any
export * from "./src/actors.ts";
export { WorkspaceDatabase } from "./src/durable-objects/workspace-database.ts";
// DECONFIG DurableObjects (re-exported from SDK)
export { Blobs, Branch } from "./src/durable-objects/deconfig.ts";
export {
  KbFileProcessorWorkflow,
  WorkflowRunner,
} from "./src/workflows/index.ts";
import { contextStorage } from "@deco/sdk/fetch";
import { Hosts } from "@deco/sdk/hosts";
import { instrument } from "@deco/sdk/observability";
import { env } from "cloudflare:workers";
import postgres from "postgres";
import { default as app } from "./src/app.ts";
import { email } from "./src/email.ts";
import { tail } from "./tail.ts";

// Choose instrumented app depending on runtime
const instrumentedApp = instrument(app);

// Domains we consider "self"
const SELF_DOMAINS: string[] = [
  Hosts.API_LEGACY,
  Hosts.API,
  // @ts-expect-error env is not typed
  ...(env.VITE_USE_LOCAL_BACKEND ? [] : [Hosts.APPS]),
  // @ts-expect-error env is not typed
  `localhost:${env.PORT || 8000}`,
];

// Patch fetch globally
const originalFetch = globalThis.fetch;

/**
 * Author @mcandeia
 * Workaround for Cloudflare Workers:
 * Cloudflare does not allow self-invocation (calling the same worker from itself),
 * which results in a 522 status code. This patch intercepts fetch requests to self
 * domains and delegates them to the internal handler directly, bypassing the network.
 * This ensures internal requests work as expected in both Deno and Cloudflare environments.
 */
// @ts-ignore: mixed cloudflare and deno types
globalThis.fetch = async function patchedFetch(
  resource: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let req: Request;
  if (typeof resource === "string") {
    req = new Request(resource, init);
  } else if (resource instanceof Request) {
    req = resource;
  } else if (resource instanceof URL) {
    req = new Request(resource.toString(), init);
  } else {
    throw new Error("Unsupported resource type for fetch");
  }

  const url = new URL(req.url);

  const context = contextStorage.getStore();

  if (SELF_DOMAINS.some((domain) => url.host.endsWith(domain))) {
    if (!context) {
      throw new Error("Missing context for internal self-invocation");
    }
    if ((env as { SELF: Service }).SELF) {
      return await (env as { SELF: Service }).SELF.fetch(req);
    }
    // Delegate to internal handler
    return await instrumentedApp.fetch!(
      req as Request<unknown, IncomingRequestCfProperties<unknown>>,
      context.env,
      context.ctx,
    );
  }

  return await originalFetch(req);
};

const createPostgres = (env: any) => {
  console.log("[creating postgres client on main.ts]");
  return postgres(env.DATABASE_URL, {
    max: 2,
  });
};
// Default export that wraps app with per-request context initializer
export default {
  tail,
  email,
  fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const sql = contextStorage.getStore()?.sql ?? createPostgres(env);
    return contextStorage.run({ env, ctx, sql }, async () => {
      return await instrumentedApp.fetch!(
        request as Request<unknown, IncomingRequestCfProperties<unknown>>,
        env,
        ctx,
      );
    });
  },
};
