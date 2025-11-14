import type { Tool } from "ai";
import { WELL_KNOWN_DECOPILOT_AGENTS, type AgentId } from "@deco/sdk";

/**
 * Filter tools based on the current agent ID
 * Only includes tools whose names are in the allowed set for the agent
 */
export function filterToolsForAgent(
  tools: Record<string, Tool>,
  agentId: AgentId,
): Record<string, Tool> {
  const agent = WELL_KNOWN_DECOPILOT_AGENTS[agentId];
  const allowedToolNames = agent?.tools ?? [];
  const filtered: Record<string, Tool> = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (allowedToolNames.includes(name)) {
      filtered[name] = tool;
    }
  }

  return filtered;
}
