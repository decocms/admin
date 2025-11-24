/**
 * Tool Registry
 *
 * Central export for all MCP Mesh management tools
 */

import * as ConnectionTools from "./connection";
import * as OrganizationTools from "./organization";

// All available tools
export const ALL_TOOLS = [
  OrganizationTools.ORGANIZATION_CREATE,
  OrganizationTools.ORGANIZATION_LIST,
  OrganizationTools.ORGANIZATION_GET,
  OrganizationTools.ORGANIZATION_UPDATE,
  OrganizationTools.ORGANIZATION_DELETE,
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


export type MCPMeshTools = typeof ALL_TOOLS;
