import type { ToolBinder } from "../index.ts";

export const Binding = <TDefinition extends readonly ToolBinder[]>(
  binderTools: TDefinition,
) => {
  return {
    isImplementedBy: (tools: Pick<ToolBinder, "name">[]) => {
      const requiredTools = binderTools
        .filter((tool) => !tool.opt)
        .map(
          (tool) =>
            typeof tool.name === "string"
              ? new RegExp(`^${tool.name}$`) // exact match
              : (tool.name as RegExp), // regex match
        );

      return requiredTools.every((regexp) =>
        tools.some((t) => regexp.test(t.name)),
      );
    },
  };
};
