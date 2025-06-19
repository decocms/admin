import { z } from "zod";
import { createMCPClientProxy } from "./proxy.ts";
import type { MCPConnection } from "./connection.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

const workspaceTools = [{
  name: "INTEGRATIONS_GET",
  inputSchema: z.object({
    id: z.string(),
  }),
  outputSchema: z.object({
    connection: z.object({}),
  }),
}] satisfies ToolBinder<string, unknown, object>[];

// Default fetcher instance with API_SERVER_URL and API_HEADERS
const global = createMCPFetchStub<[]>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forWorkspace: (
      workspace: string,
      token?: string,
    ) => MCPClientFetchStub<typeof workspaceTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnectionProvider,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forWorkspace") {
        return (workspace: string, token?: string) =>
          createMCPFetchStub<[]>({ workspace, token });
      }
      if (name === "forConnection") {
        return <TDefinition extends readonly ToolBinder[]>(
          connection: MCPConnectionProvider,
        ) => createMCPFetchStub<TDefinition>({ connection });
      }
      return global[name as keyof typeof global];
    },
  },
);

export interface ToolBinder<
  TName extends string = string,
  // deno-lint-ignore no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  name: TName;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  opt?: true;
}
export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export type MCPConnectionProvider =
  | (() => Promise<MCPConnection>)
  | MCPConnection;

export interface CreateStubAPIOptions {
  decoChatApiUrl?: string;
  workspace?: string;
  token?: string;
  connection?: MCPConnectionProvider;
  debugId?: () => string;
  getErrorByStatusCode?: (
    statusCode: number,
    message?: string,
    traceId?: string,
  ) => Error;
}

export function createMCPFetchStub<TDefinition extends readonly ToolBinder[]>(
  options?: CreateStubAPIOptions,
): MCPClientFetchStub<TDefinition> {
  return createMCPClientProxy<MCPClientFetchStub<TDefinition>>(options);
}
