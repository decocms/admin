/**
 * useCollectionItem Hook
 *
 * React Query hook for fetching a single collection item
 */

import { useQuery } from "@tanstack/react-query";
import { createConnectionToolCaller } from "@/tools/client";
import type {
  CollectionItemResponse,
  UseCollectionItemOptions,
} from "./types";
import { collectionTools, getCollectionItemKey } from "./utils";

/**
 * Hook to query a single collection item by ID
 *
 * @example
 * ```tsx
 * const modelQuery = useCollectionItem({
 *   connectionId: connection.id,
 *   collectionName: 'MODELS',
 *   id: 'anthropic/claude-3.5-sonnet',
 *   enabled: Boolean(connection),
 * });
 * ```
 */
export function useCollectionItem<T = unknown>(
  options: UseCollectionItemOptions<T>,
) {
  const {
    connectionId,
    collectionName,
    id,
    enabled = true,
    staleTime = 30_000,
    select,
  } = options;

  return useQuery({
    queryKey: getCollectionItemKey({ connectionId, collectionName, id }),
    enabled: enabled && Boolean(connectionId) && Boolean(id),
    staleTime,
    queryFn: async () => {
      const callTool = createConnectionToolCaller(connectionId);
      const toolName = collectionTools.get(collectionName);

      const result = await callTool(toolName, { id });

      return {
        item: result?.item,
      } as CollectionItemResponse<T>;
    },
    select,
  });
}

