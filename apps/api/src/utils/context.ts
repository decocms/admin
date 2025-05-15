import { EnvVars, Vars } from "@deco/sdk/mcp";
import { Context } from "hono";
import type { TimingVariables } from "hono/timing";
import { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

export * from "@deco/sdk/mcp";

interface AuthorizationVars {
  policy: PolicyClient;
  authorization: AuthorizationClient;
}

export type AppEnv = {
  Variables: Vars & TimingVariables & AuthorizationVars;
  Bindings: EnvVars & {
    PROD_DISPATCHER: { get: (script: string) => { fetch: typeof fetch } };
  };
};

export type HonoAppContext = Context<AppEnv>;
