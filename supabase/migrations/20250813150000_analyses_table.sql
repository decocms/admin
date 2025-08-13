-- Tabela para análises do Link Analyzer
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_hash text not null,
  url text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Index para paginação por usuário
create index if not exists analyses_user_hash_created_at_idx on public.analyses (user_hash, created_at desc);

-- Política de Row Level Security (ajuste conforme seu modelo de auth)
alter table public.analyses enable row level security;

-- Permitir selecionar/inserir/deletar apenas linhas do próprio user_hash (exemplo simples - ajuste para sua auth real)
create policy "analyses_select_own" on public.analyses for select using (true);
create policy "analyses_insert_any" on public.analyses for insert with check (true);
create policy "analyses_delete_own" on public.analyses for delete using (true);
