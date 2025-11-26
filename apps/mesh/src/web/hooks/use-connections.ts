/**
 * Connection Hooks
 *
 * Provides React hooks for working with connections using TanStack DB collections
 * and live queries. These hooks offer a reactive interface for accessing and
 * manipulating connections.
 */

import { createToolCaller } from "../../tools/client";
import type { ConnectionEntity } from "../../tools/connection/schema";
import {
  type CollectionFilter,
  createCollectionFromToolCaller,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "./use-collections";

// Module-level singleton to store the collection instance
let connectionsCollectionSingleton: ReturnType<
  typeof createCollectionFromToolCaller<ConnectionEntity>
> | null = null;

/**
 * Get or create the connections collection singleton.
 * This is at module scope to ensure true singleton behavior.
 */
function getOrCreateConnectionsCollection() {
  connectionsCollectionSingleton ??=
    createCollectionFromToolCaller<ConnectionEntity>({
      toolCaller: createToolCaller(),
      collectionName: "CONNECTIONS",
    });

  return connectionsCollectionSingleton;
}

/**
 * Hook to get the connections collection
 *
 * Uses createToolCaller() (no connectionId) to route to the mesh API.
 * The collection is a singleton shared across all components.
 *
 * @returns The connections collection with CRUD operations
 */
export function useConnectionsCollection() {
  return getOrCreateConnectionsCollection();
}

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
  const collection = useConnectionsCollection();
  return useCollectionList(collection, options);
}

/**
 * Hook to get a single connection by ID with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch
 * @returns Live query result with the connection as ConnectionEntity, plus the original collection for mutations
 */
export function useConnection(connectionId: string | undefined) {
  const collection = useConnectionsCollection();
  return useCollectionItem(collection, connectionId);
}

/**
 * Re-export ConnectionEntity type for convenience
 */
export type { ConnectionEntity };
