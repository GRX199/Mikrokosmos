-- Fan Mail — bot fans write letters (questions) to a member, she replies.
-- Phase 3: gives each member a personal "talking with fans" experience.

create table if not exists public.fan_mails (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  fan_name text not null,
  fan_emoji text not null default '💌',
  question text not null,
  reply text,
  reply_reaction text check (reply_reaction in ('love','cry','hype')),
  reply_reaction_at timestamptz,
  reply_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.fan_mails enable row level security;

-- The member can read and answer her own mail; other members stay out
-- (each girl gets her own fan letters — no peeking 😌).
create policy "member reads own mail"
  on public.fan_mails for select
  using (auth.uid() = member_id);

create policy "member replies own mail"
  on public.fan_mails for update
  using (auth.uid() = member_id);

-- App service role inserts the fan questions (no anon access).
grant select, update on public.fan_mails to authenticated;
