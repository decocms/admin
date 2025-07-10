import type {
  ExecutionContext,
  ForwardableEmailMessage,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { decodeJwt, type JWTPayload } from "jose";
import { createIntegrationBinding, workspaceClient } from "./bindings.ts";
import { createMCPServer, type CreateMCPServerOptions } from "./mastra.ts";
import { MCPClient, type QueryResult } from "./mcp.ts";
import type { WorkflowDO } from "./workflow.ts";
import { Workflow } from "./workflow.ts";

export {
  createMCPFetchStub,
  type CreateStubAPIOptions,
  type ToolBinder,
} from "./mcp.ts";

export interface DefaultEnv {
  DECO_CHAT_SCRIPT_SLUG: string;
  DECO_CHAT_API_URL?: string;
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
  DECO_CHAT_BINDINGS: string;
  DECO_CHAT_API_TOKEN?: string;
  DECO_CHAT_WORKFLOW_DO: DurableObjectNamespace<WorkflowDO>;
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

export interface IntegrationIdMCPBinding extends BindingBase {
  type: "mcp";
  integration_id: string;
}
export interface IntegrationNameMCPBinding extends BindingBase {
  type: "mcp";
  integration_name: string;
}
export type MCPBinding = IntegrationIdMCPBinding | IntegrationNameMCPBinding;

export interface SecretBinding extends BindingBase {
  type: "secret";
  description?: string;
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
> extends CreateMCPServerOptions {
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
  secret: SecretBinding;
}

export interface RequestContext {
  reqToken?: string;
  state?: Record<string, unknown>;
  workspace?: string;
}

// 2. Map binding type to its creator function
type CreatorByType = {
  [K in keyof BindingTypeMap]: (
    value: BindingTypeMap[K],
    env: DefaultEnv,
    ctx?: RequestContext,
  ) => unknown;
};

// 3. Strongly type creatorByType
const creatorByType: CreatorByType = {
  mcp: createIntegrationBinding,
  secret: (binding, _env, ctx) => {
    if (!ctx?.state) {
      return null;
    }
    return ctx.state[binding.name] as string;
  },
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

export const withBindings = <TEnv>(_env: TEnv, reqToken?: string): TEnv => {
  const env = _env as DefaultEnv;
  const bindings = WorkersMCPBindings.parse(env.DECO_CHAT_BINDINGS);
  const decoded = reqToken
    ? decodeJwt<JWTPayload & { state: Record<string, unknown> }>(reqToken)
    : null;

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](
      binding,
      env,
      decoded
        ? { reqToken, state: decoded?.state, workspace: decoded?.aud as string }
        : undefined,
    );
  }

  withDefaultBindings(env);

  return env as TEnv;
};

const getReqToken = (req: Request) => {
  const token = req.headers.get("Authorization");
  if (!token) {
    return undefined;
  }
  return token.split(" ")[1];
};
export const withRuntime = <TEnv>(
  userFns: UserDefaultExport<TEnv>,
): UserDefaultExport<TEnv> & { Workflow: ReturnType<typeof Workflow> } => {
  const server = createMCPServer(userFns);
  return {
    Workflow: Workflow(userFns.workflows),
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
    fetch: (req: Request, env: TEnv, ctx: ExecutionContext) => {
      const url = new URL(req.url);
      if (url.pathname === "/mcp") {
        return server(req, env, ctx);
      }
      return userFns.fetch?.(req, withBindings(env, getReqToken(req)), ctx) ||
        new Response("Not found", { status: 404 });
    },
    ...userFns.queue
      ? {
        queue: (batch: MessageBatch, env: TEnv, ctx: ExecutionContext) => {
          return userFns.queue!(batch, withBindings(env), ctx);
        },
      }
      : {},
  };
};
