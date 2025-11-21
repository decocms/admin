import { create } from "zustand";
import type { AgentId } from "@deco/sdk";
import { WELL_KNOWN_DECOPILOT_AGENTS } from "@deco/sdk";

// Helper function to get initial agentId from query string
function getInitialAgentId(): AgentId {
  if (typeof window === "undefined") {
    return "explore";
  }

  const params = new URLSearchParams(window.location.search);
  const agentIdFromQuery = params.get("agentId");

  // Validate that it's a valid agent ID
  if (agentIdFromQuery && agentIdFromQuery in WELL_KNOWN_DECOPILOT_AGENTS) {
    return agentIdFromQuery as AgentId;
  }

  return "explore";
}

interface AgentState {
  agentId: AgentId;
  setAgentId: (agentId: AgentId) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentId: getInitialAgentId(),
  setAgentId: (agentId) => set({ agentId }),
}));
