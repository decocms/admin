/**
 * useCollectionQuery Hook
 *
 * React Query hook for fetching collection data from MCP connections
 * Follows TanStack DB collection patterns
 */

import { useQuery } from "@tanstack/react-query";
import { createConnectionToolCaller } from "@/tools/client";
import type {
  CollectionListResponse,
  UseCollectionQueryOptions,
} from "./types";
import {
  collectionTools,
  formatQueryOptions,
  getCollectionListKey,
} from "./utils";

/**
 * Hook to query a collection list
 *
 * @example
 * ```tsx
 * const modelsQuery = useCollectionQuery({
 *   connectionId: connection.id,
 *   collectionName: 'MODELS',
 *   enabled: Boolean(connection),
 *   staleTime: 30_000,
 * });
 *
 * // With filters and sorting
 * const filteredQuery = useCollectionQuery({
 *   connectionId: connection.id,
 *   collectionName: 'MESSAGES',
 *   queryOptions: {
 *     where: [
 *       { field: 'status', operator: 'eq', value: 'active' }
 *     ],
 *     orderBy: [
 *       { field: 'createdAt', direction: 'desc' }
 *     ],
 *     limit: 50,
 *   },
 * });
 * ```
 */
export function useCollectionQuery<T = unknown>(
  options: UseCollectionQueryOptions<T>,
) {
  const {
    connectionId,
    collectionName,
    queryOptions,
    enabled = true,
    staleTime = 30_000,
    refetchInterval = 0,
    select,
    additionalKeyParts,
  } = options;

  return useQuery({
    queryKey: getCollectionListKey({
      connectionId,
      collectionName,
      queryOptions,
      additionalKeyParts,
    }),
    enabled: enabled && Boolean(connectionId),
    staleTime,
    refetchInterval,
    queryFn: async () => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.list(collectionName);

      // Format query options for the tool call
      const params = formatQueryOptions(queryOptions);

      const result = await callTool(toolName, params);

      return {
        items: result?.items ?? [],
        total: result?.total,
        hasMore: result?.hasMore,
        cursor: result?.cursor,
      } as CollectionListResponse<T>;
    },
    select,
  });
}
