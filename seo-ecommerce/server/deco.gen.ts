🛠️ genEnv start (workspace=alfanet, local=false, selfUrl=https://localhost-f91f9b1a.deco.host/mcp)
🔧 Effective bindings: SELF
🔎 Attempting HTTP fallback for integration SELF ...
🌐 Fetching https://localhost-f91f9b1a.deco.host/mcp/tools for fallback tool listing
// Generated types - do not edit manually

// No tools discovered for SELF (https://localhost-f91f9b1a.deco.host/mcp)

import { z } from "zod";

export type Mcp<T extends Record<string, (input: any) => Promise<any>>> = {
  [K in keyof T]: ((
    input: Parameters<T[K]>[0],
  ) => Promise<ReturnType<T[K]>>) & {
    asTool: () => Promise<{
      inputSchema: z.ZodType<Parameters<T[K]>[0]>;
      outputSchema?: z.ZodType<ReturnType<T[K]>>;
      description: string;
      id: string;
      execute: ({
        context,
      }: {
        context: Parameters<T[K]>[0];
      }) => Promise<ReturnType<T[K]>>;
    }>;
  };
};

export const StateSchema = z.object({});

export interface Env {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
}

export const Scopes = {};

