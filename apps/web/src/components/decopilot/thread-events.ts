/**
 * @deprecated This event-based communication system is no longer used.
 * Use ThreadContextProvider and useSetThreadContext instead.
 *
 * This file is kept for backward compatibility during migration.
 */

export interface ThreadContextUpdateEvent {
  threadId: string;
  rules?: string[];
  tools?: Record<string, string[]>;
}

// Global event target for thread context updates
export const threadEventTarget = new EventTarget();

export const THREAD_CONTEXT_UPDATE_EVENT = "thread-context-update";

/**
 * @deprecated Use useSetThreadContext from thread-context-provider.tsx instead.
 * Emit a context update event for a specific thread
 */
export function emitThreadContextUpdate(event: ThreadContextUpdateEvent) {
  threadEventTarget.dispatchEvent(
    new CustomEvent(THREAD_CONTEXT_UPDATE_EVENT, {
      detail: event,
    }),
  );
}

/**
 * @deprecated AgenticChatProvider now reads from ThreadContextProvider directly.
 * Listen for context updates for a specific thread
 */
export function subscribeToThreadContextUpdates(
  threadId: string,
  callback: (rules: string[], tools: Record<string, string[]>) => void,
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ThreadContextUpdateEvent>;
    const { threadId: targetThreadId, rules, tools } = customEvent.detail;

    // Only process if this event is for our thread
    if (targetThreadId === threadId) {
      callback(rules || [], tools || {});
    }
  };

  threadEventTarget.addEventListener(THREAD_CONTEXT_UPDATE_EVENT, handler);

  return () => {
    threadEventTarget.removeEventListener(THREAD_CONTEXT_UPDATE_EVENT, handler);
  };
}
