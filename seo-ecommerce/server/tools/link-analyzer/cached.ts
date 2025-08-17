import { analyzeLinks } from "./analyze";
import { getOrSet, buildLinkAnalyzerKey, type CacheLayerEnv } from "../cache";
import { getCacheConfig } from "../../config/cache";

export async function analyzeLinksCached(env: CacheLayerEnv, url: string) {
  const key = buildLinkAnalyzerKey(url);
  const cfg = getCacheConfig("linkAnalyzer");
  const res = await getOrSet(env, key, () => analyzeLinks(url), {
    ttlSeconds: cfg.fresh,
    staleTtlSeconds: cfg.stale,
    hardTtlSeconds: cfg.hard,
    version: cfg.version,
  });
  return { ...res.data, cache: res.cache, stale: res.stale };
}
