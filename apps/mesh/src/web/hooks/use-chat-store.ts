import { eq, type Collection } from "@tanstack/db";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import type { Message, Thread } from "../types/chat-threads";
import { useCollectionList } from "./use-collections";
import { createIndexedDBCollection } from "./use-indexeddb-collection";
import { useProjectContext } from "../providers/project-context-provider";

const threadsCollectionCache = new Map<string, Collection<Thread, string>>();
const messagesCollectionCache = new Map<string, Collection<Message, string>>();

/**
 * Get or create a threads collection instance for the current organization.
 * Collections are cached to ensure singleton-like behavior per org.
 *
 * @returns A TanStack DB collection instance for threads
 */
export function useThreadsCollection(): Collection<Thread, string> {
  const { org } = useProjectContext();
  const key = `${org}:threads`;

  if (!threadsCollectionCache.has(key)) {
    const collection = createIndexedDBCollection<Thread>({
      name: key,
    });
    threadsCollectionCache.set(key, collection);
  }

  return threadsCollectionCache.get(key) as Collection<Thread, string>;
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

  if (!messagesCollectionCache.has(key)) {
    const collection = createIndexedDBCollection<Message>({ name: key });
    messagesCollectionCache.set(key, collection);
  }

  return messagesCollectionCache.get(key) as Collection<Message, string>;
}

export function useThreads() {
  const threadsCollection = useThreadsCollection();
  return useCollectionList(threadsCollection, {
    sortKey: "updated_at",
    sortDirection: "desc",
  });
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
