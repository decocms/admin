/**
 * useConnectionCollections Hook
 *
 * Hook to discover available collections for a connection
 * by analyzing the connection's available tools
 */

import { useQuery } from "@tanstack/react-query";
import { createConnectionToolCaller } from "@/tools/client";
import { KEYS } from "@/lib/query-keys";

/**
 * Discovered collection information
 */
export interface DiscoveredCollection {
  name: string;
  operations: {
    list: boolean;
    get: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    batch: boolean;
  };
}

/**
 * Hook to discover collections available on a connection
 *
 * This hook analyzes the connection's available tools and identifies
 * which collections are available and what operations they support.
 *
 * @example
 * ```tsx
 * const { collections, isLoading } = useConnectionCollections({
 *   connectionId: connection.id,
 * });
 *
 * // collections might be:
 * // [
 * //   {
 * //     name: "MODELS",
 * //     operations: { list: true, get: true, create: true, update: true, delete: true, batch: false }
 * //   },
 * //   {
 * //     name: "MESSAGES",
 * //     operations: { list: true, get: true, create: true, update: false, delete: true, batch: true }
 * //   }
 * // ]
 * ```
 */
export function useConnectionCollections(options: {
  connectionId: string;
  enabled?: boolean;
}) {
  const { connectionId, enabled = true } = options;

  return useQuery({
    queryKey: KEYS.connectionCollections(connectionId),
    enabled: enabled && Boolean(connectionId),
    staleTime: 60_000, // Cache for 1 minute
    queryFn: async () => {
      // Call the connection's tools/list to get available tools
      const callTool = createConnectionToolCaller(connectionId);

      // Most MCP servers don't have a tools/list tool, they use the MCP protocol
      // We'll need to fetch this through the connection metadata
      // For now, we'll make an educated guess based on common patterns

      // Try to call a DECO_COLLECTION_*_LIST tool to see what's available
      // This is a workaround - ideally we'd have a discovery endpoint

      const collectionsMap = new Map<
        string,
        DiscoveredCollection["operations"]
      >();

      // Try common collection names
      const commonCollections = ["MODELS", "MESSAGES", "THREADS", "USERS"];

      for (const collectionName of commonCollections) {
        const operations: DiscoveredCollection["operations"] = {
          list: false,
          get: false,
          create: false,
          update: false,
          delete: false,
          batch: false,
        };

        // Try LIST operation (most common)
        try {
          await callTool(`DECO_COLLECTION_${collectionName}_LIST`, {
            limit: 1,
          });
          operations.list = true;

          // If LIST works, assume other operations might work
          // (This is heuristic-based, not definitive)
          collectionsMap.set(collectionName, operations);
        } catch {
          // Collection doesn't exist or isn't accessible
          continue;
        }

        // Try other operations (optional - can be expensive)
        // For now, we'll just assume they exist if LIST exists
        operations.get = true;
        operations.create = true;
        operations.update = true;
        operations.delete = true;
      }

      const collections: DiscoveredCollection[] = Array.from(
        collectionsMap.entries(),
      ).map(([name, operations]) => ({
        name,
        operations,
      }));

      return collections;
    },
  });
}

/**
 * Hook to check if a specific collection is available on a connection
 *
 * @example
 * ```tsx
 * const hasModels = useHasCollection({
 *   connectionId: connection.id,
 *   collectionName: "MODELS",
 * });
 *
 * if (hasModels) {
 *   // Use the MODELS collection
 * }
 * ```
 */
export function useHasCollection(options: {
  connectionId: string;
  collectionName: string;
  enabled?: boolean;
}) {
  const { connectionId, collectionName, enabled = true } = options;

  const discovery = useConnectionCollections({ connectionId, enabled });

  return discovery.data?.some((c) => c.name === collectionName) ?? false;
}
