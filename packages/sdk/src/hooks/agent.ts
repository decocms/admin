/**
 * Agent specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { WELL_KNOWN_AGENT_IDS } from "../constants.ts";
import {
  AgentNotFoundError,
  createAgent,
  deleteAgent,
  listAgents,
  loadAgent,
  updateAgent,
} from "../crud/agent.ts";
import type { Agent } from "../models/agent.ts";
import { stub } from "../stub.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(workspace, agent),
    onSuccess: (result) => {
      const key = KEYS.AGENT(workspace, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(
        KEYS.AGENT(workspace),
        (old: Agent[] | undefined) => {
          if (!old) return [result];
          return [result, ...old];
        },
      );
    },
  });

  return create;
};

export const useUpdateAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(workspace, agent),
    onSuccess: (updatedAgent) => {
      // Update the individual agent in cache
      client.setQueryData(
        KEYS.AGENT(workspace, updatedAgent.id),
        updatedAgent,
      );

      // Update the list
      client.setQueryData(
        KEYS.AGENT(workspace),
        (old: Agent[] | undefined) => {
          if (!old) return [updatedAgent];
          return old.map((agent) =>
            agent.id === updatedAgent.id ? updatedAgent : agent
          );
        },
      );
    },
  });

  return update;
};

export const useRemoveAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (agentId: string) => deleteAgent(workspace, agentId),
    onSuccess: (_, agentId) => {
      // Remove the individual agent from cache
      client.removeQueries({ queryKey: KEYS.AGENT(workspace, agentId) });

      // Update the list
      client.setQueryData(KEYS.AGENT(workspace), (old: Agent[]) => {
        if (!old) return old;
        return old.filter((agent: Agent) => agent.id !== agentId);
      });
    },
  });

  return remove;
};

/** Hook for crud-like operations on agents */
export const useAgent = (agentId: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace, agentId),
    queryFn: () => loadAgent(workspace, agentId),
    retry: (failureCount, error) =>
      error instanceof AgentNotFoundError ? false : failureCount < 2,
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace),
    queryFn: () => listAgents(workspace).then((r) => r.items),
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { workspace } = useSDK();

  const root = useMemo(
    () => `/${workspace}/Agents/${agentId}`,
    [workspace, agentId],
  );

  return root;
};

// TODO: I guess we can improve this and have proper typings
export const useAgentStub = (
  agentId = WELL_KNOWN_AGENT_IDS.teamAgent,
  threadId?: string,
) => {
  const agentRoot = useAgentRoot(agentId);

  return useMemo(
    // deno-lint-ignore no-explicit-any
    () => stub<any>("AIAgent").new(agentRoot).withMetadata({ threadId }),
    [agentRoot, threadId],
  );
};

export const useInvalidateAll = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.invalidateQueries({
        predicate: (_query) => true,
      }),
  });
};
