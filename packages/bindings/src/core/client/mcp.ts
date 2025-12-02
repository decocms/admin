/* oxlint-disable no-explicit-any */
import { z } from "zod";
import type { MCPConnection } from "../connection";
import { createMCPClientProxy } from "./proxy";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

// Default fetcher instance with API_SERVER_URL and API_HEADERS
import type { ToolBinder } from "../binder";
export type { ToolBinder };

export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    string,
    infer TInput,
    infer TReturn
  >
    ? (params: TInput, init?: RequestInit) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K["streamable"] extends true
    ? K extends ToolBinder<string, infer TInput, any, true>
      ? (params: TInput, init?: RequestInit) => Promise<Response>
      : never
    : K extends ToolBinder<string, infer TInput, infer TReturn, any>
      ? (params: TInput, init?: RequestInit) => Promise<Awaited<TReturn>>
      : never;
};

export interface MCPClientRaw {
  callTool: (tool: string, args: unknown) => Promise<unknown>;
  listTools: () => Promise<
    {
      name: string;
      inputSchema: any;
      outputSchema?: any;
      description: string;
    }[]
  >;
}
export type JSONSchemaToZodConverter = (jsonSchema: any) => z.ZodTypeAny;
export interface CreateStubAPIOptions {
  connection: MCPConnection;
  streamable?: Record<string, boolean>;
  debugId?: () => string;
  getErrorByStatusCode?: (
    statusCode: number,
    message?: string,
    traceId?: string,
    errorObject?: unknown,
  ) => Error;
}

export function createMCPFetchStub<TDefinition extends readonly ToolBinder[]>(
  options: CreateStubAPIOptions,
): MCPClientFetchStub<TDefinition> {
  return createMCPClientProxy<MCPClientFetchStub<TDefinition>>(options);
}
