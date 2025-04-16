/**
 * Key generation functions for React Query cache keys
 */
import type { FileSystemOptions } from "../index.ts";
import type { MCPConnection } from "../models/mcp.ts";

export const KEYS = {
  mcp: (context: string, mcpId?: string) => [
    "mcp",
    context,
    mcpId,
  ],
  threads: (context: string, agentId?: string) => [
    "threads",
    context,
    agentId,
  ],
  threadTools: (context: string, agentId: string, threadId: string) => [
    "tools",
    context,
    agentId,
    threadId,
  ],
  agent: (context: string, agentId?: string, threadId?: string) => [
    "agent",
    context,
    agentId,
    threadId,
  ],
  file: (path: string, options?: FileSystemOptions) => [
    "file",
    path,
    options,
  ],
  tools: (connection: MCPConnection) => [
    "tools",
    connection,
  ],
};
