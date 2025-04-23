/**
 * Thread specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { listThreads } from "../crud/thread.ts";
import { useAgentStub } from "./agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/** Hook for fetching messages from a thread */
export const useThreadMessages = (agentId: string, threadId: string) => {
  const { workspace } = useSDK();
  const agentStub = useAgentStub(agentId, threadId);

  const data = useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace, agentId, threadId),
    queryFn: () => agentStub.query({}),
    staleTime: 0,
    gcTime: 0,
    networkMode: "always",
    refetchOnMount: "always",
  });

  return data;
};

export const useUpdateThreadMessages = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (agentId: string, threadId: string) => {
      const messagesKey = KEYS.THREADS(workspace, agentId, threadId);

      client.cancelQueries({ queryKey: messagesKey });
      client.setQueryData(messagesKey, []);
    },
    [client, workspace],
  );
};

/** Hook for fetching threads from an agent */
/** TODO: Merge this with useThreads into a single hook */
export const useAgentThreads = (agentId: string) => {
  const { workspace } = useSDK();
  const agentStub = useAgentStub(agentId);

  return useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace, agentId),
    queryFn: () => agentStub.listThreads(),
  });
};

/** Hook for fetching all threads for the user */
export const useThreads = () => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace),
    queryFn: ({ signal }) => listThreads(workspace, signal),
  });
};

export const useThreadTools = (agentId: string, threadId: string) => {
  const { workspace } = useSDK();
  const agentStub = useAgentStub(agentId, threadId);

  return useSuspenseQuery<Record<string, string[]>>({
    queryKey: KEYS.TOOLS(workspace, agentId, threadId),
    queryFn: () => agentStub.getThreadTools(),
  });
};

export const useUpdateThreadTools = (agentId: string, threadId: string) => {
  const { workspace } = useSDK();
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
    onSuccess: (_, variables) => {
      client.setQueryData(
        KEYS.TOOLS(workspace, agentId, threadId),
        () => variables,
      );
    },
  });
};

export const useInvalidateAll = () => {
  const client = useQueryClient();

  return useCallback(() => {
    client.invalidateQueries({
      predicate: (_query) => true,
    });
  }, [client]);
};
