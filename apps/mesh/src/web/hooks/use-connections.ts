/**
 * Connection Hooks
 *
 * Provides React hooks for working with connections using TanStack DB collections
 * and live queries. These hooks offer a reactive interface for accessing and
 * manipulating connections.
 */

import { useMemo } from "react";
import { createToolCaller } from "../../tools/client";
import type { ConnectionEntity } from "../../tools/connection/schema";
import {
  type CollectionFilter,
  createCollectionFromToolCaller,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "./use-collections";
import { useToolCall } from "./use-tool-call";

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

/**
 * Validated collection binding
 */
export interface ValidatedCollection {
  name: string;
  displayName: string;
}

/**
 * Response from CONNECTION_DETECT_COLLECTIONS tool
 */
interface DetectCollectionsResponse {
  collections: ValidatedCollection[];
}

/**
 * Hook to detect and validate collection bindings from connection tools
 * Uses the server-side CONNECTION_DETECT_COLLECTIONS tool to avoid browser
 * compatibility issues with json-schema-diff
 *
 * @param connectionId - The ID of the connection to analyze
 * @returns Object with collections array and loading state
 */
export function useCollectionBindings(connectionId: string | undefined): {
  collections: ValidatedCollection[];
  isLoading: boolean;
} {
  // Create tool caller for mesh API (no connection ID)
  const toolCaller = useMemo(() => createToolCaller(), []);

  const { data, isLoading } = useToolCall<
    { connectionId: string },
    DetectCollectionsResponse
  >({
    toolCaller,
    toolName: "CONNECTION_DETECT_COLLECTIONS",
    toolInputParams: { connectionId: connectionId ?? "" },
    enabled: Boolean(connectionId),
    staleTime: 60_000, // Cache for 1 minute
  });

  return {
    collections: data?.collections ?? [],
    isLoading,
  };
}
