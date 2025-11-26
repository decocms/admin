/**
 * Tests for SWR Cache implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntrospectionCache, getGlobalCache, resetGlobalCache } from "../src/cache";
import type { TableMetadata } from "../src/types";

describe("IntrospectionCache", () => {
  let cache: IntrospectionCache;

  const mockTableMetadata: TableMetadata[] = [
    {
      name: "users",
      columns: [],
      primaryKey: "id",
      auditFields: {},
    },
  ];

  beforeEach(() => {
    cache = new IntrospectionCache(1000); // 1 second TTL for testing
  });

  describe("basic operations", () => {
    it("should return undefined for non-existent cache entry", () => {
      const result = cache.get("postgres", "postgresql://localhost/test");
      expect(result).toBeUndefined();
    });

    it("should store and retrieve cache entries", () => {
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      const result = cache.get("postgres", "postgresql://localhost/test");
      expect(result).toEqual(mockTableMetadata);
    });

    it("should handle schema parameter in cache key", () => {
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata, "public");
      
      const withSchema = cache.get("postgres", "postgresql://localhost/test", "public");
      const withoutSchema = cache.get("postgres", "postgresql://localhost/test");
      
      expect(withSchema).toEqual(mockTableMetadata);
      expect(withoutSchema).toBeUndefined();
    });

    it("should clear specific cache entry", () => {
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      cache.clearEntry("postgres", "postgresql://localhost/test");
      
      const result = cache.get("postgres", "postgresql://localhost/test");
      expect(result).toBeUndefined();
    });

    it("should clear all cache entries", () => {
      cache.set("postgres", "postgresql://localhost/test1", mockTableMetadata);
      cache.set("sqlite", "file:test.db", mockTableMetadata);
      
      cache.clear();
      
      expect(cache.get("postgres", "postgresql://localhost/test1")).toBeUndefined();
      expect(cache.get("sqlite", "file:test.db")).toBeUndefined();
    });
  });

  describe("staleness detection", () => {
    it("should detect when revalidation is needed for stale entries", async () => {
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      
      // Initially not stale
      expect(cache.needsRevalidation("postgres", "postgresql://localhost/test")).toBe(false);
      
      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      // Now should be stale
      expect(cache.needsRevalidation("postgres", "postgresql://localhost/test")).toBe(true);
    });

    it("should not need revalidation when already revalidating", () => {
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      cache.markRevalidating("postgres", "postgresql://localhost/test");
      
      expect(cache.needsRevalidation("postgres", "postgresql://localhost/test")).toBe(false);
    });

    it("should need revalidation for non-existent entry", () => {
      expect(cache.needsRevalidation("postgres", "postgresql://localhost/test")).toBe(true);
    });
  });

  describe("getOrFetch with SWR behavior", () => {
    it("should fetch fresh data when cache is empty", async () => {
      const fetcher = vi.fn().mockResolvedValue(mockTableMetadata);
      
      const result = await cache.getOrFetch(
        "postgres",
        "postgresql://localhost/test",
        fetcher,
      );
      
      expect(result).toEqual(mockTableMetadata);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should return cached data immediately", async () => {
      const fetcher = vi.fn().mockResolvedValue(mockTableMetadata);
      
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      
      const result = await cache.getOrFetch(
        "postgres",
        "postgresql://localhost/test",
        fetcher,
      );
      
      expect(result).toEqual(mockTableMetadata);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("should trigger background revalidation for stale data", async () => {
      const fetcher = vi.fn().mockResolvedValue(mockTableMetadata);
      
      cache.set("postgres", "postgresql://localhost/test", mockTableMetadata);
      
      // Wait for data to become stale
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      const result = await cache.getOrFetch(
        "postgres",
        "postgresql://localhost/test",
        fetcher,
      );
      
      // Should return stale data immediately
      expect(result).toEqual(mockTableMetadata);
      
      // Should trigger background revalidation
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should handle fetcher errors gracefully", async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error("Database error"));
      
      await expect(
        cache.getOrFetch("postgres", "postgresql://localhost/test", fetcher),
      ).rejects.toThrow("Database error");
    });
  });
});

describe("Global cache instance", () => {
  beforeEach(() => {
    resetGlobalCache();
  });

  it("should create and return global cache", () => {
    const cache1 = getGlobalCache();
    const cache2 = getGlobalCache();
    
    expect(cache1).toBe(cache2);
  });

  it("should use provided TTL for new global cache", () => {
    const cache = getGlobalCache(5000);
    expect(cache).toBeDefined();
  });

  it("should reset global cache", () => {
    const cache1 = getGlobalCache();
    resetGlobalCache();
    const cache2 = getGlobalCache();
    
    expect(cache1).not.toBe(cache2);
  });
});

