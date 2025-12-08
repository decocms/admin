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
  useCollection,
  useCollectionItem,
  useCollectionList,
  type UseCollectionListOptions,
} from "../use-collections";
import { useProjectContext } from "../../providers/project-context-provider";
import { useMemo } from "react";

/**
 * Filter definition for connections (matches @deco/ui Filter shape)
 */
export type ConnectionFilter = CollectionFilter;

/**
 * Options for useConnections hook
 */
export type UseConnectionsOptions = UseCollectionListOptions<ConnectionEntity>;

/**
 * Hook to get the connections collection instance
 */
export function useConnectionsCollection() {
  const { org } = useProjectContext();
  // Use org as the connectionKey, and default toolCaller (mesh tools)
  const toolCaller = useMemo(() => createToolCaller(), []);

  return useCollection<ConnectionEntity>(org, "CONNECTIONS", toolCaller);
}

/**
 * Hook to get all connections with live query reactivity
 *
 * @param options - Filter and configuration options
 * @returns Live query result with connections as ConnectionEntity
 */
export function useConnections(options: UseConnectionsOptions = {}) {
  const collection = useConnectionsCollection();
  return useCollectionList(collection, options);
}

/**
 * Hook to get a single connection by ID with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch
 * @returns Live query result with the connection as ConnectionEntity
 */
export function useConnection(connectionId: string | undefined) {
  const collection = useConnectionsCollection();
  return useCollectionItem(collection, connectionId);
}

/**
 * Re-export ConnectionEntity type for convenience
 */
export type { ConnectionEntity };
