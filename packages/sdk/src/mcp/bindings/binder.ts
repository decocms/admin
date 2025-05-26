import { MCPConnection } from "../../models/mcp.ts";
import { AppContext, createGlobalForContext, ToolBinder } from "../index.ts";
import { MCPClientFetchStub } from "../stub.ts";
import {
  TRIGGER_INPUT_BINDING_SCHEMA,
  TRIGGER_OUTPUT_BINDING_SCHEMA,
} from "./trigger.ts";

// deno-lint-ignore no-explicit-any
export type Binder<TDefinition extends readonly ToolBinder[] = any> = {
  [K in keyof TDefinition]: TDefinition[K];
};

export const bindingClient = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    implements: async (
      connectionOrTools: MCPConnection | ToolBinder[],
      ctx?: AppContext,
    ) => {
      const client = createGlobalForContext(ctx);
      const listedTools = Array.isArray(connectionOrTools)
        ? connectionOrTools
        : await client.INTEGRATIONS_LIST_TOOLS({
          connection: connectionOrTools,
        }).then((r) => r.tools).catch(() => []);

      return binder.every((tool) =>
        (listedTools ?? []).some((t) => t.name === tool.name)
      );
    },
    forConnection: (
      mcpConnection: MCPConnection,
      ctx?: AppContext,
    ): MCPClientFetchStub<TDefinition> => {
      const client = createGlobalForContext(ctx);
      return new Proxy<MCPClientFetchStub<TDefinition>>(
        {} as MCPClientFetchStub<TDefinition>,
        {
          get(_, name) {
            if (typeof name !== "string") {
              throw new Error("Name must be a string");
            }

            return (args: Record<string, unknown>) => {
              return client.INTEGRATIONS_CALL_TOOL({
                connection: mcpConnection,
                params: {
                  name,
                  arguments: args,
                },
              });
            };
          },
        },
      );
    },
  };
};

export type MCPBindingClient<T extends ReturnType<typeof bindingClient>> =
  ReturnType<
    T["forConnection"]
  >;

export const TriggerInputBinding = bindingClient(
  TRIGGER_INPUT_BINDING_SCHEMA,
);
export const TriggerOutputBinding = bindingClient(
  TRIGGER_OUTPUT_BINDING_SCHEMA,
);
export * from "./index.ts";
