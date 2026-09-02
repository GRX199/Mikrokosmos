-- Fan Q&A — a shared board: fans ask, ALL members answer on the same page.
-- Replaces the old per-member fan_mails (personal letters).

drop table if exists public.fan_mails;

create table if not exists public.fan_questions (
  id uuid primary key default gen_random_uuid(),
  fan_name text not null,
  fan_emoji text not null default '💌',
  question text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fan_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.fan_questions(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null,
  reaction text check (reaction in ('love','cry','hype')),
  reaction_at timestamptz,
  created_at timestamptz not null default now(),
  unique (question_id, member_id)
);

alter table public.fan_questions enable row level security;
alter table public.fan_answers enable row level security;

-- Every member can read the whole board. Fans have no accounts, so a
-- logged-in member posts the bot-generated fan question on the fan's behalf.
create policy "members read fan questions"
  on public.fan_questions for select
  to authenticated
  using (true);

create policy "members post fan questions"
  on public.fan_questions for insert
  to authenticated
  with check (true);

create policy "members read fan answers"
  on public.fan_answers for select
  to authenticated
  using (true);

-- A member only ever answers or edits as herself.
create policy "member answers as herself"
  on public.fan_answers for insert
  to authenticated
  with check (auth.uid() = member_id);

create policy "member edits her own answer"
  on public.fan_answers for update
  to authenticated
  using (auth.uid() = member_id);

-- Realtime: everyone sees new questions and answers the moment they land.
do $$
begin
  alter publication supabase_realtime add table public.fan_questions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.fan_answers;
exception when duplicate_object then null;
end $$;
