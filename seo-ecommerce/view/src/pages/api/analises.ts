import type { APIRoute } from 'astro';
import { getSupabase } from '../../lib/supabaseClient';

// Fallback em memória (usado se Supabase não configurado)
const store: Map<string, any[]> = (globalThis as any).__ANALISES_STORE__ || new Map();
(globalThis as any).__ANALISES_STORE__ = store;

interface SavePayload { url: string; data: any; userHash?: string; user?: string }

const TABLE = 'analyses';

async function haveSupabase() {
  try {
    getSupabase();
    return true;
  } catch {
    return false;
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const OPTIONS: APIRoute = () => new Response('', {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
});

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const userHash = url.searchParams.get('userHash') || '';
  if (!userHash) return json({ error: 'userHash ausente' }, 400);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const q = (url.searchParams.get('q') || '').toLowerCase();

  if (await haveSupabase()) {
    const supa = getSupabase();
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supa.from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_hash', userHash)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (q) {
      // Supabase text search simples pelo campo url
      query = query.ilike('url', `%${q}%`);
    }
    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ page, limit, total: count || 0, items: (data || []).map(r => ({ id: r.id, url: r.url, ts: r.created_at, data: r.data })) });
  }

  // Fallback memória
  const list = store.get(userHash) || [];
  const filtered = q ? list.filter(r => r.url.toLowerCase().includes(q)) : list;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit);
  return json({ page, limit, total, items: pageItems, fallback: true });
};

export const POST: APIRoute = async ({ request }) => {
  let body: SavePayload;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { url, data, userHash } = body;
  if (!userHash) return json({ error: 'userHash obrigatório' }, 400);
  if (typeof url !== 'string') return json({ error: 'url inválida' }, 400);

  if (await haveSupabase()) {
    const supa = getSupabase();
    const { data: inserted, error } = await supa.from(TABLE).insert({ user_hash: userHash, url, data }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return json({ saved: true, id: inserted?.id });
  }

  const id = (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
  const record = { id, url, ts: Date.now(), data };
  const arr = store.get(userHash) || [];
  arr.unshift(record);
  store.set(userHash, arr.slice(0, 500));
  return json({ saved: true, id, fallback: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const userHash = url.searchParams.get('userHash') || '';
  const id = url.searchParams.get('id') || '';
  if (!userHash || !id) return json({ error: 'userHash e id obrigatórios' }, 400);

  if (await haveSupabase()) {
    const supa = getSupabase();
    const { error } = await supa.from(TABLE).delete().eq('id', id).eq('user_hash', userHash);
    if (error) return json({ error: error.message }, 500);
    return json({ deleted: true });
  }

  const arr = store.get(userHash) || [];
  const next = arr.filter(r => r.id !== id);
  store.set(userHash, next);
  return json({ deleted: arr.length !== next.length, fallback: true });
};
