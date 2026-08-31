-- ============================================================
-- Mikrokosmos — Phase 2: Body metrics (smart calorie targets)
-- Run this file in the Supabase SQL Editor (after schema.sql).
-- One row per user: height, weight, age, sex, activity level,
-- and a goal (maintain / lose 0.25 / 0.5 / 0.75 kg per week).
-- The app derives BMI, BMR, TDEE and a gentle deficit target.
-- ============================================================

create table if not exists public.body_metrics (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  weight_kg numeric(5,1) check (weight_kg between 25 and 300),
  age integer check (age between 10 and 100),
  sex text not null default 'female' check (sex in ('female', 'male')),
  activity_level text not null default 'light' check (activity_level in (
    'sedentary', 'light', 'moderate', 'active', 'very_active'
  )),
  -- maintain | lose_025 | lose_05 | lose_075 (kg per week)
  goal text not null default 'maintain' check (goal in (
    'maintain', 'lose_025', 'lose_05', 'lose_075'
  )),
  updated_at timestamptz not null default now()
);

-- Private by default: only the owner reads and writes her own row.
-- (The app shows body data only to its owner; the group sees at most
-- a "on a journey ✨" vibe, never numbers.)
drop policy if exists "owner reads body metrics" on public.body_metrics;
create policy "owner reads body metrics" on public.body_metrics
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "owner writes body metrics" on public.body_metrics;
create policy "owner writes body metrics" on public.body_metrics
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.body_metrics to authenticated;
