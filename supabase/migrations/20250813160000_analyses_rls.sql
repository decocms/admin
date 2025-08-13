-- RLS refinado para tabela analyses
alter table public.analyses enable row level security;

-- Remove policies antigas se existirem (ignorando erro se não houver)
-- (Em Supabase CLI: adaptar conforme necessidade) 

create policy "analyses_select_owner" on public.analyses for select using ( auth.uid() = user_hash );
create policy "analyses_insert_owner" on public.analyses for insert with check ( auth.uid() = user_hash );
create policy "analyses_delete_owner" on public.analyses for delete using ( auth.uid() = user_hash );
