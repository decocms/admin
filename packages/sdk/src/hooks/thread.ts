/**
 * Thread specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  getThread,
  getThreadMessages,
  getThreadTools,
  listThreads,
} from "../crud/thread.ts";
import { useAgentStub } from "./agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/** Hook for fetching thread details */
export const useThread = (threadId: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD(workspace, threadId),
    queryFn: ({ signal }) => getThread(workspace, threadId, { signal }),
  });
};

/** Hook for fetching messages from a thread */
export const useThreadMessages = (threadId: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD_MESSAGES(workspace, threadId),
    queryFn: ({ signal }) => getThreadMessages(workspace, threadId, { signal }),
  });
};

/** Hook for fetching tools_set from a thread */
export const useThreadTools = (threadId: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD_TOOLS(workspace, threadId),
    queryFn: ({ signal }) => getThreadTools(workspace, threadId, { signal }),
  });
};

export const useUpdateThreadMessages = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (threadId: string, messages: unknown[] = []) => {
      const messagesKey = KEYS.THREAD_MESSAGES(workspace, threadId);

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
        KEYS.THREAD_TOOLS(workspace, threadId),
        () => ({ tools_set: variables }),
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

export const useUpdateThreadTitle = (threadId: string, userId: string) => {
  const { workspace } = useSDK();
  const client = useQueryClient();
  const agentStub = useAgentStub(threadId);

  return useMutation({
    mutationFn: async (newTitle: string) => {
      return await agentStub.updateThreadTitle(threadId, newTitle);
    },
    onMutate: async (newTitle: string) => {
      await client.cancelQueries({ queryKey: KEYS.THREADS(workspace, userId) });

      const previousThreads = client.getQueryData(KEYS.THREADS(workspace, userId));

      // Optimistically update the thread in the threads list
      // deno-lint-ignore no-explicit-any
      client.setQueryData(KEYS.THREADS(workspace, userId), (old: any) => {
        if (!old) return old;
        // deno-lint-ignore no-explicit-any
        const newThreads = old.threads.map((thread: any) =>
          thread.id === threadId ? { ...thread, title: newTitle } : thread
        );
        return { ...old, threads: newThreads };
      });

      // Return a context object with the snapshotted value
      return { previousThreads };
    },
    // deno-lint-ignore no-explicit-any
    onError: (_: any, __: any, context: any) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousThreads) {
        client.setQueryData(KEYS.THREADS(workspace, userId), context.previousThreads);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.THREAD(workspace, threadId) });
      client.invalidateQueries({ queryKey: KEYS.THREADS(workspace, userId) });
    },
  });
};

export const useDeleteThread = (threadId: string, userId: string) => {
  const { workspace } = useSDK();
  const client = useQueryClient();
  const agentStub = useAgentStub(threadId);

  return useMutation({
    mutationFn: async () => {
      return await agentStub.updateThreadMetadata(threadId, {
        deleted: true,
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.THREADS(workspace, userId) });
    },
  });
};
