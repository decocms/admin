import type { ToolBinder } from "../index.ts";

/**
 * Matches a tool name against a pattern that may contain wildcards (*)
 * @param pattern The pattern to match against (e.g., "DECO_CHAT_VIEW_*")
 * @param toolName The actual tool name to test
 * @returns true if the tool name matches the pattern
 */
function toolMatchWithPatterns(pattern: string, toolName: string): boolean {
  // If no wildcard, do exact match
  if (!pattern.includes("*")) {
    return pattern === toolName;
  }

  // Support only wildcard at the end for now
  if (pattern.endsWith("*")) {
    return toolName.startsWith(pattern.slice(0, -1));
  }

  return false;
}

export const Binding = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    isImplementedBy: (tools: Pick<ToolBinder, "name">[]) => {
      return binder.every(
        (binding) => 
          binding.opt || 
          tools.some((tool) => 
            toolMatchWithPatterns(binding.name, tool.name)
          ),
      );
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
