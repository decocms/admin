import type {
  ExecutionContext,
  ForwardableEmailMessage,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { createIntegrationBinding, workspaceClient } from "./bindings.ts";
import { MCPClient, QueryResult } from "./mcp.ts";
export {
  createMCPFetchStub,
  type CreateStubAPIOptions,
  type ToolBinder,
} from "./mcp.ts";

export interface DefaultEnv {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_BINDINGS: string;
  DECO_CHAT_API_TOKEN?: string;
  DECO_CHAT_WORKSPACE_DB: {
    query: (
      params: { sql: string; params: string[] },
    ) => Promise<{ result: QueryResult[] }>;
  };
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
  TUserEnv = Record<string, unknown>,
> {
  queue?: (
    batch: MessageBatch,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void> | void;
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
  const client = workspaceClient(env);
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = client;
  env["DECO_CHAT_WORKSPACE_DB"] = {
    query: ({ sql, params }) => {
      return client.DATABASES_RUN_SQL({
        sql,
        params,
      });
    },
  };
};

export const withBindings = <TEnv>(_env: TEnv): TEnv => {
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

export const withRuntime = <TEnv>(
  userFns: UserDefaultExport<TEnv>,
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
    ...userFns.queue
      ? {
        queue: (batch: MessageBatch, env: TEnv, ctx: ExecutionContext) => {
          return userFns.queue!(batch, withBindings(env), ctx);
        },
      }
      : {},
  };
};
