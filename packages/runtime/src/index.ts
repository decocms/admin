import type {
  ExecutionContext,
  ForwardableEmailMessage,
  ScheduledController,
} from "@cloudflare/workers-types";

import { createIntegrationBinding } from "./bindings.ts";
import { MCPClient } from "./mcp.ts";
export {
  createMCPFetchStub,
  type CreateStubAPIOptions,
  type ToolBinder,
} from "./mcp.ts";

export interface DefaultEnv {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_BINDINGS: string;
  [key: string]: unknown;
}

export interface BindingBase {
  name: string;
}

export interface MCPBinding extends BindingBase {
  type: "mcp";
  integration_id: string;
}

export type Binding = MCPBinding;

export interface BindingsObject {
  bindings?: Binding[];
}

export const WorkersMCPBindings = {
  parse: (bindings?: string): Binding[] => {
    if (!bindings) return [];
    try {
      return JSON.parse(atob(bindings)) as Binding[];
    } catch {
      return [];
    }
  },
  stringify: (bindings: Binding[]): string => {
    return btoa(JSON.stringify(bindings));
  },
};

export interface UserDefaultExport<
  TUserEnv extends Record<string, unknown> = Record<string, unknown>,
> {
  fetch?: (
    req: Request,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<Response> | Response;
  scheduled?: (
    controller: ScheduledController,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void> | void;
  email?: (
    message: ForwardableEmailMessage,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void> | void;
}

// 1. Map binding type to its interface
interface BindingTypeMap {
  mcp: MCPBinding;
}

// 2. Map binding type to its creator function
type CreatorByType = {
  [K in keyof BindingTypeMap]: (
    value: BindingTypeMap[K],
    env: DefaultEnv,
  ) => unknown;
};

// 3. Strongly type creatorByType
const creatorByType: CreatorByType = {
  mcp: createIntegrationBinding,
};

const withDefaultBindings = (env: DefaultEnv) => {
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = MCPClient.forWorkspace(
    env.DECO_CHAT_WORKSPACE,
  );
};

const withBindings = <TEnv extends DefaultEnv>(_env: TEnv) => {
  const env = _env as DefaultEnv;
  const bindings = WorkersMCPBindings.parse(env.DECO_CHAT_BINDINGS);

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](
      binding,
      env,
    );
  }

  withDefaultBindings(env);

  return env as TEnv;
};

export const withRuntime = <TEnv extends DefaultEnv>(
  userFns: UserDefaultExport,
): UserDefaultExport<TEnv> => {
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
