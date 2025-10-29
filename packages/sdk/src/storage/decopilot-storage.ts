import type { UIMessage } from "ai";
import { del, get, keys, set } from "idb-keyval";

/**
 * IndexedDB storage for decopilot messages
 * Only used when agentId is decopilot
 */

const MESSAGES_PREFIX = "decopilot:messages:";
const THREAD_META_PREFIX = "decopilot:thread-meta:";

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
): Promise<UIMessage[] | null> {
  try {
    const messages = await get<UIMessage[]>(`${MESSAGES_PREFIX}${threadId}`);
    return messages || null;
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get messages:", error);
    return null;
  }
}

/**
 * Save messages for a thread to IndexedDB
 */
export async function saveThreadMessages(
  threadId: string,
  messages: UIMessage[],
  metadata?: Partial<ThreadMetadata>,
): Promise<void> {
  try {
    // Save messages
    await set(`${MESSAGES_PREFIX}${threadId}`, messages);

    // Update thread metadata
    const existingMeta = await get<ThreadMetadata>(
      `${THREAD_META_PREFIX}${threadId}`,
    );
    const now = Date.now();

    const updatedMeta: ThreadMetadata = {
      threadId,
      agentId: metadata?.agentId || existingMeta?.agentId || "decopilot",
      route: metadata?.route || existingMeta?.route || "",
      createdAt: existingMeta?.createdAt || now,
      updatedAt: now,
      messageCount: messages.length,
    };

    await set(`${THREAD_META_PREFIX}${threadId}`, updatedMeta);
  } catch (error) {
    console.error("[DecopilotStorage] Failed to save messages:", error);
    throw error;
  }
}

/**
 * Delete messages for a thread from IndexedDB
 */
export async function deleteThreadMessages(threadId: string): Promise<void> {
  try {
    await del(`${MESSAGES_PREFIX}${threadId}`);
    await del(`${THREAD_META_PREFIX}${threadId}`);
  } catch (error) {
    console.error("[DecopilotStorage] Failed to delete messages:", error);
    throw error;
  }
}

/**
 * Get metadata for a thread
 */
export async function getThreadMetadata(
  threadId: string,
): Promise<ThreadMetadata | null> {
  try {
    const meta = await get<ThreadMetadata>(`${THREAD_META_PREFIX}${threadId}`);
    return meta || null;
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get metadata:", error);
    return null;
  }
}

/**
 * Get all thread IDs from IndexedDB
 */
export async function getAllThreadIds(): Promise<string[]> {
  try {
    const allKeys = await keys();
    const threadIds = allKeys
      .filter(
        (key) => typeof key === "string" && key.startsWith(MESSAGES_PREFIX),
      )
      .map((key) => (key as string).replace(MESSAGES_PREFIX, ""));
    return threadIds;
  } catch (error) {
    console.error("[DecopilotStorage] Failed to get thread IDs:", error);
    return [];
  }
}

/**
 * Clear all decopilot data from IndexedDB
 */
export async function clearAllThreads(): Promise<void> {
  try {
    const allKeys = await keys();
    const decopilotKeys = allKeys.filter(
      (key) =>
        typeof key === "string" &&
        (key.startsWith(MESSAGES_PREFIX) || key.startsWith(THREAD_META_PREFIX)),
    );

    await Promise.all(decopilotKeys.map((key) => del(key)));
  } catch (error) {
    console.error("[DecopilotStorage] Failed to clear threads:", error);
    throw error;
  }
}
