/* oxlint-disable no-explicit-any */
import type { z } from "zod/v3";
import type { MCPConnection } from "../../models/mcp.ts";
import {
  createMCPFetchStub,
  createTool,
  type ToolBinder,
  type ToolLike,
} from "../index.ts";
import type { MCPClientFetchStub } from "../stub.ts";
import { WellKnownBindings } from "./index.ts";
export type Binder<TDefinition extends readonly ToolBinder[] = any> = {
  [K in keyof TDefinition]: TDefinition[K];
};

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
      return binder.every((tool) =>
        (tools ?? []).some((t) => t.name === tool.name),
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

export const ChannelBinding = bindingClient(WellKnownBindings.Channel);

export const ViewBinding = bindingClient(WellKnownBindings.View);

export type { Callbacks } from "./channels.ts";
export * from "./index.ts";

export const impl = <TBinder extends Binder<any>>(
  schema: TBinder,
  implementation: BinderImplementation<TBinder>,
  createToolFn: typeof createTool = createTool,
) => {
  const impl = [];
  for (const key in schema) {
    const toolSchema = schema[key];
    const toolImplementation = implementation[key];

    if (toolSchema.opt && !toolImplementation) {
      continue;
    }

    if (!toolImplementation) {
      throw new Error(`Implementation for ${key} is required`);
    }

    impl.push(createToolFn({ ...toolSchema, ...toolImplementation }));
  }
  return impl satisfies ToolLike[];
};
