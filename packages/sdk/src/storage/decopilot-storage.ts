import type { UIMessage } from "ai";
import { del, get, keys, set } from "idb-keyval";

/**
 * IndexedDB storage for decopilot messages
 * Only used when agentId is decopilot
 */

const MESSAGES_PREFIX = "decopilot:messages:";
const THREAD_META_PREFIX = "decopilot:thread-meta:";

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

export interface ThreadMetadata {
  threadId: string;
  agentId: string;
  route: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Get messages for a thread from IndexedDB
 */
export async function getDecopilotThreadMessages(
  threadId: string,
  namespace?: string,
): Promise<UIMessage[] | null> {
  try {
    const key = `${MESSAGES_PREFIX}${namespace ? `${namespace}:` : ""}${threadId}`;
    const messages = await get<UIMessage[]>(key);

    if (!messages) return null;

    // Deduplicate messages before returning
    return deduplicateMessages(messages);
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get messages:", error);
    return null;
  }
}

// Note: Write operations (saveThreadMessages, appendThreadMessage, deleteThreadMessages)
// have been moved to hooks/thread-messages.ts as reactive hooks.
// Use useAppendThreadMessage(), useSaveThreadMessages(), or useDeleteThreadMessages() instead.
// This ensures all message mutations trigger proper cache invalidation and UI updates.

/**
 * Get metadata for a thread
 */
export async function getThreadMetadata(
  threadId: string,
  namespace?: string,
): Promise<ThreadMetadata | null> {
  try {
    const ns = namespace ? `${namespace}:` : "";
    const meta = await get<ThreadMetadata>(
      `${THREAD_META_PREFIX}${ns}${threadId}`,
    );
    return meta || null;
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get metadata:", error);
    return null;
  }
}

/**
 * Get all thread IDs from IndexedDB
 */
export async function getAllThreadIds(namespace?: string): Promise<string[]> {
  try {
    const ns = namespace ? `${namespace}:` : "";
    const prefix = `${MESSAGES_PREFIX}${ns}`;
    const allKeys = await keys();
    const threadIds = allKeys
      .filter((key) => typeof key === "string" && key.startsWith(prefix))
      .map((key) => (key as string).replace(prefix, ""));
    return threadIds;
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get thread IDs:", error);
    return [];
  }
}

/**
 * Clear all decopilot data from IndexedDB
 */
export async function clearAllThreads(namespace?: string): Promise<void> {
  try {
    const ns = namespace ? `${namespace}:` : "";
    const messagesPrefix = `${MESSAGES_PREFIX}${ns}`;
    const metaPrefix = `${THREAD_META_PREFIX}${ns}`;
    const allKeys = await keys();
    const decopilotKeys = allKeys.filter(
      (key) =>
        typeof key === "string" &&
        (key.startsWith(messagesPrefix) || key.startsWith(metaPrefix)),
    );

    await Promise.all(decopilotKeys.map((key) => del(key)));
  } catch (error) {
    console.error("[DecopilotStorage] Failed to clear threads:", error);
    throw error;
  }
}
