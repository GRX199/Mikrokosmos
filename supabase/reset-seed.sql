-- ============================================================
-- Mikrokosmos — remove DEV seed data (run in Supabase SQL Editor).
--
-- Targets only the rows inserted by supabase/seed.sql.
-- Keeps: profiles, goals, privacy_settings, and anything you
-- created after seeding (your own chats, meals, check-ins, etc.).
-- ============================================================

-- Seed trends (participant & task rows cascade automatically).
delete from public.trends where id in (
  '0a000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000002',
  '0a000000-0000-4000-8000-000000000003'
);

-- Seed meals (exact names from seed.sql, last 3 days).
delete from public.meals
where meal_name in ('Toast & Milk', 'Chicken Rice', 'Overnight Oats', 'Smoothie Bowl', 'Fruit Platter')
  and date >= current_date - 3;

-- Seed check-ins (exact wake_up_time + mood combos from seed.sql).
delete from public.daily_checkins
where date >= current_date - 3
  and (wake_up_time, mood) in (
    ('07:32'::time, 'good'),
    ('08:14'::time, 'amazing'),
    ('06:58'::time, 'good'),
    ('07:55'::time, 'okay'),
    ('08:02'::time, 'good'),
    ('07:10'::time, 'sleepy'),
    ('08:20'::time, 'sleepy'),
    ('07:45'::time, 'amazing'),
    ('06:40'::time, 'good')
  );

-- Seed water & step logs (seed overwrote whatever was there via ON CONFLICT DO UPDATE).
delete from public.water_logs where date >= current_date - 3 and glasses in (5, 8, 6);
delete from public.step_logs  where date >= current_date - 3 and steps in (6421, 7230, 9102);

-- Seed chat messages (exact text from seed.sql).
delete from public.messages
where message in (
  'Welcome to Mikrokosmos 🌌 Your little universe is ready.',
  'guys aku pengen makan seblak 😭',
  'MAKAN AJA 😭',
  'asal jangan satu panci 😭😭',
  'BREAKING NEWS 🚨 Kyra hit her water goal. Hydration Queen behavior 👑'
);

-- Seed activity feed entries (exact text from seed.sql).
delete from public.activities
where text in (
  'Kyra completed today''s water goal 💧',
  'Jessy added a snack 🍉',
  'Namy started her day ☀️',
  'Namy completed the Matching Photo Dump trend ✨'
);
