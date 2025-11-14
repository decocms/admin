import { create } from "zustand";
import type { AgentId } from "@deco/sdk";

interface AgentState {
  agentId: AgentId;
  pendingAgentChange: {
    agentId: AgentId;
    reasoning: string;
    confidence: number;
  } | null;
  setAgentId: (agentId: AgentId) => void;
  requestAgentChange: (decision: {
    agentId: AgentId;
    reasoning: string;
    confidence: number;
  }) => void;
  confirmAgentChange: () => void;
  rejectAgentChange: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentId: "code",
  pendingAgentChange: null,
  setAgentId: (agentId) => set({ agentId, pendingAgentChange: null }),
  requestAgentChange: (decision) => set({ pendingAgentChange: decision }),
  confirmAgentChange: () =>
    set((state) => {
      if (state.pendingAgentChange) {
        return {
          agentId: state.pendingAgentChange.agentId,
          pendingAgentChange: null,
        };
      }
      return state;
    }),
  rejectAgentChange: () => set({ pendingAgentChange: null }),
}));
