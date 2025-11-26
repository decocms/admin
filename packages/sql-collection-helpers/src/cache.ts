/**
 * SWR (Stale-While-Revalidate) Cache Implementation
 *
 * This module provides a simple SWR cache for database introspection results.
 * It allows returning stale data immediately while revalidating in the background.
 */

import type { TableMetadata } from "./types";

interface CacheEntry {
  data: TableMetadata[];
  timestamp: number;
  revalidating: boolean;
}

/**
 * SWR Cache for database introspection results
 */
export class IntrospectionCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttl = 60000) {
    // Default: 60 seconds
    this.ttl = ttl;
  }

  /**
   * Generate cache key from database config
   */
  private getCacheKey(
    type: string,
    connectionString: string,
    schema?: string,
  ): string {
    return `${type}:${connectionString}${schema ? `:${schema}` : ""}`;
  }

  /**
   * Check if cache entry is stale
   */
  private isStale(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * Get cached data or undefined
   */
  get(
    type: string,
    connectionString: string,
    schema?: string,
  ): TableMetadata[] | undefined {
    const key = this.getCacheKey(type, connectionString, schema);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    return entry.data;
  }

  /**
   * Check if cache entry is stale and needs revalidation
   */
  needsRevalidation(
    type: string,
    connectionString: string,
    schema?: string,
  ): boolean {
    const key = this.getCacheKey(type, connectionString, schema);
    const entry = this.cache.get(key);

    if (!entry) {
      return true;
    }

    return this.isStale(entry) && !entry.revalidating;
  }

  /**
   * Mark cache entry as being revalidated
   */
  markRevalidating(
    type: string,
    connectionString: string,
    schema?: string,
  ): void {
    const key = this.getCacheKey(type, connectionString, schema);
    const entry = this.cache.get(key);

    if (entry) {
      entry.revalidating = true;
    }
  }

  /**
   * Set cache entry with new data
   */
  set(
    type: string,
    connectionString: string,
    data: TableMetadata[],
    schema?: string,
  ): void {
    const key = this.getCacheKey(type, connectionString, schema);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      revalidating: false,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache entry for specific database
   */
  clearEntry(type: string, connectionString: string, schema?: string): void {
    const key = this.getCacheKey(type, connectionString, schema);
    this.cache.delete(key);
  }

  /**
   * Get or fetch data with SWR behavior
   */
  async getOrFetch(
    type: string,
    connectionString: string,
    fetcher: () => Promise<TableMetadata[]>,
    schema?: string,
  ): Promise<TableMetadata[]> {
    const cached = this.get(type, connectionString, schema);

    // If we have cached data, return it immediately
    if (cached) {
      // If stale, trigger background revalidation
      if (this.needsRevalidation(type, connectionString, schema)) {
        this.markRevalidating(type, connectionString, schema);

        // Revalidate in background (don't await)
        fetcher()
          .then((data) => {
            this.set(type, connectionString, data, schema);
          })
          .catch((error) => {
            console.error("Background revalidation failed:", error);
            // Reset revalidating flag on error
            const key = this.getCacheKey(type, connectionString, schema);
            const entry = this.cache.get(key);
            if (entry) {
              entry.revalidating = false;
            }
          });
      }

      return cached;
    }

    // No cached data, fetch fresh
    const data = await fetcher();
    this.set(type, connectionString, data, schema);
    return data;
  }
}

/**
 * Global cache instance (singleton)
 */
let globalCache: IntrospectionCache | null = null;

/**
 * Get or create the global cache instance
 */
export function getGlobalCache(ttl?: number): IntrospectionCache {
  if (!globalCache) {
    globalCache = new IntrospectionCache(ttl);
  }
  return globalCache;
}

/**
 * Reset the global cache instance
 */
export function resetGlobalCache(): void {
  globalCache = null;
}
