import { useAgent, useThreadTools } from "@deco/sdk";
import { useMemo } from "react";

export const useTools = (agentId?: string, threadId?: string) => {
  const { data: agent } = agentId ? useAgent(agentId) : { data: null };
  const { data: threadTools } = threadId
    ? useThreadTools(threadId)
    : { data: null };

  return useMemo(
    () => threadTools?.tools_set ?? agent?.tools_set ?? {},
    [threadTools, agent],
  );
};
