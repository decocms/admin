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
  createTempAgent,
  deleteAgent,
  listAgents,
  loadAgent,
  updateAgent,
} from "../crud/agent.ts";
import { ForbiddenError, UnauthorizedError } from "../errors.ts";
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
      // update item
      const itemKey = KEYS.AGENT(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(
        listKey,
        (old) => !old ? [result] : [result, ...old],
      );
    },
  });

  return create;
};

export const useCreateTempAgent = () => {
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: ({ agentId, userId }: { agentId: string; userId: string }) =>
      createTempAgent(workspace, agentId, userId),
  });

  return create;
};

export const useUpdateAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(workspace, agent),
    onSuccess: (result) => {
      // Update the individual agent in cache
      const itemKey = KEYS.AGENT(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // Update the list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(
        listKey,
        (old) =>
          !old
            ? [result]
            : old.map((agent) => agent.id === result.id ? result : agent),
      );

      // Update thread tools because it may have been changed
      const toolsKey = ["tools"];
      client.cancelQueries({ queryKey: toolsKey });
      client.invalidateQueries({ queryKey: toolsKey, exact: false });
    },
  });

  return update;
};

export const useRemoveAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteAgent(workspace, id),
    onSuccess: (_, id) => {
      // Remove the individual agent from cache
      const itemKey = KEYS.AGENT(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(
        listKey,
        (old) => !old ? [] : old.filter((agent) => agent.id !== id),
      );
    },
  });

  return remove;
};

/** Hook for crud-like operations on agents */
export const useAgent = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace, id),
    queryFn: ({ signal }) => loadAgent(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof AgentNotFoundError ||
        error instanceof UnauthorizedError ||
        error instanceof ForbiddenError
        ? false
        : failureCount < 2,
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace),
    queryFn: async ({ signal }) => {
      const items = await listAgents(workspace, signal);

      for (const item of items) {
        const itemKey = KEYS.AGENT(workspace, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Agent>(itemKey, item);
      }

      return items;
    },
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
  agentId: string = WELL_KNOWN_AGENT_IDS.teamAgent,
  threadId?: string,
) => {
  const agentRoot = useAgentRoot(agentId);

  return useMemo(
    // deno-lint-ignore no-explicit-any
    () => stub<any>("AIAgent").new(agentRoot).withMetadata({ threadId }),
    [agentRoot, threadId],
  );
};
