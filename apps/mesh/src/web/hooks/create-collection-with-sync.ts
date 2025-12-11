import { createCollection, type OperationType } from "@tanstack/db";

/**
 * Custom event type for sync mutations
 */
interface SyncMutationEventDetail<T, TIndexKeys extends string> {
  type: OperationType;
  transaction:
    | InsertTransactionType<T & object, TIndexKeys>
    | UpdateTransactionType<T & object, TIndexKeys>
    | DeleteTransactionType<T & object, TIndexKeys>;
  callback?: (payload: {
    transaction:
      | InsertTransactionType<T & object, TIndexKeys>
      | UpdateTransactionType<T & object, TIndexKeys>
      | DeleteTransactionType<T & object, TIndexKeys>;
  }) => Promise<T[]>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

type SyncMutationEvent<T, TIndexKeys extends string> = CustomEvent<
  SyncMutationEventDetail<T, TIndexKeys>
>;

// Use a helper type to extract transaction from handler
type HandlerParam<T> = T extends (payload: infer P) => unknown ? P : never;
type ExtractTransaction<T> = T extends { transaction: infer Txn } ? Txn : never;

// Create a test collection config to infer types
type TestConfig<T extends object, TIndexKeys extends string> = Parameters<
  typeof createCollection<T, TIndexKeys>
>[0];

type InsertHandler<T extends object, TIndexKeys extends string> = NonNullable<
  TestConfig<T, TIndexKeys>["onInsert"]
>;
type UpdateHandler<T extends object, TIndexKeys extends string> = NonNullable<
  TestConfig<T, TIndexKeys>["onUpdate"]
>;
type DeleteHandler<T extends object, TIndexKeys extends string> = NonNullable<
  TestConfig<T, TIndexKeys>["onDelete"]
>;

type InsertTransactionType<
  T extends object,
  TIndexKeys extends string,
> = ExtractTransaction<HandlerParam<InsertHandler<T, TIndexKeys>>>;
type UpdateTransactionType<
  T extends object,
  TIndexKeys extends string,
> = ExtractTransaction<HandlerParam<UpdateHandler<T, TIndexKeys>>>;
type DeleteTransactionType<
  T extends object,
  TIndexKeys extends string,
> = ExtractTransaction<HandlerParam<DeleteHandler<T, TIndexKeys>>>;

export interface CreateCollectionWithSyncOptions<
  T extends object,
  TIndexKeys extends string = string,
> extends Omit<
    TestConfig<T & object, TIndexKeys>,
    "onInsert" | "onUpdate" | "onDelete" | "singleResult"
  > {
  singleResult?: boolean;
  onInsert?: (payload: {
    transaction: InsertTransactionType<T & object, TIndexKeys>;
  }) => Promise<T[]>;
  onUpdate?: (payload: {
    transaction: UpdateTransactionType<T & object, TIndexKeys>;
  }) => Promise<T[]>;
  onDelete?: (payload: {
    transaction: DeleteTransactionType<T & object, TIndexKeys>;
  }) => Promise<T[]>;
}

/**
 * A wrapper around TanStack DB's createCollection that automatically implements
 * a sync eventing system for optimistic updates and cross-tab/cross-component synchronization.
 *
 * It sets up an EventTarget to broadcast mutations and applies them to the collection,
 * respecting `updated_at` timestamps to prevent overwriting newer data.
 *
 * Returns the configuration object that should be passed to `createCollection`.
 */
export function createCollectionWithSync<
  T extends object,
  TIndexKeys extends string = string,
>(
  options: CreateCollectionWithSyncOptions<T, TIndexKeys>,
): Parameters<typeof createCollection<T, TIndexKeys>>[0] {
  const {
    id: name,
    sync,
    onInsert,
    onUpdate,
    onDelete,
    getKey,
    singleResult,
    ...rest
  } = options;

  // EventTarget for centralized sync mutation handling
  const syncEventTarget = new EventTarget();

  const collectionConfig = {
    id: name,
    getKey,
    ...(singleResult !== undefined && { singleResult }),
    ...rest,
    ...(sync && {
      sync: {
        ...sync,
        sync: (args) => {
          const { begin, write, commit, collection } = args;
          // Call the original sync function if provided
          const cleanup = sync.sync(args);

          let isActive = true;

          // Queue for sequential processing of mutations
          let queue = Promise.resolve();

          const enqueue = (cb: () => Promise<void>) => {
            queue = queue.then(cb).catch(console.error);
          };

          // Centralized handler for sync mutations with timestamp comparison
          const handleMutation = (e: Event) => {
            const { type, transaction, callback, resolve, reject } = (
              e as SyncMutationEvent<T, TIndexKeys>
            ).detail;

            enqueue(async () => {
              if (!isActive) {
                reject(new Error(`Collection ${name} is no longer active`));
                return;
              }

              try {
                // Call the user's callback if provided, otherwise use transaction mutations
                let itemsToDispatch: T[] = [];
                if (callback) {
                  itemsToDispatch = await callback({ transaction });
                } else {
                  itemsToDispatch = transaction.mutations.map(
                    (m) => m.modified,
                  );
                }

                // Process each item
                for (const item of itemsToDispatch) {
                  // Check current state via collection from args
                  const current = collection.get(getKey(item) as TIndexKeys);

                  // Only update if:
                  // - Item doesn't exist in collection (new insert), OR
                  // - Incoming data is newer than current data
                  if (
                    current &&
                    "updated_at" in current &&
                    "updated_at" in item &&
                    typeof current.updated_at === "string" &&
                    typeof item.updated_at === "string" &&
                    new Date(current.updated_at) > new Date(item.updated_at)
                  ) {
                    // Current data is same or newer, skip
                    continue;
                  }

                  begin();
                  write({ type, value: item });
                  commit();
                }

                // All items processed successfully
                resolve();
              } catch (error) {
                console.error(`Error in ${type} callback for ${name}:`, error);
                reject(error);
              }
            });
          };

          syncEventTarget.addEventListener("mutation", handleMutation);

          return () => {
            isActive = false;
            syncEventTarget.removeEventListener("mutation", handleMutation);
            if (typeof cleanup === "function") {
              cleanup();
            }
          };
        },
      },
    }),

    onInsert: async ({ transaction }) => {
      // Create a promise that resolves when the event is handled
      return new Promise<void>((resolve, reject) => {
        // Dispatch event with transaction and callback - the queue will handle calling the callback
        syncEventTarget.dispatchEvent(
          new CustomEvent("mutation", {
            detail: {
              type: "insert" as const,
              transaction,
              callback: onInsert,
              resolve,
              reject,
            },
          }),
        );
      });
    },

    onUpdate: async ({ transaction }) => {
      // Create a promise that resolves when the event is handled
      return new Promise<void>((resolve, reject) => {
        // Dispatch event with transaction and callback - the queue will handle calling the callback
        syncEventTarget.dispatchEvent(
          new CustomEvent("mutation", {
            detail: {
              type: "update" as const,
              transaction,
              callback: onUpdate,
              resolve,
              reject,
            },
          }),
        );
      });
    },

    onDelete: async ({ transaction }) => {
      // Create a promise that resolves when the event is handled
      return new Promise<void>((resolve, reject) => {
        // Dispatch event with transaction and callback - the queue will handle calling the callback
        syncEventTarget.dispatchEvent(
          new CustomEvent("mutation", {
            detail: {
              type: "delete" as const,
              transaction,
              callback: onDelete,
              resolve,
              reject,
            },
          }),
        );
      });
    },
  } as Parameters<typeof createCollection<T, TIndexKeys>>[0];

  return collectionConfig;
}
