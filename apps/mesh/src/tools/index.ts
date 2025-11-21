/**
 * Tool Registry
 *
 * Central export for all MCP Mesh management tools
 */

import * as ConnectionTools from "./connection";
import * as OrganizationTools from "./organization";

// Export all tools
export { ConnectionTools, OrganizationTools };

// All available tools
export const ALL_TOOLS = [
  OrganizationTools.ORGANIZATION_CREATE,
  OrganizationTools.ORGANIZATION_LIST,
  OrganizationTools.ORGANIZATION_GET,
  OrganizationTools.ORGANIZATION_UPDATE,
  OrganizationTools.ORGANIZATION_DELETE,
  OrganizationTools.ORGANIZATION_SETTINGS_GET,
  OrganizationTools.ORGANIZATION_SETTINGS_UPDATE,
  OrganizationTools.ORGANIZATION_MEMBER_ADD,
  OrganizationTools.ORGANIZATION_MEMBER_REMOVE,
  OrganizationTools.ORGANIZATION_MEMBER_LIST,
  OrganizationTools.ORGANIZATION_MEMBER_UPDATE_ROLE,

  ConnectionTools.CONNECTION_CREATE,
  ConnectionTools.CONNECTION_LIST,
  ConnectionTools.CONNECTION_GET,
  ConnectionTools.CONNECTION_UPDATE,
  ConnectionTools.CONNECTION_DELETE,
  ConnectionTools.CONNECTION_TEST,
] as const;

// Tool lookup by name
export const TOOL_MAP = {
  ORGANIZATION_CREATE: OrganizationTools.ORGANIZATION_CREATE,
  ORGANIZATION_LIST: OrganizationTools.ORGANIZATION_LIST,
  ORGANIZATION_GET: OrganizationTools.ORGANIZATION_GET,
  ORGANIZATION_UPDATE: OrganizationTools.ORGANIZATION_UPDATE,
  ORGANIZATION_DELETE: OrganizationTools.ORGANIZATION_DELETE,
  ORGANIZATION_SETTINGS_GET: OrganizationTools.ORGANIZATION_SETTINGS_GET,
  ORGANIZATION_SETTINGS_UPDATE: OrganizationTools.ORGANIZATION_SETTINGS_UPDATE,
  ORGANIZATION_MEMBER_ADD: OrganizationTools.ORGANIZATION_MEMBER_ADD,
  ORGANIZATION_MEMBER_REMOVE: OrganizationTools.ORGANIZATION_MEMBER_REMOVE,
  ORGANIZATION_MEMBER_LIST: OrganizationTools.ORGANIZATION_MEMBER_LIST,
  ORGANIZATION_MEMBER_UPDATE_ROLE:
    OrganizationTools.ORGANIZATION_MEMBER_UPDATE_ROLE,

  CONNECTION_CREATE: ConnectionTools.CONNECTION_CREATE,
  CONNECTION_LIST: ConnectionTools.CONNECTION_LIST,
  CONNECTION_GET: ConnectionTools.CONNECTION_GET,
  CONNECTION_UPDATE: ConnectionTools.CONNECTION_UPDATE,
  CONNECTION_DELETE: ConnectionTools.CONNECTION_DELETE,
  CONNECTION_TEST: ConnectionTools.CONNECTION_TEST,
} as const;

export type MCPMeshTools = typeof ALL_TOOLS;

// Helper to get tool by name
export function getTool(name: string) {
  return TOOL_MAP[name as keyof typeof TOOL_MAP];
}
