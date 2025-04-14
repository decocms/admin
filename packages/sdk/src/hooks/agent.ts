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
import { listThreads } from "../crud/thread.ts";
import type { Agent } from "../models/agent.ts";
import { stub } from "../stub.ts";
import { useSDK } from "./store.tsx";

const getKeyFor = (
  context: string,
  agentId?: string,
  threadId?: string,
) => ["agent", context, agentId, threadId];

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { context } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(context, agent),
    onSuccess: (result) => {
      const key = getKeyFor(context, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(getKeyFor(context), (old: Agent[] | undefined) => {
        if (!old) return [result];
        return [result, ...old];
      });

      // invalidate list
      client.invalidateQueries({ queryKey: getKeyFor(context) });
    },
  });

  return create;
};

export const useUpdateAgent = () => {
  const client = useQueryClient();
  const { context: root } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(root, agent),
    onMutate: async (updatedAgent) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousAgents = client.getQueryData(getKeyFor(root)) as
        | Agent[]
        | undefined;

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Agent[] | undefined) => {
        if (!old) return [updatedAgent];
        return old.map((agent) =>
          agent.id === updatedAgent.id ? updatedAgent : agent
        );
      });

      // Update the individual agent in cache
      client.setQueryData(getKeyFor(root, updatedAgent.id), updatedAgent);

      return { previousAgents } as const;
    },
    onError: (_err, _updatedAgent, context) => {
      // Rollback to the previous value
      if (context?.previousAgents) {
        client.setQueryData(getKeyFor(root), context.previousAgents);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return update;
};

export const useRemoveAgent = () => {
  const client = useQueryClient();
  const { context: root } = useSDK();

  const remove = useMutation({
    mutationFn: (agentId: string) => deleteAgent(root, agentId),
    onMutate: async (agentId) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousAgents = client.getQueryData<Agent[]>(getKeyFor(root));

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Agent[]) => {
        if (!old) return old;
        return old.filter((agent: Agent) => agent.id !== agentId);
      });

      // Remove the individual agent from cache
      client.removeQueries({ queryKey: getKeyFor(root, agentId) });

      return { previousAgents };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback to the previous value
      if (ctx?.previousAgents) {
        client.setQueryData(getKeyFor(root), ctx.previousAgents);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return remove;
};

/** Hook for crud-like operations on agents */
export const useAgent = (agentId: string) => {
  const { context } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, agentId),
    queryFn: () => loadAgent(context, agentId),
    retry: (failureCount, error) =>
      error instanceof AgentNotFoundError ? false : failureCount < 2,
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { context } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context),
    queryFn: () => listAgents(context).then((r) => r.items),
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { context } = useSDK();

  const root = useMemo(
    () => `/${context}/Agents/${agentId}`,
    [context, agentId],
  );

  return root;
};

/** Hook for fetching messages from an agent */
export const useMessages = (agentId: string, threadId: string) => {
  const { context } = useSDK();
  const agentStub = useAgentStub(agentId, threadId);

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, agentId, threadId),
    queryFn: () => agentStub.query(),
  });

  return data;
};

/** Hook for fetching threads from an agent */
export const useThreads = (agentId: string) => {
  const { context } = useSDK();
  const agentStub = useAgentStub(agentId);

  return useSuspenseQuery({
    queryKey: [...getKeyFor(context, agentId), "threads"],
    queryFn: () => agentStub.listThreads(),
  });
};

/** Hook for fetching all threads for the user */
export const useAllThreads = () => {
  const { context } = useSDK();

  return useSuspenseQuery({
    queryKey: [...getKeyFor(context), "user-threads"],
    queryFn: () => listThreads(context),
  });
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
