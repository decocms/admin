/**
 * Connection Collection Hooks
 *
 * Provides React hooks for working with connections using TanStack DB collections
 * and live queries. These hooks offer a reactive interface for accessing and
 * manipulating connections.
 */

import { createToolCaller } from "../../../tools/client";
import type { ConnectionEntity } from "../../../tools/connection/schema";
import {
  type CollectionFilter,
  createCollectionFromToolCaller,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";

// Module-level singleton to store the collection instance
export const CONNECTIONS_COLLECTION =
  createCollectionFromToolCaller<ConnectionEntity>({
    toolCaller: createToolCaller(),
    collectionName: "CONNECTIONS",
  });

/**
 * Filter definition for connections (matches @deco/ui Filter shape)
 */
export type ConnectionFilter = CollectionFilter;

/**
 * Options for useConnections hook
 */
export type UseConnectionsOptions = UseCollectionListOptions<ConnectionEntity>;

/**
 * Hook to get all connections with live query reactivity
 *
 * @param options - Filter and configuration options
 * @returns Live query result with connections as ConnectionEntity, plus the original collection for mutations
 */
export function useConnections(options: UseConnectionsOptions = {}) {
  return useCollectionList(CONNECTIONS_COLLECTION, options);
}

/**
 * Hook to get a single connection by ID with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch
 * @returns Live query result with the connection as ConnectionEntity, plus the original collection for mutations
 */
export function useConnection(connectionId: string | undefined) {
  return useCollectionItem(CONNECTIONS_COLLECTION, connectionId);
}

/**
 * Re-export ConnectionEntity type for convenience
 */
export type { ConnectionEntity };
