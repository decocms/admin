import { EnvVars, Vars } from "@deco/sdk/mcp";
import { Context } from "hono";
import type { TimingVariables } from "hono/timing";

export * from "@deco/sdk/mcp";

export type AppEnv = {
  Variables: Vars & TimingVariables;
  Bindings: EnvVars & {
    DECO_CHAT_APP_ORIGIN?: string;
    PROD_DISPATCHER: {
      get: (
        script: string,
        ctx?: Record<string, unknown>,
        metadata?: { outbound?: { params_object?: Record<string, unknown> } },
      ) => { fetch: typeof fetch };
    };
  };
};

export type HonoAppContext = Context<AppEnv>;
