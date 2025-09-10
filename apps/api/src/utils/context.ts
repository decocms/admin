import type { EnvVars, IWorkspaceDB, Vars } from "@deco/sdk/mcp";
import type { Context } from "hono";
import type { TimingVariables } from "hono/timing";
import type { Blobs, Branch } from "../durable-objects/deconfig.ts";
export * from "@deco/sdk/mcp";

export type Bindings = EnvVars & {
  DECO_CHAT_APP_ORIGIN?: string;
  WORKSPACE_DB: DurableObjectNamespace<IWorkspaceDB & Rpc.DurableObjectBranded>;
  // DECONFIG DurableObjects
  BRANCH: DurableObjectNamespace<Branch>;
  BLOBS: DurableObjectNamespace<Blobs>;
  PROD_DISPATCHER: {
    get: <TOutbound extends Record<string, unknown> = Record<string, unknown>>(
      script: string,
      ctx?: Record<string, unknown>,
      metadata?: { outbound?: TOutbound },
    ) => { fetch: typeof fetch };
  };
  KB_FILE_PROCESSOR?: Workflow;
};

export type AppEnv = {
  Variables: Vars & TimingVariables;
  Bindings: Bindings;
};

export type HonoAppContext = Context<AppEnv>;
