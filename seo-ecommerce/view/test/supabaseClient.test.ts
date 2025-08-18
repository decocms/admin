import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dynamic import of @supabase/supabase-js
const createClientFn = vi.fn(() => ({
  auth: {
    getSession: () => Promise.resolve({ data: { session: { id: 'sess-1' } } }),
    onAuthStateChange: (_cb: any) => {},
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  from: () => ({
    insert: () => ({
      select: () => ({
        single: () => ({ data: { id: 'new-id' }, error: null }),
      }),
    }),
  }),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientFn }));

// Provide env vars expected by helper
(globalThis as any).import = (specifier: string) => import(specifier as any);

describe('supabaseClient helper', () => {
  beforeEach(() => {
    createClientFn.mockClear();
  });

  it('single-flight loadSupabase returns same instance and only creates once', async () => {
    const mod = await import('../src/lib/supabaseClient.ts');
    const a = await mod.loadSupabase();
    const b = await mod.loadSupabase();
    expect(a).toBe(b);
    expect(createClientFn).toHaveBeenCalledTimes(1);
  });

  it('waitForSession resolves after initial load', async () => {
    const mod = await import('../src/lib/supabaseClient.ts');
    await mod.loadSupabase();
    const session = await mod.waitForSession(500);
    expect(session === null || typeof session === 'object').toBe(true);
  });
});
