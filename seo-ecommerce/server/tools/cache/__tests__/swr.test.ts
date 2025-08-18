import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheMetricsSnapshot, getOrSet } from '../index';

class MemoryKV {
  store = new Map<string, string>();
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.store.set(k, v);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('cache SWR behavior', () => {
  it('serves stale and triggers background revalidation', async () => {
    vi.useFakeTimers();
    const kv = new MemoryKV();
    let calls = 0;
    const env = { SEO_CACHE: kv };
    // Initial set (fresh)
    const first = await getOrSet(env, 'swr:key', async () => ({ n: ++calls }), {
      ttlSeconds: 1, // 1s fresh
      staleTtlSeconds: 5, // allow stale until 6s total
    });
    expect(first.cache).toBe(false);
    expect(calls).toBe(1);

    // Advance beyond fresh TTL but within stale window
    vi.advanceTimersByTime(1500); // 1.5s

    const second = await getOrSet(
      env,
      'swr:key',
      async () => ({ n: ++calls }),
      {
        ttlSeconds: 1,
        staleTtlSeconds: 5,
      },
    );
    expect(second.cache).toBe(true);
    expect(second.stale).toBe(true);
    expect(second.revalidating).toBe(true);
    // Allow background revalidation promise to run
    await vi.advanceTimersByTimeAsync(10);
    // Background revalidation should have incremented fetch calls
    expect(calls).toBe(2);

    // Third fetch shortly after should now be fresh (new stored value) and not stale
    const third = await getOrSet(env, 'swr:key', async () => ({ n: ++calls }), {
      ttlSeconds: 1,
      staleTtlSeconds: 5,
    });
    expect(third.cache).toBe(true);
    expect(third.stale).toBe(false);
    expect(third.data.n).toBe(2); // value from revalidation

    const metrics = cacheMetricsSnapshot();
    expect(metrics.staleServed).toBeGreaterThanOrEqual(1);
    expect(metrics.revalidationsTriggered).toBeGreaterThanOrEqual(1);
  });
});
