/**
 * Thread messages hooks - both read and write operations
 * Provides reactive CRUD operations for thread messages with proper cache invalidation
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { del, get, set } from "idb-keyval";
import { WELL_KNOWN_AGENTS } from "../constants.ts";
import { getThreadMessages as getBackendThreadMessages } from "../crud/thread.ts";
import { KEYS } from "./react-query-keys.ts";
import { useSDK } from "./store.tsx";

// IndexedDB storage constants
const MESSAGES_PREFIX = "decopilot:messages:";
const THREAD_META_PREFIX = "decopilot:thread-meta:";

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
 * - Backend API when agentId is not "decopilot" or when agentId is not provided
 * - IndexedDB when agentId is "decopilot"
 */
export function useThreadMessages(
  threadId: string,
  agentIdOrOptions?: string | UseThreadMessagesOptions,
  options?: UseThreadMessagesOptions,
) {
  const { locator } = useSDK();

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
  const isDecopilot = agentId === WELL_KNOWN_AGENTS.decopilotAgent.id;

  // Use different query keys for backend vs IndexedDB to avoid conflicts
  const queryKey = isDecopilot
    ? ["decopilot-messages", locator, threadId]
    : KEYS.THREAD_MESSAGES(locator, threadId);

  return useSuspenseQuery({
    queryKey,
    queryFn: async () => {
      if (!shouldFetch || !threadId) {
        return { messages: [] };
      }

      if (isDecopilot) {
        // Fetch from IndexedDB for decopilot
        try {
          const key = `${MESSAGES_PREFIX}${locator ? `${locator}:` : ""}${threadId}`;
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
        return await getBackendThreadMessages(locator, threadId, {});
      }
    },
    staleTime: 0, // Always check for fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: !isDecopilot, // Don't refetch IndexedDB on window focus
  });
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
        const updatedMeta: ThreadMetadata = {
          threadId,
          agentId: metadata?.agentId || existingMeta?.agentId || "decopilot",
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
      // Update the cache for decopilot messages
      // This matches the query key used in useThreadMessages for decopilot agent
      const queryKey = ["decopilot-messages", namespace || locator, threadId];

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

        const updatedMeta: ThreadMetadata = {
          threadId,
          agentId: metadata?.agentId || existingMeta?.agentId || "decopilot",
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
      // Update the cache for decopilot messages
      const queryKey = ["decopilot-messages", namespace || locator, threadId];

      queryClient.setQueryData(queryKey, { messages });

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
      // Remove from cache
      const queryKey = ["decopilot-messages", namespace || locator, threadId];

      queryClient.setQueryData(queryKey, { messages: [] });

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
