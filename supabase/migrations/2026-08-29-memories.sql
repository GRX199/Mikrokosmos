-- ============================================================
-- Mikrokosmos — Phase 2: Memories
-- Run this file in the Supabase SQL Editor (after schema.sql).
-- Shared scrapbook moments saved by the trio.
-- ============================================================

-- Shared memory entries (trend completions, saved moments).
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text not null default '',
  image_url text,
  trend_id uuid references public.trends (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists memories_created_at_idx on public.memories (created_at desc);

-- Grants (fresh projects lock tables down; RLS still decides who sees what).
grant select, insert, update, delete on public.memories to authenticated;

-- RLS: the scrapbook is shared — everyone in the universe can read it;
-- entries are created/edited by their author.
alter table public.memories enable row level security;

drop policy if exists "members read memories" on public.memories;
create policy "members read memories" on public.memories
  for select to authenticated using (true);

drop policy if exists "members insert memories" on public.memories;
create policy "members insert memories" on public.memories
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "members update own memories" on public.memories;
create policy "members update own memories" on public.memories
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "members delete own memories" on public.memories;
create policy "members delete own memories" on public.memories
  for delete to authenticated using (auth.uid() = created_by);

-- Realtime: memories sync live across the three friends.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memories'
  ) then alter publication supabase_realtime add table public.memories; end if;
end $$;
