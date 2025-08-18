import { describe, expect, it } from 'vitest';
import { buildLinkAnalyzerKey, buildPageSpeedKey, getOrSet, normalizeUrl } from '../index';

class MemoryKV {
  store = new Map<string, string>();
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.store.set(k, v);
  }
  async delete(k: string) {
    this.store.delete(k);
  }
}

describe('cache utils', () => {
  it('normalizes and filters tracking params', () => {
    const n = normalizeUrl('https://Example.com/Path?a=1&utm_source=x&b=2');
    expect(n.origin).toBe('https://example.com');
    expect(n.path).toBe('/Path');
    expect(n.query).toBe('a=1&b=2');
  });
  it('builds deterministic keys', () => {
    const k1 = buildPageSpeedKey(
      'https://a.com/x?b=2&a=1&utm_source=z',
      'mobile',
    );
    const k2 = buildPageSpeedKey('https://a.com/x?a=1&b=2', 'mobile');
    expect(k1).toBe(k2);
    const l1 = buildLinkAnalyzerKey('https://a.com/x?gclid=abc&z=9');
    const l2 = buildLinkAnalyzerKey('https://a.com/x?z=9');
    expect(l1).toBe(l2);
  });
  it('getOrSet caches and serves stale while revalidating', async () => {
    const kv = new MemoryKV();
    let calls = 0;
    const env = { SEO_CACHE: kv };
    const first = await getOrSet(
      env,
      'k:test',
      async () => {
        calls++;
        return { v: calls };
      },
      { ttlSeconds: 0.1, staleTtlSeconds: 0.2 },
    );
    expect(first.cache).toBe(false);
    expect(calls).toBe(1);
    const hit = await getOrSet(
      env,
      'k:test',
      async () => {
        calls++;
        return { v: calls };
      },
      { ttlSeconds: 60, staleTtlSeconds: 0 },
    );
    expect(hit.cache).toBe(true);
    expect(hit.data.v).toBe(1);
  });
});
