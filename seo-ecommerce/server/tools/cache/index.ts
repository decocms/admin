// Generic caching utilities for SEO tools (PageSpeed, Link Analyzer)
// Supports Cloudflare KV (persistent) + in-memory LRU per isolate.

// Minimal KV namespace interface (avoid depending on CF types in pure context)
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface CacheLayerEnv {
  SEO_CACHE?: KVNamespaceLike; // Cloudflare KV binding (optional for local tests)
}

interface Entry<T> {
  ts: number; // epoch ms when stored
  ttl: number; // soft TTL seconds
  hardTtl: number; // hard TTL seconds (after which entry unusable)
  version: number;
  data: T;
}

export interface GetOrSetOptions<T> {
  ttlSeconds: number; // freshness window
  staleTtlSeconds?: number; // allowed staleness window beyond ttlSeconds to still serve while revalidating
  hardTtlSeconds?: number; // absolute expiry (default 2 * stale window or 48h)
  version?: number; // bump to force invalidate
  kv?: KVNamespaceLike; // override env binding
  bypass?: boolean; // force skip cache (query/header)
  serialize?: (v: Entry<T>) => string;
  deserialize?: (raw: string) => Entry<T> | null;
  revalidate?: boolean; // allow SWR behavior
}

interface GetOrSetResult<T> {
  data: T;
  cache: boolean;
  stale: boolean;
  revalidating?: boolean;
  storedAt?: number;
}

// Simple LRU
const LRU_CAP = 200;
const memory = new Map<string, Entry<any>>();

// Metrics counters (in-memory per isolate)
const metrics = {
  lruHits: 0,
  kvHits: 0,
  misses: 0,
  staleServed: 0,
  revalidationsTriggered: 0,
  writes: 0,
};

function lruGet<T>(k: string): Entry<T> | undefined {
  const v = memory.get(k);
  if (v) {
    memory.delete(k);
    memory.set(k, v);
  }
  return v;
}
function lruSet<T>(k: string, v: Entry<T>) {
  if (memory.has(k)) memory.delete(k);
  memory.set(k, v);
  while (memory.size > LRU_CAP) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
    else break;
  }
}

const DEFAULT_SERIALIZE = <T>(e: Entry<T>) => JSON.stringify(e);
const DEFAULT_DESERIALIZE = <T>(raw: string): Entry<T> | null => {
  try {
    return JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
};

let __loggedKvFallback = false;

export async function getOrSet<T>(
  env: CacheLayerEnv,
  key: string,
  fetchFn: () => Promise<T>,
  opts: GetOrSetOptions<T>,
): Promise<GetOrSetResult<T>> {
  const {
    ttlSeconds,
    staleTtlSeconds = 0,
    hardTtlSeconds = Math.max(ttlSeconds + staleTtlSeconds, 172800), // default 48h if bigger
    version = 1,
    // Respect explicit override in opts or env flag USE_KV=0 to disable KV usage.
    kv = ((): KVNamespaceLike | undefined => {
      const disabled = (env as any)?.USE_KV === '0' ||
        (globalThis as any)?.USE_KV === '0';
      if (disabled) return undefined;
      return env.SEO_CACHE;
    })(),
    bypass,
    serialize = DEFAULT_SERIALIZE,
    deserialize = DEFAULT_DESERIALIZE,
    revalidate = true,
  } = opts;
  const now = Date.now();
  if (bypass) {
    const data = await fetchFn();
    return { data, cache: false, stale: false };
  }
  const mem = lruGet<T>(key);
  if (mem && mem.version === version) {
    const ageSec = (now - mem.ts) / 1000;
    if (ageSec <= ttlSeconds) {
      metrics.lruHits++;
      return { data: mem.data, cache: true, stale: false, storedAt: mem.ts };
    }
  }
  let kvEntry: Entry<T> | undefined;
  if (kv) {
    try {
      const raw = await kv.get(key);
      if (raw) {
        const parsed = deserialize(raw);
        if (parsed && parsed.version === version) kvEntry = parsed;
      }
    } catch {}
  } else if (!__loggedKvFallback) {
    __loggedKvFallback = true;
    try {
      // Lightweight single log to indicate KV disabled / missing; avoid spamming.
      console.warn(
        '[cache] KV disabled or missing (using in-memory only). Set USE_KV=1 and provide binding SEO_CACHE to enable persistence.',
      );
    } catch {}
  }
  if (kvEntry) {
    const ageSec = (now - kvEntry.ts) / 1000;
    const fresh = ageSec <= ttlSeconds;
    const withinStale = ageSec <= ttlSeconds + staleTtlSeconds;
    const withinHard = ageSec <= hardTtlSeconds;
    if (fresh) {
      lruSet(key, kvEntry);
      metrics.kvHits++;
      return {
        data: kvEntry.data,
        cache: true,
        stale: false,
        storedAt: kvEntry.ts,
      };
    }
    if (!fresh && withinStale && withinHard && revalidate) {
      // Serve stale, trigger background revalidation (fire and forget)
      revalidateAsync(env, key, fetchFn, opts).catch(() => {});
      lruSet(key, kvEntry);
      metrics.kvHits++;
      metrics.staleServed++;
      metrics.revalidationsTriggered++;
      return {
        data: kvEntry.data,
        cache: true,
        stale: true,
        revalidating: true,
        storedAt: kvEntry.ts,
      };
    }
    // Hard expired or outside stale: refetch before serving
  }
  const data = await fetchFn();
  const entry: Entry<T> = {
    ts: now,
    ttl: ttlSeconds,
    hardTtl: hardTtlSeconds,
    version,
    data,
  };
  lruSet(key, entry);
  if (kv) {
    try {
      await kv.put(key, serialize(entry));
      metrics.writes++;
    } catch {}
  }
  metrics.misses++;
  return { data, cache: false, stale: false, storedAt: now };
}

async function revalidateAsync<T>(
  env: CacheLayerEnv,
  key: string,
  fetchFn: () => Promise<T>,
  opts: GetOrSetOptions<T>,
) {
  try {
    const data = await fetchFn();
    const now = Date.now();
    const entry: Entry<T> = {
      ts: now,
      ttl: opts.ttlSeconds,
      hardTtl: opts.hardTtlSeconds || opts.ttlSeconds * 2,
      version: opts.version || 1,
      data,
    };
    lruSet(key, entry);
    const kv = opts.kv || env.SEO_CACHE;
    if (kv) await kv.put(key, (opts.serialize || DEFAULT_SERIALIZE)(entry));
    metrics.writes++;
  } catch {
    // swallow
  }
}

// URL normalization + key construction helpers
export interface NormalizedUrlParts {
  origin: string;
  path: string;
  query: string; // sorted, filtered
}

const TRACKING_PARAM_REGEX = /^(utm_|gclid|fbclid|yclid|_hs|mc_|sc_)/i;

export function normalizeUrl(raw: string): NormalizedUrlParts {
  const u = new URL(raw);
  const origin = u.origin.toLowerCase();
  const path = u.pathname.replace(/\/+/g, '/');
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAM_REGEX.test(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return { origin, path, query: params };
}

export function buildPageSpeedKey(url: string, strategy: string) {
  const { origin, path, query } = normalizeUrl(url);
  return `pagespeed:v1:${strategy}:${origin}${path}?${query}`;
}

export function buildLinkAnalyzerKey(url: string) {
  const { origin, path, query } = normalizeUrl(url);
  return `links:v1:${origin}${path}?${query}`;
}

export function cacheMetricsSnapshot() {
  return { ...metrics, lruSize: memory.size, lruCap: LRU_CAP };
}
