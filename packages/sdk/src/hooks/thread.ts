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
import {
  getThread,
  getThreadMessages,
  listThreads,
  type Thread,
  type ThreadFilterOptions,
  type ThreadList,
  updateThreadMetadata,
  updateThreadTitle,
} from "../crud/thread.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { MCPClient } from "../fetcher.ts";

// Minimum delay to prevent UI flickering during title generation
const TITLE_GENERATION_MIN_DELAY_MS = 2000;

/** Hook for fetching thread details */
export const useThread = (threadId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD(locator, threadId),
    queryFn: ({ signal }) => getThread(locator, threadId, { signal }),
  });
};

/** Hook for fetching messages from a thread */
export const useThreadMessages = (threadId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD_MESSAGES(locator, threadId),
    queryFn: ({ signal }) => getThreadMessages(locator, threadId, { signal }),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useUpdateThreadMessages = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (threadId: string, messages: unknown[] = []) => {
      const messagesKey = KEYS.THREAD_MESSAGES(locator, threadId);

      client.cancelQueries({ queryKey: messagesKey });
      client.setQueryData(messagesKey, messages);
    },
    [client, locator],
  );
};

/** Hook for fetching all threads for the user */
export const useThreads = (partialOptions: ThreadFilterOptions = {}) => {
  const client = useQueryClient();
  const { locator } = useSDK();
  const options: ThreadFilterOptions = {
    ...partialOptions,
  };
  const key = KEYS.THREADS(locator, options);
  const updateThreadTitle = useUpdateThreadTitle();

  const generateThreadTitle = useCallback(
    async ({
      firstMessage: _firstMessage,
      threadId,
    }: {
      firstMessage: string;
      threadId: string;
    }) => {
      try {
        const [result] = await Promise.all([
          MCPClient.forLocator(locator).AI_GENERATE({
            // Fallback to gpt-3.5-turbo if 4.1-nano is not available
            model: "openai:gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: `Generate a title for the thread that started with the following user message:
                  <Rule>Make it short and concise</Rule>
                  <Rule>Make it a single sentence</Rule>
                  <Rule>Keep the same language as the user message</Rule>
                  <Rule>Return ONLY THE TITLE! NO OTHER TEXT!</Rule>

                  <UserMessage>
                    ${_firstMessage}
                  </UserMessage>`,
              },
            ],
          }),
          // ensure at least 2 seconds delay to avoid UI flickering.
          new Promise((resolve) =>
            setTimeout(resolve, TITLE_GENERATION_MIN_DELAY_MS),
          ),
        ]);
        
        if (result.text && result.text.trim()) {
          updateThreadTitle.mutate({ threadId, title: result.text.trim(), stream: true });
        } else {
          // Fallback to a smart title based on message content
          const fallbackTitle = generateFallbackTitle(_firstMessage);
          updateThreadTitle.mutate({ threadId, title: fallbackTitle, stream: true });
        }
      } catch (error) {
        console.warn("Failed to generate AI title, using fallback:", error);
        // Fallback to a smart title based on message content
        const fallbackTitle = generateFallbackTitle(_firstMessage);
        updateThreadTitle.mutate({ threadId, title: fallbackTitle, stream: true });
      }
    },
    [updateThreadTitle, locator],
  );

  const generateFallbackTitle = (message: string): string => {
    if (!message || typeof message !== "string") {
      return "New conversation";
    }
    
    // Clean up the message and create a meaningful title
    const cleanMessage = message.trim().replace(/\s+/g, ' ');
    
    // If message is very short, use it as-is
    if (cleanMessage.length <= 30) {
      return cleanMessage;
    }
    
    // Try to find a good breaking point (end of sentence, word boundary, etc.)
    const sentences = cleanMessage.split(/[.!?]+/);
    if (sentences[0] && sentences[0].length <= 50) {
      return sentences[0].trim();
    }
    
    // Fall back to first 40 characters at word boundary
    const words = cleanMessage.split(' ');
    let title = '';
    for (const word of words) {
      if ((title + ' ' + word).length <= 40) {
        title += (title ? ' ' : '') + word;
      } else {
        break;
      }
    }
    
    return title || cleanMessage.slice(0, 40).trim() + '...';
  };

  const effect = useCallback(
    ({
      messages,
      threadId,
      agentId,
    }: {
      messages: UIMessage[];
      threadId: string;
      agentId: string;
    }) => {
      client.cancelQueries({ queryKey: key });
      client.setQueryData<Awaited<ReturnType<typeof listThreads>>>(
        key,
        (oldData) => {
          const exists = oldData?.threads.find(
            (thread: Thread) => thread.id === threadId,
          );

          if (exists) {
            return oldData;
          }

          const temporaryTitle = generateFallbackTitle(
            typeof messages[0]?.content === "string" ? messages[0].content : ""
          );

          generateThreadTitle({ firstMessage: messages[0].content, threadId });

          const updated = {
            pagination: {
              hasMore: false,
              nextCursor: null,
              hasPrev: false,
              prevCursor: null,
              ...oldData?.pagination,
            },
            threads: [
              ...(oldData?.threads ?? []),
              {
                id: threadId,
                title: temporaryTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                resourceId: agentId,
                metadata: { agentId },
              },
            ],
          };

          return updated;
        },
      );
    },
    [client, key],
  );

  useMessagesSentEffect(effect);

  return useSuspenseQuery({
    queryKey: key,
    queryFn: ({ signal }) => listThreads(locator, options, { signal }),
  });
};

export interface UpdateThreadTitleParams {
  threadId: string;
  title: string;
  stream?: boolean;
}

export const useUpdateThreadTitle = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, title }: UpdateThreadTitleParams) => {
      return await updateThreadTitle(locator, threadId, title);
    },
    onMutate: async ({ threadId, title, stream }: UpdateThreadTitleParams) => {
      // Cancel all threads queries to prevent race conditions
      await client.cancelQueries({
        queryKey: KEYS.THREADS(locator),
      });

      if (stream) {
        // Animate title character by character
        let currentIndex = 0;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const animateTitle = () => {
          if (currentIndex <= title.length) {
            const partialTitle = title.slice(0, currentIndex);

            client.setQueriesData(
              { queryKey: KEYS.THREADS(locator) },
              (oldData: ThreadList | undefined) => {
                if (!oldData?.threads) return oldData;

                return {
                  ...oldData,
                  threads: oldData.threads.map((thread) =>
                    thread.id === threadId
                      ? { ...thread, title: partialTitle }
                      : thread,
                  ),
                };
              },
            );

            currentIndex++;
            if (currentIndex <= title.length) {
              timeoutId = setTimeout(animateTitle, 20);
            }
          }
        };

        // Start animation
        animateTitle();

        // Return cleanup function
        return () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };
      } else {
        // Optimistically update all threads queries that contain this thread
        client.setQueriesData(
          { queryKey: KEYS.THREADS(locator) },
          (oldData: ThreadList | undefined) => {
            if (!oldData?.threads) return oldData;

            return {
              ...oldData,
              threads: oldData.threads.map((thread) =>
                thread.id === threadId ? { ...thread, title } : thread,
              ),
            };
          },
        );
      }
    },
    // deno-lint-ignore no-explicit-any
    onError: (_: any, __: UpdateThreadTitleParams, context: any) => {
      // If the mutation fails, restore all previous queries data
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(
          ([queryKey, data]: [readonly unknown[], unknown]) => {
            client.setQueryData(queryKey, data);
          },
        );
      }
    },
    onSettled: (_, __, { threadId }: UpdateThreadTitleParams) => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.THREAD(locator, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(locator),
      });
    },
  });
};

export const useDeleteThread = (threadId: string) => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await updateThreadMetadata(locator, threadId, {
        deleted: true,
      });
    },
    onSuccess: () => {
      // Invalidate both the thread and all threads list queries
      client.invalidateQueries({ queryKey: KEYS.THREAD(locator, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(locator),
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
