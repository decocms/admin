import { useLocalStorage, useLocalStorageSetter } from "./useLocalStorage.ts";

const key = (agentId: string) => `agent-overrides-${agentId}`;

export interface AgentOverrides {
  instructions?: string;
}

export function useAgentOverridesSetter(agentId: string) {
  return useLocalStorageSetter<AgentOverrides | null>({
    key: key(agentId),
  });
}

export function getAgentOverrides(agentId: string) {
  return localStorage.getItem(key(agentId)) as AgentOverrides | null;
}

export function useAgentHasChanges(agentId: string) {
  const query = useLocalStorage<AgentOverrides | null, boolean>({
    key: key(agentId),
    defaultValue: null,
    select: (data) => data !== null,
  });

  return {
    hasChanges: query.value,
    discardCurrentChanges: () => query.update(null),
  };
}
