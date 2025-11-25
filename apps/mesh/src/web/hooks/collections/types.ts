/**
 * Collection Types
 *
 * Type definitions for working with collections through MCP connections
 * following TanStack DB collection patterns
 */

/**
 * Standard collection response from DECO_COLLECTION_{NAME}_LIST
 */
export interface CollectionListResponse<T = unknown> {
  items: T[];
  total?: number;
  hasMore?: boolean;
  cursor?: string;
}

/**
 * Standard collection item response from DECO_COLLECTION_{NAME}_GET
 */
export interface CollectionItemResponse<T = unknown> {
  item: T;
}

/**
 * Filter options for collection queries (predicate push-down)
 */
export interface CollectionFilter {
  field: string;
  operator: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "like";
  value: unknown;
}

/**
 * Sort options for collection queries
 */
export interface CollectionSort {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Query options for collection list operations
 */
export interface CollectionQueryOptions {
  where?: CollectionFilter[];
  orderBy?: CollectionSort[];
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Base options for collection hooks
 */
export interface CollectionHookOptions {
  /** Connection ID to use for tool calls */
  connectionId: string;
  /** Collection name (e.g., "MODELS", "MESSAGES", "THREADS") */
  collectionName: string;
}

/**
 * Options for useCollectionQuery hook
 */
export interface UseCollectionQueryOptions<T = unknown>
  extends CollectionHookOptions {
  /** Query options (filters, sorting, pagination) */
  queryOptions?: CollectionQueryOptions;
  /** React Query enabled flag */
  enabled?: boolean;
  /** React Query stale time */
  staleTime?: number;
  /** React Query refetch interval */
  refetchInterval?: number;
  /** Transform function for response data */
  select?: (data: CollectionListResponse<T>) => unknown;
  /** Additional query key parts for cache isolation */
  additionalKeyParts?: unknown[];
}

/**
 * Options for useCollectionItem hook
 */
export interface UseCollectionItemOptions<T = unknown>
  extends CollectionHookOptions {
  /** Item ID to fetch */
  id: string;
  /** React Query enabled flag */
  enabled?: boolean;
  /** React Query stale time */
  staleTime?: number;
  /** Transform function for response data */
  select?: (data: CollectionItemResponse<T>) => unknown;
}

/**
 * Options for collection mutations
 */
export interface UseCollectionMutationsOptions extends CollectionHookOptions {
  /** Callback after successful create */
  onCreateSuccess?: (data: unknown) => void;
  /** Callback after successful update */
  onUpdateSuccess?: (data: unknown) => void;
  /** Callback after successful delete */
  onDeleteSuccess?: (id: string) => void;
  /** Whether to invalidate list queries after mutations */
  invalidateOnSuccess?: boolean;
}

/**
 * Create item input
 */
export interface CreateItemInput<T = unknown> {
  item: T;
}

/**
 * Update item input
 */
export interface UpdateItemInput<T = unknown> {
  id: string;
  changes: Partial<T>;
}

/**
 * Delete item input
 */
export interface DeleteItemInput {
  id: string;
}

/**
 * Batch operations input
 */
export interface BatchOperationInput<T = unknown> {
  create?: CreateItemInput<T>[];
  update?: UpdateItemInput<T>[];
  delete?: DeleteItemInput[];
}
