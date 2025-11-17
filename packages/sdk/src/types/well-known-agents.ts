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
    name: "Planner",
    avatar:
      "https://assets.decocache.com/decocms/b123907c-068d-4b7b-b0a9-acde14ea02db/decopilot.png", // Purple
    tools: [
      "DECO_RESOURCE_MCP_READ",
      "DECO_RESOURCE_TOOL_READ",
      "DECO_RESOURCE_TOOL_SEARCH",
      "DECO_RESOURCE_WORKFLOW_READ",
      "DECO_RESOURCE_WORKFLOW_SEARCH",
      "DECO_RESOURCE_VIEW_READ",
      "DECO_RESOURCE_VIEW_SEARCH",
      "DECO_RESOURCE_DOCUMENT_CREATE",
      "DECO_RESOURCE_DOCUMENT_UPDATE",
      "DECO_RESOURCE_DOCUMENT_READ",
      "DECO_RESOURCE_DOCUMENT_SEARCH",
      "DECO_RESOURCE_MCP_STORE_SEARCH",
    ],
  },
  code: {
    id: "code",
    name: "Builder",
    avatar:
      "https://assets.decocache.com/decocms/46f8ea4a-7383-4562-ab74-e7fdf46a3a76/decopilot.png", // Orange
    tools: [
      "DECO_RESOURCE_MCP_READ",
      "DECO_TOOL_RUN_TOOL",
      "DECO_RESOURCE_TOOL_CREATE",
      "DECO_RESOURCE_TOOL_UPDATE",
      "DECO_RESOURCE_TOOL_DELETE",
      "DECO_RESOURCE_TOOL_READ",
      "DECO_RESOURCE_TOOL_SEARCH",
      "DECO_RESOURCE_WORKFLOW_CREATE",
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_RESOURCE_WORKFLOW_DELETE",
      "DECO_RESOURCE_WORKFLOW_READ",
      "DECO_RESOURCE_WORKFLOW_SEARCH",
      "DECO_RESOURCE_VIEW_CREATE",
      "DECO_RESOURCE_VIEW_UPDATE",
      "DECO_RESOURCE_VIEW_DELETE",
      "DECO_RESOURCE_VIEW_READ",
      "DECO_RESOURCE_VIEW_SEARCH",
      "DECO_RESOURCE_MCP_STORE_SEARCH",
    ],
  },
  explore: {
    id: "explore",
    name: "Explorer",
    avatar:
      "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png", // Green
    tools: [
      "DECO_RESOURCE_MCP_READ",
      "DECO_TOOL_RUN_TOOL",
      "DECO_RESOURCE_MCP_STORE_SEARCH",
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
 * Falls back to explore agent avatar if agentId is not recognized
 */
export function getAgentAvatar(agentId: AgentId | string | undefined): string {
  const agent = getAgent(agentId);
  return agent?.avatar ?? WELL_KNOWN_DECOPILOT_AGENTS.explore.avatar;
}

/**
 * Get agent display name for a given agent ID
 */
export function getAgentName(agentId: AgentId | string | undefined): string {
  const agent = getAgent(agentId);
  return agent?.name ?? "Assistant";
}
/**
 * Check if an agentId is a well-known decopilot agent
 * Includes both the new well-known agents (design, code, explore) and
 * the legacy "decopilotAgent" ID for backward compatibility
 */
export function isWellKnownDecopilotAgent(
  agentId: string | undefined,
): agentId is AgentId | "decopilotAgent" {
  if (!agentId) return false;
  // Check if it's one of the well-known decopilot agents
  if (agentId in WELL_KNOWN_DECOPILOT_AGENTS) return true;
  // Also accept legacy "decopilotAgent" ID for backward compatibility
  if (agentId === "decopilotAgent") return true;
  return false;
}
