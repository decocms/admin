import { SingleFlight, singleFlight } from "../common/singleflight.ts";
import { contextStorage } from "../fetch.ts";
import { WebCache } from "./index.ts";

/**
 * Stale-While-Revalidate cache wrapper for async functions.
 *
 * Usage:
 *   const swr = new SWRCache<MyType>("my-cache", { staleTtlSeconds: 5, cacheTtlSeconds: 3600 });
 *   return swr.cache(() => fetchData(), "my-key");
 */
export class SWRCache<T> {
  private _cache: WebCache<T>;
  private _sf: SingleFlight<T>;
  private _staleTtlSeconds?: number;

  constructor(
    cacheName = "swr-cache",
    options?: {
      staleTtlSeconds?: number;
      cacheTtlSeconds?: number;
    },
  ) {
    const cacheTtl = options?.cacheTtlSeconds ?? 3600; // Default to 1 hour
    this._cache = new WebCache<T>(cacheName, cacheTtl);
    this._staleTtlSeconds = options?.staleTtlSeconds;
    this._sf = singleFlight<T>();
  }

  async delete(key: string) {
    await this._cache.delete(key);
  }

  /**
   * Returns cached value if available, otherwise runs fn().
   * Revalidates in background based on stale time configuration.
   *
   * @param fn - The function to fetch fresh data
   * @param key - The cache key
   * @param revalidate - Whether to revalidate (default: true)
   * @returns Promise<T>
   */
  cache(
    fn: () => Promise<T>,
    key: string,
    revalidate = true,
  ): Promise<T> {
    return this._sf.do(key, async () => {
      // Use new metadata-aware method if stale TTL is configured
      if (this._staleTtlSeconds !== undefined) {
        const cached = await this._cache.getWithMetadata(
          key,
          this._staleTtlSeconds,
        );

        if (cached != null) {
          // If data is stale but not expired, revalidate in background
          if (cached.isStale && revalidate) {
            const freshPromise = () =>
              fn().then(async (result) => {
                await this._cache.set(key, result);
                return result;
              });
            contextStorage.getStore()?.ctx?.waitUntil?.(freshPromise());
          }
          return cached.value;
        }
      } else {
        // Fallback to original behavior for backward compatibility
        const cached = await this._cache.get(key);
        if (cached != null) {
          if (revalidate) {
            const freshPromise = () =>
              fn().then(async (result) => {
                await this._cache.set(key, result);
                return result;
              });
            contextStorage.getStore()?.ctx?.waitUntil?.(freshPromise());
          }
          return cached;
        }
      }

      // No cached value, fetch fresh
      const freshPromise = () =>
        fn().then(async (result) => {
          await this._cache.set(key, result);
          return result;
        });

      return freshPromise();
    });
  }
}
