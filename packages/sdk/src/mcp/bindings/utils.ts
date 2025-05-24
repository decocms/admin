import type { ToolBinder } from "../index.ts";

export const Binding = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    isImplementedBy: (tools: ToolBinder[]) => {
      return binder.every((tool) => tools.some((t) => t.name === tool.name));
    },
  };
};
