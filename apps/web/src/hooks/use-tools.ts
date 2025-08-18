import { useAgentData } from '@deco/sdk';
import { useMemo } from 'react';

export const useTools = (agentId?: string) => {
  const { data: agent } = agentId ? useAgentData(agentId) : { data: null };

  return useMemo(() => agent?.tools_set ?? {}, [agent]);
};
