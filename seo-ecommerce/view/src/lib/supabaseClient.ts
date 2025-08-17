// Unified Supabase client helper (browser). Avoid static ESM import when bundling causes 404 from worker port.
// We lazily dynamic-import @supabase/supabase-js when needed. Type-only import is erased at build time.
import type { Session, User, SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";

// Lightweight exported alias (we intentionally do not ship full types if tree-shaken out)
export type SupabaseClient = SupabaseClientType;
type CreateClientFn = (url: string, anon: string, opts?: any) => SupabaseClient;

// Configurable constants
const LS_SESSION_KEY = "la-supa-auth"; // persisted session storage key
const DEFAULT_IMPORT_TIMEOUT_MS = 8000; // safety timeout for CDN dynamic import

// Single-flight promise for dynamic module load
let createClientPromise: Promise<CreateClientFn> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (!ms) return p;
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(to); resolve(v); }, e => { clearTimeout(to); reject(e); });
  });
}

async function dynamicCreateClient(): Promise<CreateClientFn> {
  if (createClientPromise) return createClientPromise;
  createClientPromise = (async () => {
    // Prefer local bundle resolution if Vite handled it; fallback to CDN.
    try {
      const m: any = await withTimeout(import("@supabase/supabase-js"), 3000, "local supabase import");
      if (m?.createClient) return m.createClient as CreateClientFn;
    } catch (err) {
      // Swallow and fallback; log once (avoid noisy console spam)
      if ((globalThis as any)._supabaseDynWarned !== true) {
        (globalThis as any)._supabaseDynWarned = true;
        console.warn("[supabaseClient] local import fallback -> CDN", err instanceof Error ? err.message : err);
      }
    }
    // Optional version pin via global or import.meta.env
    const version =
      (globalThis as any).PUBLIC_SUPABASE_JS_VERSION ||
      (import.meta as any)?.env?.PUBLIC_SUPABASE_JS_VERSION ||
      ""; // empty => latest
    const baseCdn =
      (globalThis as any).PUBLIC_SUPABASE_JS_CDN ||
      (import.meta as any)?.env?.PUBLIC_SUPABASE_JS_CDN ||
      "https://cdn.jsdelivr.net/npm";
    const spec = `@supabase/supabase-js${version ? "@" + version : ""}`;
    const url = `${baseCdn}/${spec}/+esm`;
    // @ts-ignore - dynamic CDN ESM import (no types)
    const cdn: any = await withTimeout(import(url), DEFAULT_IMPORT_TIMEOUT_MS, "cdn supabase import");
    if (!cdn?.createClient) throw new Error("Supabase createClient ausente no CDN");
    return cdn.createClient as CreateClientFn;
  })();
  return createClientPromise;
}

// Cache env fetch (single-flight) to avoid multiple /__env requests
let publicEnvPromise: Promise<{ url: string; anon: string }> | null = null;

async function fetchPublicEnv(): Promise<{ url: string; anon: string }> {
  if (publicEnvPromise) return publicEnvPromise;
  publicEnvPromise = (async () => {
    let url = (import.meta as any)?.env?.PUBLIC_SUPABASE_URL || "";
    let anon = (import.meta as any)?.env?.PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) {
      try {
        // Simple retry (2 attempts) for transient /__env fetch errors
        let attempt = 0;
        while (attempt < 2 && (!url || !anon)) {
          attempt++;
            const r = await fetch("/__env", { cache: "no-store" });
            if (r.ok) {
              const d = await r.json();
              url = d.PUBLIC_SUPABASE_URL || url;
              anon = d.PUBLIC_SUPABASE_ANON_KEY || anon;
            }
            if (!url || !anon) await new Promise(r => setTimeout(r, 150 * attempt));
        }
      } catch (e) {
        // Allow retry on subsequent call by clearing promise below in catch handler
        console.warn("[supabaseClient] falha ao buscar /__env", e);
      }
    }
    if (!url || !anon) throw new Error("Supabase env ausente");
    return { url, anon };
  })();
  // If it rejects, allow a new attempt later.
  publicEnvPromise.catch(() => { publicEnvPromise = null; });
  return publicEnvPromise;
}

let client: SupabaseClient | null = null;
let clientInitPromise: Promise<SupabaseClient> | null = null;
let cachedSession: Session | null = null;

export async function loadSupabase(options?: { authStorageKey?: string }) {
  if (typeof window === "undefined") throw new Error("Client only");
  if (client) return client;
  if (clientInitPromise) return clientInitPromise;
  clientInitPromise = (async () => {
    const { url, anon } = await fetchPublicEnv();
    const createClient = await dynamicCreateClient();
    const storageKey = options?.authStorageKey || LS_SESSION_KEY;
    const c = createClient(url, anon, {
      auth: { persistSession: true, storageKey },
    });
    // Preload session
    try {
      c.auth.getSession().then((r: any) => {
        cachedSession = r?.data?.session || null;
      });
    } catch {}
    c.auth.onAuthStateChange?.((_e: any, session: Session | null) => {
      cachedSession = session || null;
    });
    client = c;
    return c;
  })();
  return clientInitPromise;
}

export async function getSupabase(opts?: { authStorageKey?: string }) { return loadSupabase(opts); }

export async function getSupabaseForToken(token: string) {
  const { url, anon } = await fetchPublicEnv();
  const createClient = await dynamicCreateClient();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function getSession() {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function getSessionSync() {
  return cachedSession;
}

export function getUserSync(): User | null {
  return cachedSession?.user ?? null;
}

// Wait until we have attempted an initial session load (or timeout)
export async function waitForSession(timeoutMs = 3000): Promise<Session | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (cachedSession !== null) return cachedSession;
    // Use rAF when possible to integrate with frame loop
    await new Promise(r => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(() => r(null)) : setTimeout(r, 50)));
  }
  return cachedSession;
}

export async function signInEmail(email: string) {
  const supa = await getSupabase();
  return supa.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
}
export async function signOut() {
  const supa = await getSupabase();
  await supa.auth.signOut();
}

// Email + password flows
export async function signUpEmailPassword(email: string, password: string) {
  const supa = await getSupabase();
  return supa.auth.signUp({ email, password });
}
export async function signInEmailPassword(email: string, password: string) {
  const supa = await getSupabase();
  return supa.auth.signInWithPassword({ email, password });
}
export async function resetPasswordEmail(email: string, redirectTo?: string) {
  const supa = await getSupabase();
  return supa.auth.resetPasswordForEmail(email, { redirectTo });
}

export interface AnalysisRecord {
  id: string;
  user_hash: string;
  url: string;
  data: any;
  created_at?: string;
}

export async function saveAnalysisDirect(url: string, data: any) {
  const supa = await getSupabase();
  const user = getUserSync();
  if (!user) throw new Error("Usuário não autenticado");
  const user_hash = user.id;
  const { data: inserted, error } = await supa
    .from("analyses")
    .insert({ user_hash, url, data })
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id;
}

// Testing / reset utility (not exported by default in production bundles)
export function __resetSupabaseForTests() {
  createClientPromise = null;
  publicEnvPromise = null;
  client = null;
  clientInitPromise = null;
  cachedSession = null;
  delete (globalThis as any)._supabaseDynWarned;
}
