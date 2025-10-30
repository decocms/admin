/**
 * Tool Registry
 * 
 * Metadata for all management tools, used for:
 * - OAuth consent UI (displaying available permissions)
 * - API documentation
 * - Tool discovery
 */

import { ALL_TOOLS } from './index';

export interface ToolMetadata {
  name: string;
  description: string;
  category: 'Projects' | 'Connections';
  dangerous?: boolean; // Requires extra confirmation
}

/**
 * Additional metadata for tools (category and danger flags)
 * This complements the tool definitions with UI-specific metadata
 */
const TOOL_CATEGORIES: Record<string, { category: 'Projects' | 'Connections'; dangerous?: boolean }> = {
  // Project tools
  PROJECT_CREATE: { category: 'Projects' },
  PROJECT_LIST: { category: 'Projects' },
  PROJECT_GET: { category: 'Projects' },
  PROJECT_UPDATE: { category: 'Projects' },
  PROJECT_DELETE: { category: 'Projects', dangerous: true },

  // Connection tools
  CONNECTION_CREATE: { category: 'Connections' },
  CONNECTION_LIST: { category: 'Connections' },
  CONNECTION_GET: { category: 'Connections' },
  CONNECTION_DELETE: { category: 'Connections', dangerous: true },
  CONNECTION_TEST: { category: 'Connections' },
};

/**
 * All management tools with metadata for consent UI
 * Derived from actual tool definitions + additional UI metadata
 */
export const MANAGEMENT_TOOLS: ToolMetadata[] = ALL_TOOLS.map(tool => {
  const additionalMeta = TOOL_CATEGORIES[tool.name] || { category: 'Projects' as const };
  
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
    Projects: [],
    Connections: [],
  };

  for (const tool of MANAGEMENT_TOOLS) {
    grouped[tool.category].push(tool);
  }

  return grouped;
}

/**
 * Get tool metadata by name
 */
export function getToolMetadata(name: string): ToolMetadata | undefined {
  return MANAGEMENT_TOOLS.find(t => t.name === name);
}

