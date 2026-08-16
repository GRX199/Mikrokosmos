-- ============================================================
-- Mikrokosmos — Supabase schema (Phase 1)
-- Run this file in the Supabase SQL Editor.
-- A little universe shared by three best friends.
-- ============================================================

-- Members live in `profiles`, keyed to Supabase Auth users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  emoji text not null default '✨',
  theme text not null default 'lilac',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Morning check-in: one per user per day.
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  wake_up_time time,
  mood text not null default 'okay',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Meals (self-love food logging; calories are always optional/positive).
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_name text not null,
  calories integer,
  image_url text,
  notes text,
  meal_time time not null default '12:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One water row per user per day.
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  glasses integer not null default 0 check (glasses >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- One step row per user per day (manual entry for MVP).
create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  steps integer not null default 0 check (steps >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Goals the performance score is computed against.
create table if not exists public.goals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  calorie_goal integer not null default 1600,
  water_goal integer not null default 8,
  step_goal integer not null default 8000
);

-- Group chat. Bot messages (Miko) use sender_id = null + is_bot.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles (id) on delete set null,
  message text not null default '',
  message_type text not null default 'text' check (message_type in ('text', 'image')),
  media_url text,
  reply_to uuid references public.messages (id) on delete set null,
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at);

-- Emoji reactions on chat messages.
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

-- Shared trends the friends want to try together.
create table if not exists public.trends (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text,
  created_by uuid references public.profiles (id) on delete set null,
  status text not null default 'idea' check (status in ('idea', 'planned', 'doing', 'done')),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trend_participants (
  trend_id uuid not null references public.trends (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (trend_id, user_id)
);

-- Shared checklist inside a trend; everyone can tick items.
create table if not exists public.trend_tasks (
  id uuid primary key default gen_random_uuid(),
  trend_id uuid not null references public.trends (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Activity feed entries ("Jessy added breakfast 🍓").
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  text text not null,
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists activities_created_at_idx on public.activities (created_at desc);

-- Per-user sharing preferences (Only Me / Friends).
create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weight_visibility text not null default 'only_me' check (weight_visibility in ('only_me', 'friends')),
  calories_visibility text not null default 'friends' check (calories_visibility in ('only_me', 'friends')),
  meals_visibility text not null default 'friends' check (meals_visibility in ('only_me', 'friends')),
  updated_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index if not exists daily_checkins_date_idx on public.daily_checkins (date);
create index if not exists meals_user_date_idx on public.meals (user_id, date);
create index if not exists trends_status_idx on public.trends (status);
create index if not exists trend_tasks_trend_idx on public.trend_tasks (trend_id);

-- ---------- Privileges ----------
-- Fresh projects lock tables down: RLS alone is not enough, the
-- authenticated/anon roles also need explicit grants. (RLS policies below
-- still decide WHO sees WHAT; grants only say the API may touch the tables.)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.daily_checkins,
  public.meals,
  public.water_logs,
  public.step_logs,
  public.goals,
  public.messages,
  public.message_reactions,
  public.trends,
  public.trend_participants,
  public.trend_tasks,
  public.activities,
  public.privacy_settings
to authenticated;
grant default privileges in schema public to authenticated;

-- ---------- Row Level Security ----------
-- The universe is private: only authenticated Mikrokosmos members can
-- read/write app data. Signup is closed, so `authenticated` stays 3 people.
alter table public.profiles enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.meals enable row level security;
alter table public.water_logs enable row level security;
alter table public.step_logs enable row level security;
alter table public.goals enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.trends enable row level security;
alter table public.trend_participants enable row level security;
alter table public.trend_tasks enable row level security;
alter table public.activities enable row level security;
alter table public.privacy_settings enable row level security;

-- Members can see each other (needed for friend cards / profiles).
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles
  for select to authenticated using (true);
drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "members insert own profile" on public.profiles;
create policy "members insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Check-ins: readable by the group (mood/wake-up are shareable by default),
-- writable only by the owner.
drop policy if exists "members read checkins" on public.daily_checkins;
create policy "members read checkins" on public.daily_checkins
  for select to authenticated using (true);
drop policy if exists "members manage own checkins" on public.daily_checkins;
create policy "members manage own checkins" on public.daily_checkins
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meals: friends see them only when the owner's meals_visibility = 'friends'.
drop policy if exists "members read meals respecting privacy" on public.meals;
create policy "members read meals respecting privacy" on public.meals
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.privacy_settings p
      where p.user_id = meals.user_id and p.meals_visibility = 'friends'
    )
  );
drop policy if exists "members manage own meals" on public.meals;
create policy "members manage own meals" on public.meals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Water / steps / goals: group-readable (used for progress %), owner-writable.
drop policy if exists "members read water" on public.water_logs;
create policy "members read water" on public.water_logs
  for select to authenticated using (true);
drop policy if exists "members manage own water" on public.water_logs;
create policy "members manage own water" on public.water_logs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "members read steps" on public.step_logs;
create policy "members read steps" on public.step_logs
  for select to authenticated using (true);
drop policy if exists "members manage own steps" on public.step_logs;
create policy "members manage own steps" on public.step_logs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "members read goals" on public.goals;
create policy "members read goals" on public.goals
  for select to authenticated using (true);
drop policy if exists "members manage own goals" on public.goals;
create policy "members manage own goals" on public.goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat: everyone in the universe can read and post.
drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (true);
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated
  -- Members send as themselves; Miko messages (is_bot, sender_id null) ride
  -- along on the triggering member's token.
  with check (auth.uid() = sender_id or (sender_id is null and is_bot));
drop policy if exists "members edit own messages" on public.messages;
create policy "members edit own messages" on public.messages
  for update to authenticated using (auth.uid() = sender_id);
drop policy if exists "members delete own messages" on public.messages;
create policy "members delete own messages" on public.messages
  for delete to authenticated using (auth.uid() = sender_id);

drop policy if exists "members read reactions" on public.message_reactions;
create policy "members read reactions" on public.message_reactions
  for select to authenticated using (true);
drop policy if exists "members manage own reactions" on public.message_reactions;
create policy "members manage own reactions" on public.message_reactions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trends: shared space — everyone reads, everyone contributes.
drop policy if exists "members read trends" on public.trends;
create policy "members read trends" on public.trends
  for select to authenticated using (true);
drop policy if exists "members insert trends" on public.trends;
create policy "members insert trends" on public.trends
  for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "members update trends" on public.trends;
create policy "members update trends" on public.trends
  for update to authenticated using (true);
drop policy if exists "members delete trends" on public.trends;
create policy "members delete trends" on public.trends
  for delete to authenticated using (auth.uid() = created_by);

drop policy if exists "members read trend participants" on public.trend_participants;
create policy "members read trend participants" on public.trend_participants
  for select to authenticated using (true);
drop policy if exists "members manage trend participants" on public.trend_participants;
create policy "members manage trend participants" on public.trend_participants
  for all to authenticated using (true) with check (true);

drop policy if exists "members read trend tasks" on public.trend_tasks;
create policy "members read trend tasks" on public.trend_tasks
  for select to authenticated using (true);
drop policy if exists "members insert trend tasks" on public.trend_tasks;
create policy "members insert trend tasks" on public.trend_tasks
  for insert to authenticated with check (true);
drop policy if exists "members update trend tasks" on public.trend_tasks;
create policy "members update trend tasks" on public.trend_tasks
  for update to authenticated using (true);
drop policy if exists "members delete trend tasks" on public.trend_tasks;
create policy "members delete trend tasks" on public.trend_tasks
  for delete to authenticated using (true);

-- Activity feed: group-readable, only own (or Miko-free) entries inserted.
drop policy if exists "members read activities" on public.activities;
create policy "members read activities" on public.activities
  for select to authenticated using (true);
drop policy if exists "members insert activities" on public.activities;
create policy "members insert activities" on public.activities
  for insert to authenticated with check (auth.uid() = user_id or user_id is null);

-- Privacy settings: readable by the group (client-side gating), owner-writable.
drop policy if exists "members read privacy settings" on public.privacy_settings;
create policy "members read privacy settings" on public.privacy_settings
  for select to authenticated using (true);
drop policy if exists "members manage own privacy settings" on public.privacy_settings;
create policy "members manage own privacy settings" on public.privacy_settings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Realtime ----------
-- Chat + shared checklists sync live.
-- Idempotent adds (re-running this file would otherwise error).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then alter publication supabase_realtime add table public.messages; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then alter publication supabase_realtime add table public.message_reactions; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trend_tasks'
  ) then alter publication supabase_realtime add table public.trend_tasks; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trends'
  ) then alter publication supabase_realtime add table public.trends; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activities'
  ) then alter publication supabase_realtime add table public.activities; end if;
end $$;

-- ---------- Storage ----------
-- Private bucket for meal photos and chat images.
insert into storage.buckets (id, name, public)
values ('mikrokosmos-media', 'mikrokosmos-media', false)
on conflict (id) do nothing;

drop policy if exists "members list media" on storage.objects;
create policy "members list media" on storage.objects
  for select to authenticated
  using (bucket_id = 'mikrokosmos-media');
drop policy if exists "members upload media" on storage.objects;
create policy "members upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mikrokosmos-media');
drop policy if exists "members delete own media" on storage.objects;
create policy "members delete own media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mikrokosmos-media' and owner = auth.uid());

-- ---------- Triggers ----------
-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists meals_touch on public.meals;
create trigger meals_touch before update on public.meals
  for each row execute function public.touch_updated_at();
drop trigger if exists trends_touch on public.trends;
create trigger trends_touch before update on public.trends
  for each row execute function public.touch_updated_at();
