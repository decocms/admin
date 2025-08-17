import { analyzeLinks } from "./analyze";
import { getOrSet, buildLinkAnalyzerKey, type CacheLayerEnv } from "../cache";

export async function analyzeLinksCached(env: CacheLayerEnv, url: string) {
  const key = buildLinkAnalyzerKey(url);
  const res = await getOrSet(env, key, () => analyzeLinks(url), {
    ttlSeconds: 60 * 30, // 30m fresh
    staleTtlSeconds: 60 * 60 * 4, // allow stale for 4h total
    hardTtlSeconds: 60 * 60 * 24, // 24h max
    version: 1,
  });
  return { ...res.data, cache: res.cache, stale: res.stale };
}
