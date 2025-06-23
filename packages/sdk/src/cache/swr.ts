import { contextStorage } from "../fetch.ts";
import { WebCache } from "./index.ts";

/**
 * Stale-While-Revalidate cache wrapper for async functions.
 *
 * Usage:
 *   const swr = new SWRCache<MyType>("my-cache");
 *   return swr.cache(() => fetchData(), "my-key");
 */
export class SWRCache<T> {
  private _cache: WebCache<T>;

  constructor(cacheName = "swr-cache", ttlSeconds?: number) {
    this._cache = new WebCache<T>(cacheName, ttlSeconds);
  }

  /**
   * Returns cached value if available, otherwise runs fn().
   * Always revalidates in background and updates cache.
   *
   * @param fn - The function to fetch fresh data
   * @param key - The cache key
   * @returns Promise<T>
   */
  async cache(
    fn: () => Promise<T>,
    key: string,
    revalidate = true,
  ): Promise<T> {
    // Start both cache and fresh fetch in parallel
    const cachePromise = this._cache.get(key);
    const freshPromise = () =>
      fn().then(async (result) => {
        await this._cache.set(key, result);
        return result;
      });

    const cached = await cachePromise;
    if (cached != null) {
      if (revalidate) {
        contextStorage.getStore()?.ctx?.waitUntil?.(freshPromise());
      }
      return cached;
    }

    return freshPromise();
  }
}
