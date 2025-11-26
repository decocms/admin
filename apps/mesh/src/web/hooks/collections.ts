/**
 * Collection Factory from Tool Caller
 *
 * Creates TanStack DB collections that automatically interact with collection-binding-compliant tools.
 * Handles automatic pagination to ensure the collection is fully populated with all items.
 */

import {
  type BaseCollectionEntity,
  type CollectionDeleteOutput,
  type CollectionInsertOutput,
  type CollectionListOutput,
} from "@decocms/bindings/collections";
import {
  and,
  type Collection,
  createCollection,
  eq,
  like,
  or,
} from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "@tanstack/react-db";
import type { ToolCaller } from "../../tools/client";

/**
 * Collection entity base type that matches the collection binding pattern
 */
export type CollectionEntity = BaseCollectionEntity;

/**
 * Options for creating a collection from a tool caller
 */
export interface CreateCollectionOptions<T extends CollectionEntity> {
  /** The tool caller function for making API calls */
  toolCaller: ToolCaller;
  /** The collection name (e.g., "CONNECTIONS", "MODELS") - used for tool names and query key */
  collectionName: string;
  /** The query client for TanStack Query integration */
  queryClient: QueryClient;
  /** Default page size for pagination (default: 100) */
  pageSize?: number;
  /** Transform function for items after fetch (optional) */
  transformItem?: (item: unknown) => T;
}

/**
 * Creates a TanStack DB collection that syncs with collection-binding-compliant tools.
 *
 * Features:
 * - Automatic pagination: Fetches all pages of data to ensure complete collection
 * - Optimistic updates: Built-in via TanStack DB's collection.insert/update/delete
 * - Automatic rollback: On persistence errors, optimistic state is rolled back
 * - Live queries: Subscribers get real-time updates when data changes
 *
 * Usage:
 * ```ts
 * const collection = createCollectionFromToolCaller({
 *   toolCaller: createToolCaller(),
 *   collectionName: "CONNECTIONS",
 *   queryClient,
 * });
 *
 * // Insert with optimistic update
 * collection.insert({ id: "1", title: "New Connection", ... });
 *
 * // Update with optimistic update
 * collection.update("1", (draft) => { draft.title = "Updated"; });
 *
 * // Delete with optimistic update
 * collection.delete("1");
 * ```
 *
 * @param options - Configuration options for the collection
 * @returns A TanStack DB collection instance with persistence handlers
 */
export function createCollectionFromToolCaller<T extends CollectionEntity>(
  options: CreateCollectionOptions<T>,
): Collection<T, string> {
  const {
    toolCaller,
    collectionName,
    queryClient,
    pageSize = 100,
    transformItem = (item) => item as T,
  } = options;

  const lowerName = collectionName.toLowerCase();
  const upperName = collectionName.toUpperCase();
  const queryKey = ["collection", lowerName];
  const listToolName = `DECO_COLLECTION_${upperName}_LIST`;
  const createToolName = `DECO_COLLECTION_${upperName}_CREATE`;
  const updateToolName = `DECO_COLLECTION_${upperName}_UPDATE`;
  const deleteToolName = `DECO_COLLECTION_${upperName}_DELETE`;

  /**
   * Fetches all pages of data using pagination.
   * This ensures the collection is fully populated with ALL items.
   */
  async function fetchAllPages(
    queryOptions?: Record<string, unknown>,
  ): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    const limit = pageSize;

    while (true) {
      try {
        const params = {
          ...queryOptions,
          offset,
          limit,
        };

        const result = (await toolCaller(
          listToolName,
          params,
        )) as CollectionListOutput<unknown>;
        const items = result.items || [];

        // Transform and accumulate items
        for (const item of items) {
          allItems.push(transformItem(item));
        }

        // Check if we've fetched all pages
        if (!result.hasMore || items.length === 0) {
          break;
        }

        offset += limit;
      } catch (error) {
        console.error(
          `Error fetching page at offset ${offset} for ${collectionName}:`,
          error,
        );
        // Return accumulated items so far on error
        break;
      }
    }

    return allItems;
  }

  // Create the TanStack DB collection with query collection options and persistence handlers
  return createCollection<T, string>(
    queryCollectionOptions({
      id: lowerName,
      queryClient,
      queryKey,
      getKey: (item: T) => item.id,

      queryFn: fetchAllPages,

      // Persistence handler for inserts
      onInsert: async ({ transaction, collection }) => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const result = (await toolCaller(createToolName, {
              data: mutation.modified,
            })) as CollectionInsertOutput<unknown>;

            // Transform and write the server response back to sync store
            const serverItem = transformItem(result.item);
            collection.utils.writeUpdate(serverItem);
          }),
        );

        // Skip automatic refetch since we've synced the server response
        return { refetch: false };
      },

      // Persistence handler for updates
      onUpdate: async ({ transaction, collection }) => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const result = (await toolCaller(updateToolName, {
              id: mutation.key,
              data: mutation.changes,
            })) as CollectionInsertOutput<unknown>;

            // Transform and write the server response back to sync store
            const serverItem = transformItem(result.item);
            collection.utils.writeUpdate(serverItem);
          }),
        );

        // Skip automatic refetch since we've synced the server response
        return { refetch: false };
      },

      // Persistence handler for deletes
      onDelete: async ({ transaction }) => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            (await toolCaller(deleteToolName, {
              id: mutation.key,
            })) as CollectionDeleteOutput;
          }),
        );

        // Skip automatic refetch since delete was successful
        return { refetch: false };
      },
    }),
  );
}

/**
 * Filter definition for collection queries (matches @deco/ui Filter shape)
 */
export interface CollectionFilter {
  /** Field to filter on (must match an entity property) */
  column: string;
  /** Value to match */
  value: string;
}

/**
 * Options for useCollectionList hook
 */
export interface UseCollectionListOptions<T extends CollectionEntity> {
  /** Text search term (searches configured searchable fields) */
  searchTerm?: string;
  /** Field filters */
  filters?: CollectionFilter[];
  /** Sort key (field to sort by) */
  sortKey?: keyof T;
  /** Sort direction */
  sortDirection?: "asc" | "desc" | null;
  /** Fields to search when searchTerm is provided (default: ["title", "description"]) */
  searchFields?: (keyof T)[];
  /** Default sort key when none provided */
  defaultSortKey?: keyof T;
}

/**
 * Generic hook to get all items from a collection with live query reactivity
 *
 * @param collection - The TanStack DB collection instance
 * @param options - Filter and configuration options
 * @returns Live query result with items as T[]
 */
export function useCollectionList<T extends CollectionEntity>(
  collection: Collection<T, string>,
  options: UseCollectionListOptions<T> = {},
) {
  const {
    searchTerm,
    filters,
    sortKey,
    sortDirection,
    searchFields = ["title", "description"] as (keyof T)[],
    defaultSortKey = "updated_at" as keyof T,
  } = options;

  // Use live query for reactive data with all filtering and sorting in the query
  // See: https://tanstack.com/db/latest/docs/guides/live-queries#functional-select
  return useLiveQuery(
    (q) => {
      // Start with base query and sorting
      let query = q
        .from({ item: collection })
        .orderBy(
          ({ item }) => item[sortKey ?? defaultSortKey],
          sortDirection ?? "asc",
        );

      // Check if we need .where() (TanStack DB doesn't support returning plain `true`)
      const hasSearch = !!searchTerm?.trim();
      const hasFilters = filters && filters.length > 0;

      if (hasSearch || hasFilters) {
        query = query.where(({ item }) => {
          const conditions: unknown[] = [];

          // Text search (searches configured fields)
          const search = searchTerm?.trim();
          if (search) {
            const searchConditions = searchFields
              .filter((field) => field in item)
              .map((field) =>
                like((item[field] as string) ?? "", `%${search}%`),
              );

            if (searchConditions.length > 0) {
              conditions.push(
                searchConditions.length === 1
                  ? searchConditions[0]
                  : or(...(searchConditions as Parameters<typeof or>)),
              );
            }
          }

          // Field filters
          if (filters && filters.length > 0) {
            for (const filter of filters) {
              // Column must match an entity property
              if (!(filter.column in item)) continue;
              const field = item[filter.column as keyof typeof item] ?? "";
              conditions.push(eq(field as string, filter.value));
            }
          }

          // Combine all conditions with AND using a ternary
          return conditions.length === 1
            ? conditions[0]
            : and(...(conditions as Parameters<typeof and>));
        });
      }

      // Use functional select to extract actual item data
      return query.fn.select((row) => row.item as T);
    },
    [searchTerm, filters, sortKey, sortDirection],
  );
}

/**
 * Generic hook to get a single item by ID from a collection with live query reactivity
 *
 * @param collection - The TanStack DB collection instance
 * @param itemId - The ID of the item to fetch
 * @returns Live query result with the item as T
 */
export function useCollectionItem<T extends CollectionEntity>(
  collection: Collection<T, string>,
  itemId: string | undefined,
) {
  return useLiveQuery(
    (q) => {
      let query = q.from({ item: collection });

      if (!itemId) {
        // Return an empty query when no ID provided
        query = query.where(({ item }) => eq(item.id, ""));
      } else {
        query = query.where(({ item }) => eq(item.id, itemId));
      }

      // Use functional select to extract actual item data
      return query.fn.select((row) => row.item as T);
    },
    [itemId],
  );
}
