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

describe('supabaseClient helper', () => {
  beforeEach(() => {
    createClientFn.mockClear();
  });

  it('single-flight returns same instance', async () => {
    const mod = await import('../../view/src/lib/supabaseClient.ts');
    const a = await mod.loadSupabase();
    const b = await mod.loadSupabase();
    expect(a).toBe(b);
    expect(createClientFn).toHaveBeenCalledTimes(1);
  });

  it('waitForSession yields a session or null', async () => {
    const mod = await import('../../view/src/lib/supabaseClient.ts');
    await mod.loadSupabase();
    const session = await mod.waitForSession(200);
    expect(session === null || typeof session === 'object').toBe(true);
  });
});
