// Lightweight browser-side Supabase client loader with runtime env discovery.
export async function loadSupabase() {
  if (typeof window === 'undefined') throw new Error('Client only');
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  let url = '';
  let anon = '';
  try {
    const r = await fetch('/__env',{ cache:'no-store' });
    if(r.ok){ const d = await r.json(); url = d.PUBLIC_SUPABASE_URL || ''; anon = d.PUBLIC_SUPABASE_ANON_KEY || ''; }
  } catch {}
  if(!url || !anon) throw new Error('Supabase env ausente');
  return mod.createClient(url, anon, { auth: { persistSession: true, storageKey: 'la-supa-auth' } });
}

export async function getSession() {
  try { const raw = localStorage.getItem('la-supa-auth'); if(!raw) return null; return JSON.parse(raw); } catch { return null; }
}import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let cachedSession: Session | null = null;

export function getSupabase() {
  if (client) return client;
  const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase env vars ausentes (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY)');
  client = createClient(url, anon, { auth: { persistSession: true, storageKey: 'la-supa-auth' } });
  // Carrega sessão async (não bloqueante)
  client.auth.getSession().then(({ data }) => { cachedSession = data.session; });
  client.auth.onAuthStateChange((_e, session) => { cachedSession = session; });
  return client;
}

export function getSupabaseForToken(token: string) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase env vars ausentes');
  return createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

export function getSessionSync(){ return cachedSession; }
export function getUserSync(): User | null { return cachedSession?.user ?? null; }

export async function signInEmail(email: string){
  const supa = getSupabase();
  return supa.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
}
export async function signOut(){
  const supa = getSupabase();
  await supa.auth.signOut();
}

// Email + password flows
export async function signUpEmailPassword(email: string, password: string){
  const supa = getSupabase();
  return supa.auth.signUp({ email, password });
}
export async function signInEmailPassword(email: string, password: string){
  const supa = getSupabase();
  return supa.auth.signInWithPassword({ email, password });
}
export async function resetPasswordEmail(email: string, redirectTo?: string){
  const supa = getSupabase();
  return supa.auth.resetPasswordForEmail(email, { redirectTo });
}

export interface AnalysisRecord {
  id: string;
  user_hash: string;
  url: string;
  data: any;
  created_at?: string;
}

export async function saveAnalysisDirect(url: string, data: any){
  const supa = getSupabase();
  const user = getUserSync();
  if(!user) throw new Error('Usuário não autenticado');
  const user_hash = user.id; // reutiliza id do usuário
  const { data: inserted, error } = await supa.from('analyses').insert({ user_hash, url, data }).select('id').single();
  if(error) throw error;
  return inserted?.id;
}
