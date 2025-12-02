/* oxlint-disable no-explicit-any */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { decodeJwt } from "jose";
import type { z } from "zod";
import { createContractBinding, createIntegrationBinding } from "./bindings.ts";
import { State } from "./state.ts";
import {
  createMCPServer,
  type CreateMCPServerOptions,
  MCPServer,
} from "./tools.ts";
import type { Binding, ContractBinding, MCPBinding } from "./wrangler.ts";
export { proxyConnectionForId } from "./bindings.ts";
export {
  createMCPFetchStub,
  type CreateStubAPIOptions,
  type ToolBinder,
} from "./mcp.ts";

export interface DefaultEnv<TSchema extends z.ZodTypeAny = any> {
  MESH_REQUEST_CONTEXT: RequestContext<TSchema>;
  MESH_BINDINGS: string;
  MESH_APP_DEPLOYMENT_ID: string;
  IS_LOCAL: boolean;
  MESH_URL?: string;
  MESH_RUNTIME_TOKEN?: string;
  MESH_APP_NAME?: string;
  [key: string]: unknown;
}

export interface BindingsObject {
  bindings?: Binding[];
}

export const MCPBindings = {
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
  contract: ContractBinding;
}

export interface User {
  id: string;
  email: string;
  workspace: string;
  user_metadata: {
    avatar_url: string;
    full_name: string;
    picture: string;
    [key: string]: unknown;
  };
}

export interface RequestContext<TSchema extends z.ZodTypeAny = any> {
  state: z.infer<TSchema>;
  token: string;
  meshUrl: string;
  ensureAuthenticated: (options?: {
    workspaceHint?: string;
  }) => User | undefined;
  callerApp?: string;
  connectionId?: string;
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
  contract: createContractBinding,
};

const withDefaultBindings = ({
  env,
  server,
  url,
}: {
  env: DefaultEnv;
  server: MCPServer<any, any>;
  url?: string;
}) => {
  env["SELF"] = new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === "toJSON") {
          return null;
        }

        return async (args: unknown) => {
          return await server.callTool({
            toolCallId: prop as string,
            toolCallInput: args,
          });
        };
      },
    },
  );

  env["IS_LOCAL"] =
    (url?.startsWith("http://localhost") ||
      url?.startsWith("http://127.0.0.1")) ??
    false;
};

export class UnauthorizedError extends Error {
  constructor(
    message: string,
    public redirectTo: URL,
  ) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const AUTHENTICATED = (user?: unknown) => () => {
  return {
    ...((user as User) ?? {}),
  } as User;
};

export const withBindings = <TEnv>({
  env: _env,
  server,
  tokenOrContext,
  url,
}: {
  env: TEnv;
  server: MCPServer<TEnv, any>;
  tokenOrContext?: string | RequestContext;
  url?: string;
}): TEnv => {
  const env = _env as DefaultEnv<any>;

  let context;
  if (typeof tokenOrContext === "string") {
    const decoded = decodeJwt(tokenOrContext);
    // Support both new JWT format (fields directly on payload) and legacy format (nested in metadata)
    const metadata =
      (decoded.metadata as {
        state?: Record<string, unknown>;
        meshUrl?: string;
        connectionId?: string;
      }) ?? {};

    context = {
      state: decoded.state ?? metadata.state,
      token: tokenOrContext,
      meshUrl: (decoded.meshUrl as string) ?? metadata.meshUrl,
      connectionId: (decoded.connectionId as string) ?? metadata.connectionId,
      ensureAuthenticated: AUTHENTICATED(decoded.user ?? decoded.sub),
    } as RequestContext<any>;
  } else if (typeof tokenOrContext === "object") {
    context = tokenOrContext;
    const decoded = decodeJwt(tokenOrContext.token);
    // Support both new JWT format (fields directly on payload) and legacy format (nested in metadata)
    const metadata =
      (decoded.metadata as {
        state?: Record<string, unknown>;
        meshUrl?: string;
        connectionId?: string;
      }) ?? {};
    const appName = decoded.appName as string | undefined;
    context.callerApp = appName;
    context.connectionId ??=
      (decoded.connectionId as string) ?? metadata.connectionId;
    context.ensureAuthenticated = AUTHENTICATED(decoded.user ?? decoded.sub);
  } else {
    // should not reach here
    throw new Error("Invalid token or context");
  }

  env.MESH_REQUEST_CONTEXT = context;
  const bindings = MCPBindings.parse(env.MESH_BINDINGS);

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](binding as any, env);
  }

  withDefaultBindings({
    env,
    server,
    url,
  });

  return env as TEnv;
};

export const withRuntime = <TEnv, TSchema extends z.ZodTypeAny = never>(
  userFns: UserDefaultExport<TEnv, TSchema>,
): ExportedHandler<TEnv & DefaultEnv<TSchema>> => {
  const server = createMCPServer<TEnv, TSchema>(userFns);
  const fetcher = async (
    req: Request,
    env: TEnv & DefaultEnv<TSchema>,
    ctx: ExecutionContext,
  ) => {
    const url = new URL(req.url);
    if (url.pathname === "/mcp") {
      return server.fetch(req, env, ctx);
    }

    if (url.pathname.startsWith("/mcp/call-tool")) {
      const toolCallId = url.pathname.split("/").pop();
      if (!toolCallId) {
        return new Response("Not found", { status: 404 });
      }
      const toolCallInput = await req.json();
      const result = await server.callTool({
        toolCallId,
        toolCallInput,
      });

      if (result instanceof Response) {
        return result;
      }

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return (
      userFns.fetch?.(req, env, ctx) ||
      new Response("Not found", { status: 404 })
    );
  };
  return {
    fetch: async (
      req: Request,
      env: TEnv & DefaultEnv<TSchema>,
      ctx: ExecutionContext,
    ) => {
      const bindings = withBindings({
        env,
        server,
        tokenOrContext: req.headers.get("x-mesh-token") ?? undefined,
        url: req.url,
      });
      return await State.run(
        { req, env: bindings, ctx },
        async () => await fetcher(req, bindings, ctx),
      );
    },
  };
};

export {
  type Contract,
  type Migration,
  type WranglerConfig,
} from "./wrangler.ts";
