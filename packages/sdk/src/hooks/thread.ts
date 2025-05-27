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
  listThreads,
  ThreadFilterOptions,
  updateThreadMetadata,
  updateThreadTitle,
} from "../crud/thread.ts";
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
    staleTime: 0,
    gcTime: 0,
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

/** Hook for fetching all threads for the user */
export const useThreads = (options: ThreadFilterOptions = {}) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: KEYS.THREADS(workspace, options),
    queryFn: ({ signal }) =>
      listThreads(workspace, {
        orderBy: "createdAt_desc",
        limit: 20,
        ...options,
      }, { signal }),
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

  return useMutation({
    mutationFn: async (newTitle: string) => {
      return await updateThreadTitle(workspace, threadId, newTitle);
    },
    onMutate: async (newTitle: string) => {
      await client.cancelQueries({
        queryKey: KEYS.THREADS(workspace, { resourceId: userId }),
      });

      const previousThreads = client.getQueryData(
        KEYS.THREADS(workspace, { resourceId: userId }),
      );

      // Optimistically update the thread in the threads list
      // deno-lint-ignore no-explicit-any
      client.setQueryData(
        KEYS.THREADS(workspace, { resourceId: userId }),
        (old: any) => {
          if (!old) return old;
          // deno-lint-ignore no-explicit-any
          const newThreads = old.threads.map((thread: any) =>
            thread.id === threadId ? { ...thread, title: newTitle } : thread
          );
          return { ...old, threads: newThreads };
        },
      );

      // Return a context object with the snapshotted value
      return { previousThreads };
    },
    // deno-lint-ignore no-explicit-any
    onError: (_: any, __: any, context: any) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousThreads) {
        client.setQueryData(
          KEYS.THREADS(workspace, { resourceId: userId }),
          context.previousThreads,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.THREAD(workspace, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(workspace, { resourceId: userId }),
      });
    },
  });
};

export const useDeleteThread = (threadId: string, userId: string) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await updateThreadMetadata(workspace, threadId, {
        deleted: true,
      });
    },
    onSuccess: () => {
      // Invalidate both the thread and threads list queries
      client.invalidateQueries({ queryKey: KEYS.THREAD(workspace, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(workspace, { resourceId: userId }),
      });
    },
  });
};
