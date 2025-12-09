import { eq, type Collection } from "@tanstack/db";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useProjectContext } from "../providers/project-context-provider";
import type { Message, Thread } from "../types/chat-threads";
import { createIndexedDBCollection } from "./use-indexeddb-collection";

const threadsCollectionCache = {
  key: "",
  value: null as Collection<Thread, string> | null,
};

const messagesCollectionCache = {
  key: "",
  value: null as Collection<Message, string> | null,
};

/**
 * Get or create a threads collection instance for the current organization.
 * Collections are cached to ensure singleton-like behavior per org.
 *
 * @returns A TanStack DB collection instance for threads
 */
export function useThreadsCollection(): Collection<Thread, string> {
  const { locator } = useProjectContext();
  const key = `${locator}:threads`;

  if (threadsCollectionCache.key !== key) {
    threadsCollectionCache.key = key;
    threadsCollectionCache.value = createIndexedDBCollection<Thread>({
      name: key,
    });
  }

  return threadsCollectionCache.value!;
}

/**
 * Get or create a messages collection instance for the current organization.
 * Collections are cached to ensure singleton-like behavior per org.
 *
 * @returns A TanStack DB collection instance for messages
 */
export function useMessagesCollection(): Collection<Message, string> {
  const { locator } = useProjectContext();
  const key = `${locator}:messages`;

  if (messagesCollectionCache.key !== key) {
    messagesCollectionCache.key = key;
    messagesCollectionCache.value = createIndexedDBCollection<Message>({
      name: key,
    });
  }

  return messagesCollectionCache.value!;
}

export function useThreadMessages(threadId: string) {
  const messagesCollection = useMessagesCollection();

  const { data } = useLiveSuspenseQuery(
    (q) =>
      q
        .from({ messages: messagesCollection })
        .where(({ messages }) => eq(messages.metadata?.thread_id, threadId))
        .orderBy(({ messages }) => messages?.metadata?.created_at, "asc"),
    [threadId, messagesCollection],
  );

  return data ?? [];
}
