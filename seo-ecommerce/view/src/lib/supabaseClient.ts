// Unified Supabase client helper (browser). Avoid static ESM import when bundling causes 404 from worker port.
// We lazily dynamic-import @supabase/supabase-js when needed.
import type { Session, User } from "@supabase/supabase-js";
// Note: do NOT import createClient statically to prevent dev worker trying to resolve module via 4000 origin.
type SupabaseClient = any; // lightweight typing to avoid mandatory import

async function dynamicCreateClient(): Promise<
  (url: string, anon: string, opts?: any) => SupabaseClient
> {
  // Prefer local bundle resolution if Vite handled it; fallback to CDN.
  try {
    const m: any = await import("@supabase/supabase-js");
    if (m?.createClient) return m.createClient;
  } catch {}
  // @ts-ignore - dynamic CDN ESM import (no types)
  const cdn: any = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"
  );
  return cdn.createClient;
}

async function fetchPublicEnv(): Promise<{ url: string; anon: string }> {
  let url = import.meta?.env?.PUBLIC_SUPABASE_URL || "";
  let anon = import.meta?.env?.PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    try {
      const r = await fetch("/__env", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        url = d.PUBLIC_SUPABASE_URL || url;
        anon = d.PUBLIC_SUPABASE_ANON_KEY || anon;
      }
    } catch {}
  }
  if (!url || !anon) throw new Error("Supabase env ausente");
  return { url, anon };
}

export async function loadSupabase() {
  if (typeof window === "undefined") throw new Error("Client only");
  if (client) return client;
  const { url, anon } = await fetchPublicEnv();
  const createClient = await dynamicCreateClient();
  client = createClient(url, anon, {
    auth: { persistSession: true, storageKey: "la-supa-auth" },
  });
  // Preload session
  try {
    client.auth.getSession().then((r: any) => {
      cachedSession = r?.data?.session || null;
    });
  } catch {}
  client.auth.onAuthStateChange?.((_e: any, session: Session) => {
    cachedSession = session;
  });
  return client;
}

export async function getSession() {
  try {
    const raw = localStorage.getItem("la-supa-auth");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let client: SupabaseClient | null = null;
let cachedSession: Session | null = null;

export async function getSupabase() {
  return loadSupabase();
}

export async function getSupabaseForToken(token: string) {
  const { url, anon } = await fetchPublicEnv();
  const createClient = await dynamicCreateClient();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function getSessionSync() {
  return cachedSession;
}
export function getUserSync(): User | null {
  return cachedSession?.user ?? null;
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
