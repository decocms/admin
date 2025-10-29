/**
 * Tool Registry
 * 
 * Central export for all MCP Mesh management tools
 */

import * as ProjectTools from './project';
import * as ConnectionTools from './connection';

// Export all tools
export { ProjectTools, ConnectionTools };

// All available tools
export const ALL_TOOLS = [
  ProjectTools.PROJECT_CREATE,
  ProjectTools.PROJECT_LIST,
  ProjectTools.PROJECT_GET,
  ProjectTools.PROJECT_UPDATE,
  ProjectTools.PROJECT_DELETE,
  
  ConnectionTools.CONNECTION_CREATE,
  ConnectionTools.CONNECTION_LIST,
  ConnectionTools.CONNECTION_GET,
  ConnectionTools.CONNECTION_DELETE,
  ConnectionTools.CONNECTION_TEST,
] as const;

// Tool lookup by name
export const TOOL_MAP = {
  PROJECT_CREATE: ProjectTools.PROJECT_CREATE,
  PROJECT_LIST: ProjectTools.PROJECT_LIST,
  PROJECT_GET: ProjectTools.PROJECT_GET,
  PROJECT_UPDATE: ProjectTools.PROJECT_UPDATE,
  PROJECT_DELETE: ProjectTools.PROJECT_DELETE,
  
  CONNECTION_CREATE: ConnectionTools.CONNECTION_CREATE,
  CONNECTION_LIST: ConnectionTools.CONNECTION_LIST,
  CONNECTION_GET: ConnectionTools.CONNECTION_GET,
  CONNECTION_DELETE: ConnectionTools.CONNECTION_DELETE,
  CONNECTION_TEST: ConnectionTools.CONNECTION_TEST,
} as const;

// Helper to get tool by name
export function getTool(name: string) {
  return TOOL_MAP[name as keyof typeof TOOL_MAP];
}

// Re-export toMCPToolDefinition for exposing tools via MCP protocol
export { toMCPToolDefinition } from '../core/define-tool';

