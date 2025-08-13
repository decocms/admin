-- Cria bucket para snapshots das análises
insert into storage.buckets (id, name, public) values ('analysis_snapshots','analysis_snapshots', false)
  on conflict (id) do nothing;

-- Policies básicas (acessar apenas do próprio usuário via JWT)
create policy "snapshots_select" on storage.objects for select using ( auth.role() = 'authenticated' );
create policy "snapshots_insert" on storage.objects for insert with check ( auth.role() = 'authenticated' );
create policy "snapshots_delete" on storage.objects for delete using ( auth.role() = 'authenticated' );
