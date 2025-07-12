// deno-lint-ignore-file no-explicit-any
import type { ExecutionContext } from "@cloudflare/workers-types";
import { decodeJwt } from "jose";
import type { z } from "zod";
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

export interface WorkspaceDB {
  query: (
    params: { sql: string; params: string[] },
  ) => Promise<{ result: QueryResult[] }>;
}

export interface DefaultEnv<TSchema extends z.ZodTypeAny = any> {
  DECO_CHAT_REQUEST_CONTEXT: RequestContext<TSchema>;
  DECO_CHAT_APP_NAME: string;
  DECO_CHAT_SCRIPT_SLUG: string;
  DECO_CHAT_API_URL?: string;
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
  DECO_CHAT_BINDINGS: string;
  DECO_CHAT_API_TOKEN: string;
  DECO_CHAT_WORKFLOW_DO: DurableObjectNamespace<WorkflowDO>;
  DECO_CHAT_WORKSPACE_DB: WorkspaceDB & {
    forContext: (ctx: RequestContext) => WorkspaceDB;
  };
  [key: string]: unknown;
}

export interface BindingBase {
  name: string;
}

export interface MCPBinding extends BindingBase {
  type: "mcp";
  /**
   * If not provided, will return a function that takes the integration id and return the binding implementation..
   */
  integration_id?: string;
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
  TSchema extends z.ZodTypeAny = never,
  TEnv = TUserEnv & DefaultEnv<TSchema>,
> extends CreateMCPServerOptions<TEnv, TSchema> {
  fetch?: (
    req: Request,
    env: TEnv,
    ctx: ExecutionContext,
  ) => Promise<Response> | Response;
}

// 1. Map binding type to its interface
interface BindingTypeMap {
  mcp: MCPBinding;
}

export interface RequestContext<TSchema extends z.ZodTypeAny = any> {
  state: z.infer<TSchema>;
  token: string;
  workspace: string;
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

const withDefaultBindings = (env: DefaultEnv, ctx: RequestContext) => {
  const client = workspaceClient(ctx);
  const createWorkspaceDB = (ctx: RequestContext): WorkspaceDB => {
    const client = workspaceClient(ctx);
    return {
      query: ({ sql, params }) => {
        return client.DATABASES_RUN_SQL({
          sql,
          params,
        });
      },
    };
  };
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = client;
  env["DECO_CHAT_WORKSPACE_DB"] = {
    ...createWorkspaceDB(ctx),
    forContext: createWorkspaceDB,
  };
};

export const withBindings = <TEnv>(
  _env: TEnv,
  tokenOrContext?: string | RequestContext,
): TEnv => {
  const env = _env as DefaultEnv<any>;

  let context;
  if (typeof tokenOrContext === "string") {
    const decoded = decodeJwt(tokenOrContext);
    context = {
      state: decoded.state as Record<string, unknown>,
      token: tokenOrContext,
      workspace: decoded.aud as string,
    } as RequestContext<any>;
  } else if (typeof tokenOrContext === "object") {
    context = tokenOrContext;
  } else {
    context = {
      state: undefined,
      token: env.DECO_CHAT_API_TOKEN,
      workspace: env.DECO_CHAT_WORKSPACE,
    };
  }

  env.DECO_CHAT_REQUEST_CONTEXT = context;
  const bindings = WorkersMCPBindings.parse(env.DECO_CHAT_BINDINGS);

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](
      binding as any,
      env,
    );
  }

  withDefaultBindings(env, env.DECO_CHAT_REQUEST_CONTEXT);

  return env as TEnv;
};

const getReqToken = (req: Request) => {
  const token = req.headers.get("Authorization");
  if (!token) {
    return undefined;
  }
  return token.split(" ")[1];
};

export const withRuntime = <TEnv, TSchema extends z.ZodTypeAny = never>(
  userFns: UserDefaultExport<TEnv, TSchema>,
): UserDefaultExport<TEnv, TSchema> & {
  Workflow: ReturnType<typeof Workflow>;
} => {
  const server = createMCPServer<TEnv, TSchema>(userFns);
  return {
    Workflow: Workflow(userFns.workflows),
    fetch: (
      req: Request,
      env: TEnv & DefaultEnv<TSchema>,
      ctx: ExecutionContext,
    ) => {
      const url = new URL(req.url);
      if (url.pathname === "/mcp") {
        return server(req, withBindings(env, getReqToken(req)), ctx);
      }
      return userFns.fetch?.(
        req,
        withBindings(env, getReqToken(req)) as any,
        ctx,
      ) ||
        new Response("Not found", { status: 404 });
    },
  };
};
