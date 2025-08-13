import type { ToolBinder } from "../index.ts";

export const Binding = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    isImplementedBy: (tools: Pick<ToolBinder, "name">[]) => {
      const result = binder.every(
        (tool) => tool.opt || tools.some((t) => t.name === tool.name),
      );
      return result;
    },
    /**
     * Checks binding satisfaction with a single tool.
     * This assumes the binder used has only one tool.
     */
    isImplementedByTool: (tool: Pick<ToolBinder, "name">) => {
      return Binding(binder).isImplementedBy([tool]);
    },
    /**
     * Filters tools that satisfy the binding.
     * This assumes the binder used has only one tool.
     * @param tools - The tools to filter.
     * @returns The tools that satisfy the binding.
     */
    filterImplementingTools: (tools: Pick<ToolBinder, "name">[]) => {
      return tools.filter((tool) => Binding(binder).isImplementedByTool(tool));
    },
  };
};
