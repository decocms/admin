/**
 * Thread specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect } from "react";
import { WELL_KNOWN_AGENT_IDS } from "../constants.ts";
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
export const useThreads = (partialOptions: ThreadFilterOptions = {}) => {
  const client = useQueryClient();
  const { workspace } = useSDK();
  const options: ThreadFilterOptions = {
    orderBy: "createdAt_desc",
    limit: 20,
    ...partialOptions,
  };
  const key = KEYS.THREADS(workspace, options);

  const effect = useCallback(
    ({ messages, threadId, agentId }: {
      messages: UIMessage[];
      threadId: string;
      agentId: string;
    }) => {
      client.cancelQueries({ queryKey: key });
      client.setQueryData<Awaited<ReturnType<typeof listThreads>>>(
        key,
        (oldData) => {
          const exists = oldData?.threads.find((thread) =>
            thread.id === threadId
          );

          if (exists) {
            return oldData;
          }

          const newTitle = typeof messages[0]?.content === "string"
            ? messages[0].content.slice(0, 20)
            : "New chat";

          const updated = {
            pagination: oldData?.pagination ?? {
              hasMore: false,
              nextCursor: null,
            },
            threads: [
              ...(oldData?.threads ?? []),
              {
                id: threadId,
                title: newTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                resourceId: agentId,
                metadata: { agentId },
              },
            ],
          };

          // When uniqueyById, we should remove the agentId from the thread metadata
          if (
            options.uniqueByAgentId && !(agentId in WELL_KNOWN_AGENT_IDS)
          ) {
            updated.threads = updated.threads.filter(
              (thread, index) =>
                thread.metadata?.agentId !== agentId ||
                index === updated.threads.length - 1,
            );
          }

          return updated;
        },
      );
    },
    [client, key, options.uniqueByAgentId],
  );

  useMessagesSentEffect(effect);

  return useSuspenseQuery({
    queryKey: key,
    queryFn: ({ signal }) => listThreads(workspace, options, { signal }),
  });
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
      client.setQueryData(
        KEYS.THREADS(workspace, { resourceId: userId }),
        // deno-lint-ignore no-explicit-any
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

const channel = new EventTarget();

export interface Options {
  messages: UIMessage[];
  threadId: string;
  agentId: string;
}

export const dispatchMessages = (options: Options) => {
  channel.dispatchEvent(new CustomEvent("message", { detail: options }));
};

const useMessagesSentEffect = (cb: (options: Options) => void) => {
  useEffect(() => {
    const handler = (event: Event) => {
      const options = (event as CustomEvent).detail as Options;
      cb(options);
    };

    channel.addEventListener("message", handler);

    return () => {
      channel.removeEventListener("message", handler);
    };
  }, [cb]);
};
