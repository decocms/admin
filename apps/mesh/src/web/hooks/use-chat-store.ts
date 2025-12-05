import { eq } from "@tanstack/db";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import type { Message, Thread } from "../types/chat-threads";
import { useCollectionList } from "./use-collections";
import { createIndexedDBCollection } from "./use-indexeddb-collection";

// Collections defined once at module scope
export const THREADS_COLLECTION = createIndexedDBCollection<Thread>({
  name: "threads",
});

export const MESSAGES_COLLECTION = createIndexedDBCollection<Message>({
  name: "messages",
});

export function useThreads() {
  return useCollectionList(THREADS_COLLECTION, {
    sortKey: "updated_at",
    sortDirection: "desc",
  });
}

export function useThreadMessages(threadId: string) {
  const { data } = useLiveSuspenseQuery(
    (q) => {
      // Query from messages collection, join with threads
      return q
        .from({ messages: MESSAGES_COLLECTION })
        .where(({ messages }) => {
          if (!messages) return false;
          // Filter by threadId from message metadata
          return eq(messages.metadata?.thread_id, threadId);
        })
        .join({ threads: THREADS_COLLECTION }, ({ messages, threads }) => {
          // Join condition: match threadId from message metadata to thread id
          return messages && threads
            ? eq(messages.metadata?.thread_id, threads.id)
            : false;
        })
        .orderBy(({ messages }) => messages?.metadata?.created_at, "asc");
    },
    [threadId],
  );

  // Extract messages from join result
  return data?.map((row) => row.messages) ?? [];
}
