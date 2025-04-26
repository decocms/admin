import { DEFAULT_REASONING_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./useLocalStorage.ts";

export interface AgentOverrides {
  model: string;
  instructions: string | null;
}

export function useAgentOverrides(agentRoot: string) {
  return useLocalStorage<AgentOverrides>({
    key: `agent-overrides-${agentRoot}`,
    defaultValue: {
      model: DEFAULT_REASONING_MODEL,
      instructions: null,
    },
  });
}
