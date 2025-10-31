// Generated types - do not edit manually

import { z } from "zod";

export type Mcp<T extends Record<string, (input: any) => Promise<any>>> = {
  [K in keyof T]: ((
    input: Parameters<T[K]>[0],
  ) => Promise<Awaited<ReturnType<T[K]>>>) & {
    asTool: () => Promise<{
      inputSchema: z.ZodType<Parameters<T[K]>[0]>;
      outputSchema?: z.ZodType<Awaited<ReturnType<T[K]>>>;
      description: string;
      id: string;
      execute: (
        input: Parameters<T[K]>[0],
      ) => Promise<Awaited<ReturnType<T[K]>>>;
    }>;
  };
};

export const StateSchema = z.object({});

export interface Env {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
}

export const Scopes = {};
