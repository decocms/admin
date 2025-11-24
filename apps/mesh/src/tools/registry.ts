/**
 * Tool Registry
 *
 * Metadata for all management tools, used for:
 * - OAuth consent UI (displaying available permissions)
 * - API documentation
 * - Tool discovery
 */

import { ALL_TOOLS } from "./index";

export interface ToolMetadata {
  name: string;
  description: string;
  category: "Organizations" | "Connections";
  dangerous?: boolean; // Requires extra confirmation
}

/**
 * Additional metadata for tools (category and danger flags)
 * This complements the tool definitions with UI-specific metadata
 */
const TOOL_CATEGORIES: Record<
  string,
  { category: "Organizations" | "Connections"; dangerous?: boolean }
> = {
  // Organization tools
  ORGANIZATION_CREATE: { category: "Organizations" },
  ORGANIZATION_LIST: { category: "Organizations" },
  ORGANIZATION_GET: { category: "Organizations" },
  ORGANIZATION_UPDATE: { category: "Organizations" },
  ORGANIZATION_DELETE: { category: "Organizations", dangerous: true },
  ORGANIZATION_MEMBER_ADD: { category: "Organizations" },
  ORGANIZATION_MEMBER_REMOVE: { category: "Organizations", dangerous: true },
  ORGANIZATION_MEMBER_LIST: { category: "Organizations" },
  ORGANIZATION_MEMBER_UPDATE_ROLE: { category: "Organizations" },

  // Connection tools
  CONNECTION_CREATE: { category: "Connections" },
  CONNECTION_LIST: { category: "Connections" },
  CONNECTION_GET: { category: "Connections" },
  CONNECTION_UPDATE: { category: "Connections" },
  CONNECTION_DELETE: { category: "Connections", dangerous: true },
  CONNECTION_TEST: { category: "Connections" },
};

/**
 * All management tools with metadata for consent UI
 * Derived from actual tool definitions + additional UI metadata
 */
export const MANAGEMENT_TOOLS: ToolMetadata[] = ALL_TOOLS.map((tool) => {
  const additionalMeta = TOOL_CATEGORIES[tool.name] || {
    category: "Connections" as const,
  };

  return {
    name: tool.name,
    description: tool.description,
    category: additionalMeta.category,
    dangerous: additionalMeta.dangerous,
  };
});

/**
 * Get tools grouped by category
 */
export function getToolsByCategory() {
  const grouped: Record<string, ToolMetadata[]> = {
    Organizations: [],
    Connections: [],
  };

  for (const tool of MANAGEMENT_TOOLS) {
    grouped[tool.category]?.push(tool);
  }

  return grouped;
}
