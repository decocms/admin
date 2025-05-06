/**
 * Thread specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { getThreadWithMessages, listThreads } from "../crud/thread.ts";
import { useAgentStub } from "./agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/** Hook for fetching messages from a thread */
export const useThreadMessages = (threadId: string) => {
  const { workspace } = useSDK();

  const result = useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace, threadId),
    queryFn: ({ signal }) =>
      getThreadWithMessages(workspace, threadId, { signal }),
  });

  return result;
};

export const useUpdateThreadMessages = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (threadId: string, messages: unknown[] = []) => {
      const messagesKey = KEYS.THREADS(workspace, threadId);

      client.cancelQueries({ queryKey: messagesKey });
      client.setQueryData(messagesKey, messages);
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
export const useThreads = (userId: string) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace, userId),
    queryFn: ({ signal }) =>
      listThreads(workspace, {
        resourceId: userId,
        orderBy: "createdAt_desc",
        limit: 20,
      }, { signal }),
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

export const useAddOptimisticThread = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const addOptimisticThread = useCallback(
    (threadId: string, agentId: string) => {
      // Add a "Loading..." titled thread to the threads query
      client.setQueryData(
        KEYS.THREADS(workspace),
        // deno-lint-ignore no-explicit-any
        (oldData: any) => {
          if (!oldData) return oldData;

          // Check if the thread already exists
          // deno-lint-ignore no-explicit-any
          const threadExists = oldData.some((thread: any) =>
            thread.id === threadId
          );

          if (!threadExists) {
            return [
              ...oldData,
              {
                id: threadId,
                title: "New chat",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {
                  agentId,
                },
              },
            ];
          }

          return oldData;
        },
      );
    },
    [client, workspace],
  );

  return {
    addOptimisticThread,
  };
};

export const useInvalidateAll = () => {
  const client = useQueryClient();

  return useCallback(() => {
    client.invalidateQueries({
      predicate: (_query) => true,
    });
  }, [client]);
};
