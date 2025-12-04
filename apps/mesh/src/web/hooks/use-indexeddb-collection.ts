import { type Collection, createCollection } from "@tanstack/db";
import { del, entries, set } from "idb-keyval";
import { createCollectionWithSync } from "./create-collection-with-sync";

export interface IndexedDBCollectionOptions {
  name: string;
}

export function createIndexedDBCollection<T extends { id: string }>(
  options: IndexedDBCollectionOptions,
): Collection<T, string> {
  const { name } = options;
  const prefix = `${name}:`;

  return createCollection<T, string>(
    createCollectionWithSync<T, string>({
      id: name,
      getKey: (item: T) => item.id,

      sync: {
        rowUpdateMode: "full",
        sync: ({ begin, write, commit, markReady }) => {
          let isActive = true;

          async function initialSync() {
            try {
              const allEntries = await entries();

              // Filter entries for this collection
              const items = allEntries
                .filter(
                  ([key]) => typeof key === "string" && key.startsWith(prefix),
                )
                .map(([, value]) => value as T);

              if (!isActive) return;

              begin();
              for (const item of items) {
                write({ type: "insert", value: item });
              }
              commit();
            } catch (error) {
              console.error(
                `Failed to load collection ${name} from IndexedDB:`,
                error,
              );
            } finally {
              markReady();
            }
          }

          initialSync();

          // Return cleanup function
          return () => {
            isActive = false;
          };
        },
      },

      onInsert: async ({ transaction }) => {
        // Persist to IndexedDB in parallel
        await Promise.all(
          transaction.mutations.map((mutation) =>
            set(`${prefix}${mutation.key}`, mutation.modified),
          ),
        );
        return transaction.mutations.map((m) => m.modified);
      },

      onUpdate: async ({ transaction }) => {
        // Persist to IndexedDB in parallel
        await Promise.all(
          transaction.mutations.map((mutation) =>
            set(`${prefix}${mutation.key}`, mutation.modified),
          ),
        );
        return transaction.mutations.map((m) => m.modified);
      },

      onDelete: async ({ transaction }) => {
        // Persist to IndexedDB in parallel
        await Promise.all(
          transaction.mutations.map((mutation) =>
            del(`${prefix}${mutation.key}`),
          ),
        );
        return transaction.mutations.map((m) => m.modified);
      },
    }),
  );
}
