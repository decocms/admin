/**
 * Thread messages hooks - both read and write operations
 * Provides reactive CRUD operations for thread messages with proper cache invalidation
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { type UIMessage } from "ai";
import { del, get, set } from "idb-keyval";
import { getThreadMessages as getBackendThreadMessages } from "../crud/thread.ts";
import { type ProjectLocator } from "../locator.ts";
import {
  isWellKnownDecopilotAgent,
  WELL_KNOWN_DECOPILOT_AGENTS,
} from "../types/well-known-agents.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// IndexedDB storage constants
const MESSAGES_PREFIX = "decopilot:messages:";
const THREAD_META_PREFIX = "decopilot:thread-meta:";

// Module-level cache for stable initial messages that persists across Suspense remounts
// Key format: `${effectiveLocator}:${threadId}` where effectiveLocator = namespace || locator
// IMPORTANT: This cache MUST be cleared when messages are deleted to prevent resurrection.
// All hooks use the same key format (namespace || locator) to ensure cache alignment.
const initialMessagesCache = new Map<string, UIMessage[]>();

// Thread metadata interface
export interface ThreadMetadata {
  threadId: string;
  agentId: string;
  route: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Deduplicate messages by ID, keeping the last occurrence of each unique ID
 */
function deduplicateMessages(messages: UIMessage[]): UIMessage[] {
  const seen = new Map<string, UIMessage>();

  // Iterate through messages and keep the last occurrence of each ID
  for (const message of messages) {
    seen.set(message.id, message);
  }

  return Array.from(seen.values());
}

// ============================================================================
// Read Operations (Query Hooks)
// ============================================================================

interface UseThreadMessagesOptions {
  shouldFetch?: boolean;
}

/**
 * Hook that fetches thread messages from:
 * - Backend API when agentId is not a well-known decopilot agent or when agentId is not provided
 * - IndexedDB when agentId is a well-known decopilot agent (design, code, explore, or legacy decopilotAgent)
 *
 * Note: For IndexedDB storage, the namespace parameter allows organizing messages by workspace/project.
 * If not provided, falls back to the current locator for backward compatibility.
 */
export function useThreadMessages(
  threadId: string,
  agentIdOrOptions?: string | UseThreadMessagesOptions,
  options?: UseThreadMessagesOptions,
  namespace?: string,
) {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  // Handle backward compatibility: if second param is options object, treat as old API
  let agentId: string | undefined;
  let finalOptions: UseThreadMessagesOptions;

  if (typeof agentIdOrOptions === "string") {
    agentId = agentIdOrOptions;
    finalOptions = options || {};
  } else {
    // Old API: threadId, { shouldFetch }
    agentId = undefined;
    finalOptions = agentIdOrOptions || {};
  }

  const { shouldFetch = true } = finalOptions;
  const isDecopilot = isWellKnownDecopilotAgent(agentId);

  // Use namespace || locator consistently across all hooks to ensure cache keys align
  const effectiveLocator = namespace || locator;

  // Use different query keys for backend vs IndexedDB to avoid conflicts
  const queryKey = isDecopilot
    ? ["decopilot-messages", effectiveLocator, threadId]
    : KEYS.THREAD_MESSAGES(effectiveLocator as ProjectLocator, threadId);

  // Cache key for stable initial messages - must match queryKey pattern
  const cacheKey = threadId ? `${effectiveLocator}:${threadId}` : "";

  // Populate React Query cache with our cached data BEFORE calling useSuspenseQuery
  // This prevents Suspense from triggering if we have cached data
  // Run synchronously before the query so React Query has data and won't suspend
  const cachedInitial = cacheKey ? initialMessagesCache.get(cacheKey) : null;
  const existingQueryData = queryClient.getQueryData<{ messages: UIMessage[] }>(
    queryKey,
  );

  if (cachedInitial && cachedInitial.length > 0 && isDecopilot) {
    // Check if React Query cache is empty or has no data
    if (!existingQueryData || existingQueryData.messages.length === 0) {
      // Populate React Query cache with our cached data to prevent Suspense
      queryClient.setQueryData(queryKey, { messages: cachedInitial });
    }
  }

  // If we have cached data, use it to prevent unnecessary refetches
  const hasCachedData =
    cachedInitial && cachedInitial.length > 0 && isDecopilot;

  const query = useSuspenseQuery({
    queryKey,
    queryFn: async () => {
      if (!shouldFetch || !threadId) {
        return { messages: [] };
      }

      if (isDecopilot) {
        // Fetch from IndexedDB for decopilot
        try {
          const key = `${MESSAGES_PREFIX}${
            effectiveLocator ? `${effectiveLocator}:` : ""
          }${threadId}`;
          const messages = await get<UIMessage[]>(key);

          if (!messages) {
            return { messages: [] };
          }

          // Deduplicate messages before returning
          return { messages: deduplicateMessages(messages) };
        } catch (error) {
          console.error("[useThreadMessages] Failed to get messages:", error);
          return { messages: [] };
        }
      } else {
        // Fetch from backend API for other agents
        return await getBackendThreadMessages(
          effectiveLocator as ProjectLocator,
          threadId,
          {},
        );
      }
    },
    staleTime: hasCachedData ? Infinity : 0, // If we have cached data, don't refetch immediately
    refetchOnMount: !hasCachedData, // Don't refetch if we have cached data
    refetchOnWindowFocus: !isDecopilot, // Don't refetch IndexedDB on window focus
  });

  // Provide stable initialMessages that persist across Suspense remounts
  // This prevents ChatProvider from remounting during refetches
  const currentMessages = query.data?.messages ?? [];

  // Update cache when we get messages, but return stable cached value to prevent remounts
  if (cacheKey) {
    if (cachedInitial && cachedInitial.length > 0) {
      // Update cache if current has more messages (new messages were added)
      if (currentMessages.length > cachedInitial.length) {
        initialMessagesCache.set(cacheKey, [...currentMessages]);
      }
    } else if (currentMessages.length > 0) {
      // No cache yet - store current messages
      initialMessagesCache.set(cacheKey, [...currentMessages]);
    }
  }

  const finalInitialMessages =
    cachedInitial && cachedInitial.length > 0 ? cachedInitial : currentMessages;

  // Return query with stable initialMessages property
  return {
    ...query,
    initialMessages: finalInitialMessages,
  };
}

// ============================================================================
// Write Operations (Mutation Hooks with Inlined Storage Functions)
// ============================================================================

interface AppendThreadMessageParams {
  threadId: string;
  messages: UIMessage[];
  metadata?: Partial<ThreadMetadata>;
  namespace?: string;
}

interface SaveThreadMessagesParams {
  threadId: string;
  messages: UIMessage[];
  metadata?: Partial<ThreadMetadata>;
  namespace?: string;
}

interface DeleteThreadMessagesParams {
  threadId: string;
  namespace?: string;
}

/**
 * Hook to append messages to a thread
 * Automatically invalidates the query cache to trigger UI updates
 *
 * This is the ONLY way to append messages - the underlying storage function
 * is inlined here to enforce reactive usage.
 *
 * Note: If metadata.agentId is not provided, defaults to explore.id for analytics purposes.
 * This ensures all messages have an associated agent for tracking.
 */
export function useAppendThreadMessage() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      messages,
      metadata,
      namespace,
    }: AppendThreadMessageParams) => {
      // Append messages to IndexedDB
      try {
        const ns = namespace ? `${namespace}:` : "";
        const messagesKey = `${MESSAGES_PREFIX}${ns}${threadId}`;
        const metaKey = `${THREAD_META_PREFIX}${ns}${threadId}`;

        // Get existing messages and metadata
        const [existingMessages, existingMeta] = await Promise.all([
          get<UIMessage[]>(messagesKey),
          get<ThreadMetadata>(metaKey),
        ]);

        const now = Date.now();
        // Combine existing and new messages, then deduplicate
        const combinedMessages = [...(existingMessages || []), ...messages];
        const deduplicatedMessages = deduplicateMessages(combinedMessages);

        // Update thread metadata
        // agentId defaults to explore.id for analytics if not explicitly provided
        const updatedMeta: ThreadMetadata = {
          threadId,
          agentId:
            metadata?.agentId ||
            existingMeta?.agentId ||
            WELL_KNOWN_DECOPILOT_AGENTS.explore.id,
          route: metadata?.route || existingMeta?.route || "",
          createdAt: existingMeta?.createdAt || now,
          updatedAt: now,
          messageCount: deduplicatedMessages.length,
        };

        // Save both messages and metadata
        await Promise.all([
          set(messagesKey, deduplicatedMessages),
          set(metaKey, updatedMeta),
        ]);
      } catch (error) {
        console.error(
          "[useAppendThreadMessage] Failed to append message:",
          error,
        );
        throw error;
      }
    },
    onSuccess: (_, { threadId, messages, namespace }) => {
      // Use namespace || locator consistently for cache key alignment
      const effectiveLocator = namespace || locator;
      const queryKey = ["decopilot-messages", effectiveLocator, threadId];

      queryClient.setQueryData(
        queryKey,
        (oldData: { messages: UIMessage[] } | undefined) => {
          if (!oldData) {
            return { messages };
          }

          // Deduplicate messages by ID
          const existingIds = new Set(oldData.messages.map((m) => m.id));
          const newMessages = messages.filter((m) => !existingIds.has(m.id));

          return {
            messages: [...oldData.messages, ...newMessages],
          };
        },
      );

      // Update the module-level cache to keep it in sync
      const cacheKey = `${effectiveLocator}:${threadId}`;
      const currentCache = initialMessagesCache.get(cacheKey) || [];
      const existingIds = new Set(currentCache.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      initialMessagesCache.set(cacheKey, [...currentCache, ...newMessages]);

      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error(
        "[useAppendThreadMessage] Failed to append messages:",
        error,
      );
    },
  });
}

/**
 * Hook to save/replace all messages in a thread
 * Automatically invalidates the query cache to trigger UI updates
 *
 * This is the ONLY way to save messages - the underlying storage function
 * is inlined here to enforce reactive usage.
 *
 * Note: If metadata.agentId is not provided, defaults to explore.id for analytics purposes.
 * This ensures all messages have an associated agent for tracking.
 */
export function useSaveThreadMessages() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      messages,
      metadata,
      namespace,
    }: SaveThreadMessagesParams) => {
      // Save messages to IndexedDB
      try {
        const ns = namespace ? `${namespace}:` : "";

        // Deduplicate messages before saving
        const deduplicatedMessages = deduplicateMessages(messages);

        // Save messages
        await set(`${MESSAGES_PREFIX}${ns}${threadId}`, deduplicatedMessages);

        // Update thread metadata
        const metaKey = `${THREAD_META_PREFIX}${ns}${threadId}`;
        const existingMeta = await get<ThreadMetadata>(metaKey);
        const now = Date.now();

        // agentId defaults to explore.id for analytics if not explicitly provided
        const updatedMeta: ThreadMetadata = {
          threadId,
          agentId:
            metadata?.agentId ||
            existingMeta?.agentId ||
            WELL_KNOWN_DECOPILOT_AGENTS.explore.id,
          route: metadata?.route || existingMeta?.route || "",
          createdAt: existingMeta?.createdAt || now,
          updatedAt: now,
          messageCount: deduplicatedMessages.length,
        };

        await set(metaKey, updatedMeta);
      } catch (error) {
        console.error(
          "[useSaveThreadMessages] Failed to save messages:",
          error,
        );
        throw error;
      }
    },
    onSuccess: (_, { threadId, messages, namespace }) => {
      // Use namespace || locator consistently for cache key alignment
      const effectiveLocator = namespace || locator;
      const queryKey = ["decopilot-messages", effectiveLocator, threadId];

      queryClient.setQueryData(queryKey, { messages });

      // Update the module-level cache to keep it in sync
      const cacheKey = `${effectiveLocator}:${threadId}`;
      initialMessagesCache.set(cacheKey, [...messages]);

      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error("[useSaveThreadMessages] Failed to save messages:", error);
    },
  });
}

/**
 * Hook to delete all messages in a thread
 * Automatically invalidates the query cache to trigger UI updates
 *
 * This is the ONLY way to delete messages - the underlying storage function
 * is inlined here to enforce reactive usage.
 */
export function useDeleteThreadMessages() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, namespace }: DeleteThreadMessagesParams) => {
      // Delete messages from IndexedDB
      try {
        const ns = namespace ? `${namespace}:` : "";
        await del(`${MESSAGES_PREFIX}${ns}${threadId}`);
        await del(`${THREAD_META_PREFIX}${ns}${threadId}`);
      } catch (error) {
        console.error(
          "[useDeleteThreadMessages] Failed to delete messages:",
          error,
        );
        throw error;
      }
    },
    onSuccess: (_, { threadId, namespace }) => {
      // Use namespace || locator consistently for cache key alignment
      const effectiveLocator = namespace || locator;
      const queryKey = ["decopilot-messages", effectiveLocator, threadId];

      // Clear React Query cache
      queryClient.setQueryData(queryKey, { messages: [] });

      // CRITICAL: Clear module-level cache to prevent resurrection of deleted messages
      const cacheKey = `${effectiveLocator}:${threadId}`;
      initialMessagesCache.delete(cacheKey);

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error(
        "[useDeleteThreadMessages] Failed to delete messages:",
        error,
      );
    },
  });
}
