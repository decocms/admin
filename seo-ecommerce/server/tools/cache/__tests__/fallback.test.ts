import { describe, it, expect, beforeEach } from 'vitest';
import { getOrSet } from '../index';

describe('cache fallback without KV', () => {
  beforeEach(() => {
    // disable KV via global flag and ensure no residual state
    (globalThis as any).USE_KV = '0';
  });

  it('uses in-memory LRU when KV disabled', async () => {
    let calls = 0;
    const env: any = {}; // no SEO_CACHE binding
    const fetchFn = async () => {
      calls++;
      return { value: 'data-' + calls };
    };
    const first = await getOrSet(env, 'k1', fetchFn, { ttlSeconds: 60 });
    const second = await getOrSet(env, 'k1', fetchFn, { ttlSeconds: 60 });

    expect(first.cache).toBe(false); // miss
    expect(second.cache).toBe(true); // served from memory
    expect(calls).toBe(1); // fetch executed only once
    expect(second.data.value).toBe('data-1');
  });

  it('respects fresh TTL and bypass flag', async () => {
    let calls = 0;
    const env: any = {};
    const fetchFn = async () => ({ ts: ++calls });
    const a = await getOrSet(env, 'k2', fetchFn, { ttlSeconds: 120 });
    const b = await getOrSet(env, 'k2', fetchFn, { ttlSeconds: 120 });
    const c = await getOrSet(env, 'k2', fetchFn, { ttlSeconds: 120, bypass: true });
    expect(a.cache).toBe(false);
    expect(b.cache).toBe(true);
    expect(c.cache).toBe(false); // bypass forces fetch
    expect(c.data.ts).toBe(2);
  });
});
