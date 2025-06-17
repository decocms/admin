/// <reference types="@cloudflare/workers-types" />

import { createIntegrationBinding } from "./bindings.ts";
import { MCPClient } from "./mcp.ts";
export { createMCPFetchStub, type CreateStubAPIOptions } from "./mcp.ts";
export { type ToolBinder } from "./mcp.ts";

export interface DefaultEnv {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_BINDINGS: string;
  [key: string]: unknown;
}

export interface BindingBase {
  name: string;
  value: string;
}

export interface MCPBinding extends BindingBase {
  type: "MCP";
}

export type Binding = MCPBinding;

export interface BindingsObject {
  bindings?: Binding[];
}

const parseBindings = (bindings?: string) => {
  if (!bindings) return [];
  try {
    return JSON.parse(atob(bindings)) as Binding[];
  } catch {
    return [];
  }
};

export interface UserDefaultExport<TUserEnv extends Record<string, unknown>> {
  fetch?: (
    req: Request,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<Response>;
  scheduled?: (
    controller: ScheduledController,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
  email?: (
    message: ForwardableEmailMessage,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
}

const creatorByType: Record<
  Binding["type"],
  (value: string, env: DefaultEnv) => unknown
> = {
  MCP: createIntegrationBinding,
};

const withDefaultBindings = (env: DefaultEnv) => {
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = MCPClient.forWorkspace(
    env.DECO_CHAT_WORKSPACE,
  );
};

const withBindings = <TEnv extends DefaultEnv>(_env: TEnv) => {
  const env = _env as DefaultEnv;
  const bindings = parseBindings(env.DECO_CHAT_BINDINGS);

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](binding.value, env);
  }

  withDefaultBindings(env);

  return env as TEnv;
};

export const withRuntime = <TEnv extends DefaultEnv>(
  userFns: UserDefaultExport<TEnv>,
) => {
  return {
    ...userFns,
    ...userFns.email
      ? {
        email: (
          message: ForwardableEmailMessage,
          env: TEnv,
          ctx: ExecutionContext,
        ) => {
          return userFns.email!(message, withBindings(env), ctx);
        },
      }
      : {},
    ...userFns.scheduled
      ? {
        scheduled: (
          controller: ScheduledController,
          env: TEnv,
          ctx: ExecutionContext,
        ) => {
          return userFns.scheduled!(controller, withBindings(env), ctx);
        },
      }
      : {},
    ...(userFns.fetch
      ? {
        fetch: (req: Request, env: TEnv, ctx: ExecutionContext) => {
          return userFns.fetch!(req, withBindings(env), ctx);
        },
      }
      : {}),
  };
};
