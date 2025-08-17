// Central TTL & cache version configuration
// Adjust here to change global caching behavior.

export const CACHE_TTLS = {
  pagespeed: {
    fresh: 6 * 60 * 60, // 6h
    stale: 12 * 60 * 60, // serve stale until 12h total
    hard: 48 * 60 * 60, // absolute discard after 48h
    version: 1,
  },
  linkAnalyzer: {
    fresh: 30 * 60, // 30m
    stale: 4 * 60 * 60, // up to 4h total
    hard: 24 * 60 * 60, // 24h
    version: 1,
  },
} as const;

export type CacheToolKey = keyof typeof CACHE_TTLS;

export function getCacheConfig(tool: CacheToolKey) {
  return CACHE_TTLS[tool];
}
