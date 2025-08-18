import { analyzeLinks } from "./analyze";
import { buildLinkAnalyzerKey, type CacheLayerEnv, getOrSet } from "../cache";
import { getCacheConfig } from "../../config/cache";
import { recordToolError, recordToolSuccess } from "../metrics";

export async function analyzeLinksCached(env: CacheLayerEnv, url: string) {
  const start = Date.now();
  try {
    const key = buildLinkAnalyzerKey(url);
    const cfg = getCacheConfig("linkAnalyzer");
    const res = await getOrSet(env, key, () => analyzeLinks(url), {
      ttlSeconds: cfg.fresh,
      staleTtlSeconds: cfg.stale,
      hardTtlSeconds: cfg.hard,
      version: cfg.version,
    });
    recordToolSuccess("LINK_ANALYZER", Date.now() - start);
    return { ...res.data, cache: res.cache, stale: res.stale };
  } catch (e) {
    recordToolError("LINK_ANALYZER", Date.now() - start);
    throw e;
  }
}
