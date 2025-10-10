// deno-lint-ignore-file no-explicit-any
import type { z } from "zod";
import type { MCPConnection } from "../connection.ts";
import { createPrivateTool } from "../mastra.ts";
import {
  createMCPFetchStub,
  type MCPClientFetchStub,
  type ToolBinder,
} from "../mcp.ts";
import { CHANNEL_BINDING_SCHEMA } from "./channels.ts";
import { VIEW_BINDING_SCHEMA } from "./views.ts";

// ToolLike is a simplified version of the Tool interface that matches what we need for bindings
export interface ToolLike<
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  name: TName;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  handler: (props: TInput) => Promise<TReturn> | TReturn;
}

export type Binder<
  TDefinition extends readonly ToolBinder[] = readonly ToolBinder[],
> = TDefinition;

export type BinderImplementation<
  TBinder extends Binder<any>,
  TContext = any,
> = TBinder extends Binder<infer TDefinition>
  ? {
      [K in keyof TDefinition]: Omit<
        ToolLike<
          TDefinition[K]["name"],
          z.infer<TDefinition[K]["inputSchema"]>,
          TDefinition[K] extends { outputSchema: infer Schema }
            ? Schema extends z.ZodType
              ? z.infer<Schema>
              : never
            : never
        >,
        "name" | "inputSchema" | "outputSchema" | "handler"
      > & {
        handler: (
          props: z.infer<TDefinition[K]["inputSchema"]>,
          c?: TContext,
        ) => ReturnType<
          ToolLike<
            TDefinition[K]["name"],
            z.infer<TDefinition[K]["inputSchema"]>,
            TDefinition[K] extends { outputSchema: infer Schema }
              ? Schema extends z.ZodType
                ? z.infer<Schema>
                : never
              : never
          >["handler"]
        >;
      };
    }
  : never;

export const bindingClient = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    implements: (tools: ToolBinder[]) => {
      return binder.every(
        (tool) =>
          tool.opt === true || (tools ?? []).some((t) => t.name === tool.name),
      );
    },
    forConnection: (
      mcpConnection: MCPConnection,
    ): MCPClientFetchStub<TDefinition> => {
      const stub = createMCPFetchStub<TDefinition>({
        connection: mcpConnection,
      });
      return new Proxy<MCPClientFetchStub<TDefinition>>(
        {} as MCPClientFetchStub<TDefinition>,
        {
          get(_, name) {
            if (typeof name !== "string") {
              throw new Error("Name must be a string");
            }

            return (args: Record<string, unknown>) => {
              return (
                stub[name as keyof MCPClientFetchStub<TDefinition>] as (
                  args: Record<string, unknown>,
                ) => Promise<unknown>
              )(args);
            };
          },
        },
      );
    },
  };
};

export type MCPBindingClient<T extends ReturnType<typeof bindingClient>> =
  ReturnType<T["forConnection"]>;

export const ChannelBinding = bindingClient(CHANNEL_BINDING_SCHEMA);

export const ViewBinding = bindingClient(VIEW_BINDING_SCHEMA);

export type { Callbacks } from "./channels.ts";

export const impl = <TBinder extends Binder>(
  schema: TBinder,
  implementation: BinderImplementation<TBinder>,
  createToolFn = createPrivateTool,
): ReturnType<typeof createToolFn>[] => {
  const impl: ReturnType<typeof createToolFn>[] = [];
  for (const key in schema) {
    const toolSchema = schema[key];
    const toolImplementation = implementation[key];

    if (toolSchema.opt && !toolImplementation) {
      continue;
    }

    if (!toolImplementation) {
      throw new Error(`Implementation for ${key} is required`);
    }

    const { name, handler, ...toolLike }: ToolLike = {
      ...toolSchema,
      ...toolImplementation,
    };
    impl.push(
      createToolFn({
        ...toolLike,
        id: name,
        execute: ({ context }) => Promise.resolve(handler(context)),
      }),
    );
  }
  return impl;
};
