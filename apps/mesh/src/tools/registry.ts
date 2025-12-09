/**
 * Tool Registry
 *
 * Metadata for all management tools, used for:
 * - OAuth consent UI (displaying available permissions)
 * - API documentation
 * - Tool discovery
 * - Role permission selection
 */

import { ALL_TOOLS } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  dangerous?: boolean; // Requires extra confirmation
}

export type ToolCategory = "Organizations" | "Connections";

/**
 * Union type of all tool names - derived from ALL_TOOLS
 * Use this for type-safe permission handling
 */
export type ToolName = (typeof ALL_TOOLS)[number]["name"];

/**
 * Permission option for UI components
 */
export interface PermissionOption {
  value: ToolName;
  label: string;
  dangerous?: boolean;
}

/**
 * Grouped permissions by category for UI
 */
export interface PermissionGroup {
  category: ToolCategory;
  label: string;
  permissions: PermissionOption[];
}

// ============================================================================
// Tool Categories Configuration
// ============================================================================

/**
 * Additional metadata for tools (category and danger flags)
 * This complements the tool definitions with UI-specific metadata
 */
const TOOL_CATEGORIES: Record<
  string,
  { category: ToolCategory; dangerous?: boolean }
> = {
  // Organization tools
  ORGANIZATION_CREATE: { category: "Organizations" },
  ORGANIZATION_LIST: { category: "Organizations" },
  ORGANIZATION_GET: { category: "Organizations" },
  ORGANIZATION_UPDATE: { category: "Organizations" },
  ORGANIZATION_DELETE: { category: "Organizations", dangerous: true },
  ORGANIZATION_SETTINGS_GET: { category: "Organizations" },
  ORGANIZATION_SETTINGS_UPDATE: { category: "Organizations" },
  ORGANIZATION_MEMBER_ADD: { category: "Organizations" },
  ORGANIZATION_MEMBER_REMOVE: { category: "Organizations", dangerous: true },
  ORGANIZATION_MEMBER_LIST: { category: "Organizations" },
  ORGANIZATION_MEMBER_UPDATE_ROLE: { category: "Organizations" },

  // Connection tools
  COLLECTION_CONNECTIONS_CREATE: { category: "Connections" },
  COLLECTION_CONNECTIONS_LIST: { category: "Connections" },
  COLLECTION_CONNECTIONS_GET: { category: "Connections" },
  COLLECTION_CONNECTIONS_UPDATE: { category: "Connections" },
  COLLECTION_CONNECTIONS_DELETE: { category: "Connections", dangerous: true },
  CONNECTION_TEST: { category: "Connections" },
  CONNECTION_CONFIGURE: { category: "Connections" },
};

/**
 * Human-readable labels for tool names
 */
const TOOL_LABELS: Partial<Record<ToolName, string>> = {
  ORGANIZATION_LIST: "List organizations",
  ORGANIZATION_GET: "View organization details",
  ORGANIZATION_UPDATE: "Update organization",
  ORGANIZATION_DELETE: "Delete organization",
  ORGANIZATION_SETTINGS_GET: "View organization settings",
  ORGANIZATION_SETTINGS_UPDATE: "Update organization settings",
  ORGANIZATION_MEMBER_LIST: "List members",
  ORGANIZATION_MEMBER_ADD: "Add members",
  ORGANIZATION_MEMBER_REMOVE: "Remove members",
  ORGANIZATION_MEMBER_UPDATE_ROLE: "Update member roles",
  COLLECTION_CONNECTIONS_LIST: "List connections",
  COLLECTION_CONNECTIONS_GET: "View connection details",
  COLLECTION_CONNECTIONS_CREATE: "Create connections",
  COLLECTION_CONNECTIONS_UPDATE: "Update connections",
  COLLECTION_CONNECTIONS_DELETE: "Delete connections",
  CONNECTION_TEST: "Test connections",
  CONNECTION_CONFIGURE: "Configure connections",
};

// ============================================================================
// Exports
// ============================================================================

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

/**
 * Get permission options for UI components (type-safe)
 * Returns flat array of all static permissions with labels
 */
export function getPermissionOptions(): PermissionOption[] {
  return MANAGEMENT_TOOLS.map((tool) => ({
    value: tool.name as ToolName,
    label: TOOL_LABELS[tool.name as ToolName] || tool.name,
    dangerous: tool.dangerous,
  }));
}
