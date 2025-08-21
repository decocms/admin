import { useState, useEffect } from "react";
import { WELL_KNOWN_AGENTS } from "@deco/sdk";

const CURRENT_AGENT_KEY = "decopilot-current-agent";

export function useCurrentAgent() {
  const [currentAgentId, setCurrentAgentIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CURRENT_AGENT_KEY);
      return stored || WELL_KNOWN_AGENTS.decopilotAgent.id;
    }
    return WELL_KNOWN_AGENTS.decopilotAgent.id;
  });

  const setCurrentAgentId = (agentId: string) => {
    setCurrentAgentIdState(agentId);
    localStorage.setItem(CURRENT_AGENT_KEY, agentId);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CURRENT_AGENT_KEY);
      if (stored && stored !== currentAgentId) {
        setCurrentAgentIdState(stored);
      }
    }
  }, []);

  return {
    currentAgentId,
    setCurrentAgentId,
  };
}
