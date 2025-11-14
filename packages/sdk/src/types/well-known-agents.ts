/**
 * Well-known decopilot agents configuration
 * Defines the available decopilot agents with their IDs, names, avatars, and allowed tools
 */

export type AgentId = "design" | "code" | "explore";

export interface WellKnownDecopilotAgent {
  id: AgentId;
  name: string;
  avatar: string;
  tools: string[];
}

/**
 * Well-known decopilot agents with their configuration
 */
export const WELL_KNOWN_DECOPILOT_AGENTS: Record<
  AgentId,
  WellKnownDecopilotAgent
> = {
  design: {
    id: "design",
    name: "Design Agent",
    avatar:
      "https://assets.decocache.com/decocms/b123907c-068d-4b7b-b0a9-acde14ea02db/decopilot.png", // Purple
    tools: [
      "READ_MCP",
      "TOOL_READ",
      "TOOL_SEARCH",
      "WORKFLOW_READ",
      "WORKFLOW_SEARCH",
      "VIEW_READ",
      "VIEW_SEARCH",
      "DOCUMENT_CREATE",
      "DOCUMENT_UPDATE",
      "DOCUMENT_READ",
      "DOCUMENT_SEARCH",
      "DISCOVER_MCP_TOOLS",
      "INSTALL_MARKETPLACE_INTEGRATION",
    ],
  },
  code: {
    id: "code",
    name: "Code Agent",
    avatar:
      "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png", // Green
    tools: [
      "READ_MCP",
      "EXECUTE_CODE",
      "TOOL_CREATE",
      "TOOL_UPDATE",
      "TOOL_DELETE",
      "TOOL_READ",
      "TOOL_SEARCH",
      "WORKFLOW_CREATE",
      "WORKFLOW_UPDATE",
      "WORKFLOW_DELETE",
      "WORKFLOW_READ",
      "WORKFLOW_SEARCH",
      "VIEW_CREATE",
      "VIEW_UPDATE",
      "VIEW_DELETE",
      "VIEW_READ",
      "VIEW_SEARCH",
      "DISCOVER_MCP_TOOLS",
      "INSTALL_MARKETPLACE_INTEGRATION",
    ],
  },
  explore: {
    id: "explore",
    name: "Explore Agent",
    avatar:
      "https://assets.decocache.com/decocms/46f8ea4a-7383-4562-ab74-e7fdf46a3a76/decopilot.png", // Orange
    tools: [
      "READ_MCP",
      "EXECUTE_CODE",
      "DISCOVER_MCP_TOOLS",
      "INSTALL_MARKETPLACE_INTEGRATION",
    ],
  },
};

/**
 * Tool names that are allowed for each agent
 * @deprecated Use WELL_KNOWN_DECOPILOT_AGENTS[agentId].tools instead
 */
export const AGENT_TOOL_SETS: Record<AgentId, string[]> = Object.fromEntries(
  Object.entries(WELL_KNOWN_DECOPILOT_AGENTS).map(([id, agent]) => [
    id,
    agent.tools,
  ]),
) as Record<AgentId, string[]>;

/**
 * Get agent configuration by ID
 */
export function getAgent(
  agentId: AgentId | string | undefined,
): WellKnownDecopilotAgent | undefined {
  if (!agentId || !(agentId in WELL_KNOWN_DECOPILOT_AGENTS)) {
    return undefined;
  }
  return WELL_KNOWN_DECOPILOT_AGENTS[agentId as AgentId];
}

/**
 * Get agent avatar URL for a given agent ID
 * Falls back to code agent avatar if agentId is not recognized
 */
export function getAgentAvatar(agentId: AgentId | string | undefined): string {
  const agent = getAgent(agentId);
  return agent?.avatar ?? WELL_KNOWN_DECOPILOT_AGENTS.code.avatar;
}

/**
 * Get agent display name for a given agent ID
 */
export function getAgentName(agentId: AgentId | string | undefined): string {
  const agent = getAgent(agentId);
  return agent?.name ?? "Assistant";
}

