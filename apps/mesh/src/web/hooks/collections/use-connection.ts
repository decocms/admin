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

// Module-level cache to store collections per org
const connectionsCollectionCache = new Map<
  string,
  ReturnType<typeof createCollectionFromToolCaller<ConnectionEntity>>
>();

/**
 * Get or create the connections collection for a specific org.
 * Each org gets its own collection instance to avoid cache conflicts.
 */
function getOrCreateConnectionsCollection(orgId: string) {
  if (!connectionsCollectionCache.has(orgId)) {
    connectionsCollectionCache.set(
      orgId,
      createCollectionFromToolCaller<ConnectionEntity>({
        toolCaller: createToolCaller(),
        collectionName: "CONNECTIONS",
      }),
    );
  }

  return connectionsCollectionCache.get(orgId)!;
}

/**
 * Hook to get the connections collection
 *
 * Uses createToolCaller() (no connectionId) to route to the mesh API.
 * Each organization has its own collection instance to avoid cache conflicts.
 *
 * @param orgId - The organization ID (optional, for cache isolation per org)
 * @returns The connections collection with CRUD operations
 */
export function useConnectionsCollection(orgId?: string) {
  // Use a default org ID if not provided
  const safeOrgId = orgId || "default";
  const collection = getOrCreateConnectionsCollection(safeOrgId);
  if (!collection) {
    throw new Error("Failed to initialize connections collection");
  }
  return collection;
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
 * @param optionsOrOrgId - Either options object or organization ID string for cache isolation
 * @param legacyOptions - Legacy options parameter (for backward compatibility)
 * @returns Live query result with connections as ConnectionEntity, plus the original collection for mutations
 */
export function useConnections(
  optionsOrOrgId?: UseConnectionsOptions | string,
  legacyOptions?: UseConnectionsOptions,
) {
  // Determine if first parameter is orgId (string) or options (object)
  const isFirstParamOrgId =
    typeof optionsOrOrgId === "string" && optionsOrOrgId.length > 0;
  const orgId = isFirstParamOrgId ? (optionsOrOrgId as string) : undefined;
  const options = isFirstParamOrgId
    ? (legacyOptions ?? {})
    : ((optionsOrOrgId as UseConnectionsOptions) ?? {});

  const collection = useConnectionsCollection(orgId);
  return useCollectionList(collection, options);
}

/**
 * Hook to get a single connection by ID with live query reactivity
 *
 * @param connectionId - The ID of the connection to fetch
 * @param orgId - The organization ID (optional, for cache isolation per org)
 * @returns Live query result with the connection as ConnectionEntity, plus the original collection for mutations
 */
export function useConnection(
  connectionId: string | undefined,
  orgId?: string,
) {
  const collection = useConnectionsCollection(orgId);
  return useCollectionItem(collection, connectionId);
}

/**
 * Re-export ConnectionEntity type for convenience
 */
export type { ConnectionEntity };
