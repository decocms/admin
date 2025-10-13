import {
  Actor,
  ActorConstructor,
  RuntimeClass,
  StubFactory,
} from "@deco/actors";
import { ActorCfRuntime } from "@deco/actors/cf";
import { actors } from "@deco/actors/proxy";
import process from "node:process";
import { type AuthUser, getUserBySupabaseCookie } from "../auth/user.ts";
import type { Bindings, Principal } from "../mcp/index.ts";

export interface AuthMetadata {
  user?: AuthUser | null;
}

export abstract class BaseActor<TMetadata extends AuthMetadata = AuthMetadata> {
  protected env: Record<string, string>;
  protected abstract state: { id: string };
  public metadata?: TMetadata;
  constructor(env?: object) {
    this.env = {
      ...(process?.env ?? {}),
      ...(env ?? {}),
    } as Record<string, string>;
  }

  async enrichMetadata(m: TMetadata, req: Request): Promise<TMetadata> {
    const user = await this.loadUser(req);
    return {
      ...m,
      user: user,
    };
  }

  async loadUser(req: Request): Promise<Principal | null> {
    if (!req) {
      return null;
    }
    const user = await getUserBySupabaseCookie(
      req,
      (this.env as Record<string, string>)?.SUPABASE_SERVER_TOKEN,
      (this.env as Record<string, string>)?.DECO_CHAT_API_JWT_PRIVATE_KEY &&
        (this.env as Record<string, string>)?.DECO_CHAT_API_JWT_PUBLIC_KEY
        ? {
            public: (this.env as Record<string, string>)
              ?.DECO_CHAT_API_JWT_PUBLIC_KEY,
            private: (this.env as Record<string, string>)
              ?.DECO_CHAT_API_JWT_PRIVATE_KEY,
          }
        : undefined,
    );
    return user ?? null;
  }
}

export const runtime = new RuntimeClass() as InstanceType<typeof RuntimeClass>;
export const stubFor = (env: Bindings) => {
  return <TActor extends Actor, Constructor extends ActorConstructor<TActor>>(
    c: Constructor,
  ): StubFactory<InstanceType<Constructor>> => {
    return runtime instanceof ActorCfRuntime
      ? // deno-lint-ignore no-explicit-any
        runtime.stub(c, env as any)
      : actors.stub(c.name);
  };
};
