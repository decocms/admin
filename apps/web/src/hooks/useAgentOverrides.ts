import {
  useLocalStorageChange,
  useLocalStorageSetter,
} from "./useLocalStorage.ts";
import { useState } from "react";

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
  try {
    const result = localStorage.getItem(key(agentId));
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

export function useAgentHasChanges(agentId: string) {
  const [hasChanges, setHasChanges] = useState(false);

  useLocalStorageChange(key(agentId), (value) => {
    setHasChanges(value !== null);
  });

  const { update } = useAgentOverridesSetter(agentId);

  return {
    hasChanges,
    discardCurrentChanges: () => update(null),
  };
}

export function useOnAgentChangesDiscarded(
  agentId: string,
  callback: () => void,
) {
  useLocalStorageChange(key(agentId), (value) => {
    if (value === null) {
      callback();
    }
  });
}
