import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createAgent,
  deleteAgent,
  listAgents,
  loadAgent,
  saveAgent,
} from "../crud/agent.ts";
import type { Agent } from "../models/agent.ts";
import { stub } from "../stub.ts";
import { useSDK } from "./store.tsx";

const getKeyFor = (
  context: string,
  agentId?: string,
  threadId?: string,
) => ["agent", context, agentId, threadId];

export const useCreateAgent = () => {
  const { state: { context, client } } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(context, agent),
    onSuccess: (result) => {
      const key = getKeyFor(context, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(getKeyFor(context), (old: Agent[] | undefined) => {
        if (!old) return [result];
        return [...old, result];
      });

      // invalidate list
      client.invalidateQueries({ queryKey: getKeyFor(context) });
    },
  });

  return create;
};

export const useUpdateAgent = () => {
  const { state: { context: root, client } } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => saveAgent(root, agent),
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
  const { state: { context: root, client } } = useSDK();

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
      client.setQueryData(getKeyFor(root, agentId), null);

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
  const { state: { context } } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, agentId),
    queryFn: () => loadAgent(context, agentId),
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { state: { context } } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context),
    queryFn: () => listAgents(context).then((r) => r.items),
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { state: { context } } = useSDK();

  const root = useMemo(
    () => `/${context}/Agents/${agentId}`,
    [context, agentId],
  );

  return root;
};

/** Hook for fetching messages from an agent */
export const useMessages = (agentId: string, threadId: string) => {
  const { state: { context } } = useSDK();
  const agentRoot = useAgentRoot(agentId);

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, agentId, threadId),
    queryFn: () => {
      // TODO: I guess we can improve this and have proper typings
      // deno-lint-ignore no-explicit-any
      const agentStub = stub<any>("AIAgent")
        .new(agentRoot)
        .withMetadata({ threadId });

      return agentStub.query();
    },
  });

  return data;
};

/** Hook for fetching threads from an agent */
export const useThreads = (agentId: string) => {
  const { state: { context } } = useSDK();
  const agentRoot = useAgentRoot(agentId);

  return useSuspenseQuery({
    queryKey: [...getKeyFor(context, agentId), "threads"],
    queryFn: () => {
      // TODO: I guess we can improve this and have proper typings
      // deno-lint-ignore no-explicit-any
      const agentStub = stub<any>("AIAgent")
        .new(agentRoot);

      return agentStub.listThreads();
    },
  });
};
