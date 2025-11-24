/**
 * Collection Utilities
 *
 * Helper functions for working with collections
 */

import type { CollectionHookOptions, CollectionQueryOptions } from "./types";

/**
 * Generate standard collection tool names following the DECO_COLLECTION_ convention
 */
export const collectionTools = {
  list: (collectionName: string) => `DECO_COLLECTION_${collectionName}_LIST`,
  get: (collectionName: string) => `DECO_COLLECTION_${collectionName}_GET`,
  create: (collectionName: string) =>
    `DECO_COLLECTION_${collectionName}_CREATE`,
  update: (collectionName: string) =>
    `DECO_COLLECTION_${collectionName}_UPDATE`,
  delete: (collectionName: string) =>
    `DECO_COLLECTION_${collectionName}_DELETE`,
  batch: (collectionName: string) => `DECO_COLLECTION_${collectionName}_BATCH`,
} as const;

/**
 * Generate query keys for collection queries
 * Follows the pattern: [connectionId, 'collection', collectionName, 'list', queryOptions]
 */
export function getCollectionListKey(
  options: CollectionHookOptions & {
    queryOptions?: CollectionQueryOptions;
    additionalKeyParts?: unknown[];
  },
) {
  const { connectionId, collectionName, queryOptions, additionalKeyParts } =
    options;

  const key: unknown[] = [
    connectionId,
    "collection",
    collectionName,
    "list",
  ];

  // Add query options if present (for cache isolation by filters)
  if (queryOptions) {
    key.push(queryOptions);
  }

  // Add any additional key parts
  if (additionalKeyParts) {
    key.push(...additionalKeyParts);
  }

  return key;
}

/**
 * Generate query key for single item queries
 * Follows the pattern: [connectionId, 'collection', collectionName, 'item', id]
 */
export function getCollectionItemKey(
  options: CollectionHookOptions & { id: string },
) {
  const { connectionId, collectionName, id } = options;
  return [connectionId, "collection", collectionName, "item", id] as const;
}

/**
 * Generate query key prefix for invalidating all collection queries
 */
export function getCollectionKeyPrefix(options: CollectionHookOptions) {
  const { connectionId, collectionName } = options;
  return [connectionId, "collection", collectionName] as const;
}

/**
 * Format query options for MCP tool call
 * Converts our CollectionQueryOptions to the format expected by the collection binding
 */
export function formatQueryOptions(
  options?: CollectionQueryOptions,
): Record<string, unknown> {
  if (!options) {
    return {};
  }

  const params: Record<string, unknown> = {};

  // Format filters (where clause)
  if (options.where && options.where.length > 0) {
    params.where = options.where;
  }

  // Format sorting (orderBy clause)
  if (options.orderBy && options.orderBy.length > 0) {
    params.orderBy = options.orderBy;
  }

  // Add pagination
  if (options.limit !== undefined) {
    params.limit = options.limit;
  }

  if (options.offset !== undefined) {
    params.offset = options.offset;
  }

  if (options.cursor !== undefined) {
    params.cursor = options.cursor;
  }

  return params;
}

