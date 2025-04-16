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
import { KEYS } from "./keys.ts";
import { useSDK } from "./store.tsx";

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { context } = useSDK();

  const create = useMutation({
    mutationFn: (agent?: Partial<Agent>) => createAgent(context, agent),
    onSuccess: (result) => {
      const key = KEYS.agent(context, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(KEYS.agent(context), (old: Agent[] | undefined) => {
        if (!old) return [result];
        return [result, ...old];
      });

      // invalidate list
      client.invalidateQueries({ queryKey: KEYS.agent(context) });
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
      await client.cancelQueries({ queryKey: KEYS.agent(root) });

      // Snapshot the previous value
      const previousAgents = client.getQueryData(KEYS.agent(root)) as
        | Agent[]
        | undefined;

      // Optimistically update the cache
      client.setQueryData(KEYS.agent(root), (old: Agent[] | undefined) => {
        if (!old) return [updatedAgent];
        return old.map((agent) =>
          agent.id === updatedAgent.id ? updatedAgent : agent
        );
      });

      // Update the individual agent in cache
      client.setQueryData(KEYS.agent(root, updatedAgent.id), updatedAgent);

      return { previousAgents } as const;
    },
    onError: (_err, _updatedAgent, context) => {
      // Rollback to the previous value
      if (context?.previousAgents) {
        client.setQueryData(KEYS.agent(root), context.previousAgents);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.agent(root) });
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
      await client.cancelQueries({ queryKey: KEYS.agent(root) });

      // Snapshot the previous value
      const previousAgents = client.getQueryData<Agent[]>(KEYS.agent(root));

      // Optimistically update the cache
      client.setQueryData(KEYS.agent(root), (old: Agent[]) => {
        if (!old) return old;
        return old.filter((agent: Agent) => agent.id !== agentId);
      });

      // Remove the individual agent from cache
      client.removeQueries({ queryKey: KEYS.agent(root, agentId) });

      return { previousAgents };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback to the previous value
      if (ctx?.previousAgents) {
        client.setQueryData(KEYS.agent(root), ctx.previousAgents);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.agent(root) });
    },
  });

  return remove;
};

/** Hook for crud-like operations on agents */
export const useAgent = (agentId: string) => {
  const { context } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.agent(context, agentId),
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
    queryKey: KEYS.agent(context),
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
    queryKey: KEYS.agent(context, agentId, threadId),
    queryFn: () => agentStub.query(),
  });

  return data;
};

/** Hook for fetching threads from an agent */
export const useThreads = (agentId: string) => {
  const { context } = useSDK();
  const agentStub = useAgentStub(agentId);

  return useSuspenseQuery({
    queryKey: KEYS.threads(context, agentId),
    queryFn: () => agentStub.listThreads(),
  });
};

/** Hook for fetching all threads for the user */
export const useAllThreads = () => {
  const { context } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.threads(context),
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
    () =>
      // deno-lint-ignore no-explicit-any
      stub<any>("AIAgent").new(agentRoot).withMetadata({ threadId }),
    [agentRoot, threadId],
  );
};

export const useThreadTools = (agentId: string, threadId: string) => {
  const { context } = useSDK();
  const agentStub = useAgentStub(agentId, threadId);

  return useSuspenseQuery({
    queryKey: KEYS.threadTools(context, agentId, threadId),
    queryFn: () => agentStub.getThreadTools(),
  });
};

export const useInvalidateAll = (agentId: string, threadId: string) => {
  const { context } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: () =>
      client.invalidateQueries({
        predicate: (query) => true,
      }),
  });
};

export const useUpdateThreadTools = (agentId: string, threadId: string) => {
  const { context } = useSDK();
  const client = useQueryClient();
  const agentStub = useAgentStub(agentId, threadId);

  return useMutation({
    mutationFn: async (toolset: Record<string, string[]>) => {
      const response = await agentStub.updateThreadTools(toolset);

      if (
        response.success === false && response.message === "Thread not found"
      ) {
        return agentStub.createThread({
          title: "New Thread",
          id: threadId,
          metadata: { tool_set: toolset },
        });
      }
    },
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.threadTools(context, agentId, threadId),
      });
    },
  });
};
