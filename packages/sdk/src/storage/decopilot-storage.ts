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
  namespace?: string,
): Promise<UIMessage[] | null> {
  try {
    const key = `${MESSAGES_PREFIX}${namespace ? `${namespace}:` : ""}${threadId}`;
    const messages = await get<UIMessage[]>(key);

    console.log("[DecopilotStorage] Got messages:", key, messages);
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
  namespace?: string,
): Promise<void> {
  try {
    const ns = namespace ? `${namespace}:` : "";
    // Save messages
    await set(`${MESSAGES_PREFIX}${ns}${threadId}`, messages);

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
      messageCount: messages.length,
    };

    await set(metaKey, updatedMeta);
  } catch (error) {
    console.error("[DecopilotStorage] Failed to save messages:", error);
    throw error;
  }
}

/**
 * Append a single message to a thread in IndexedDB
 * More efficient than loading all messages and saving them back
 */
export async function appendThreadMessage(
  threadId: string,
  messages: UIMessage[],
  metadata?: Partial<ThreadMetadata>,
  namespace?: string,
): Promise<void> {
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
    const updatedMessages = [...(existingMessages || []), ...messages];

    // Update thread metadata
    const updatedMeta: ThreadMetadata = {
      threadId,
      agentId: metadata?.agentId || existingMeta?.agentId || "decopilot",
      route: metadata?.route || existingMeta?.route || "",
      createdAt: existingMeta?.createdAt || now,
      updatedAt: now,
      messageCount: updatedMessages.length,
    };

    // Save both messages and metadata
    await Promise.all([
      set(messagesKey, updatedMessages),
      set(metaKey, updatedMeta),
    ]);
  } catch (error) {
    console.error("[DecopilotStorage] Failed to append message:", error);
    throw error;
  }
}

/**
 * Delete messages for a thread from IndexedDB
 */
export async function deleteThreadMessages(
  threadId: string,
  namespace?: string,
): Promise<void> {
  try {
    const ns = namespace ? `${namespace}:` : "";
    await del(`${MESSAGES_PREFIX}${ns}${threadId}`);
    await del(`${THREAD_META_PREFIX}${ns}${threadId}`);
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
