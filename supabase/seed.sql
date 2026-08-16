-- ============================================================
-- Mikrokosmos — DEVELOPMENT seed data
-- Run AFTER schema.sql and scripts/setup-users.mjs.
-- Clearly separated from production: delete rows here to reset.
-- ============================================================

-- ---------- Privacy settings ----------
insert into public.privacy_settings (user_id, weight_visibility, calories_visibility, meals_visibility)
values
  ((select id from public.profiles where username = 'namnamxyi'), 'only_me', 'friends', 'friends'),
  ((select id from public.profiles where username = 'kyraawr'),   'only_me', 'friends', 'friends'),
  ((select id from public.profiles where username = 'xcjessyx'),  'only_me', 'friends', 'friends')
on conflict (user_id) do nothing;

-- ---------- Goals ----------
insert into public.goals (user_id, calorie_goal, water_goal, step_goal)
values
  ((select id from public.profiles where username = 'namnamxyi'), 1600, 8, 8000),
  ((select id from public.profiles where username = 'kyraawr'),   1500, 8, 7000),
  ((select id from public.profiles where username = 'xcjessyx'),  1600, 8, 8000)
on conflict (user_id) do nothing;

-- ---------- Morning check-ins (last 3 days) ----------
insert into public.daily_checkins (user_id, date, wake_up_time, mood)
values
  ((select id from public.profiles where username = 'namnamxyi'), current_date,       '07:32', 'good'),
  ((select id from public.profiles where username = 'kyraawr'),   current_date,       '08:14', 'amazing'),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date,       '06:58', 'good'),
  ((select id from public.profiles where username = 'namnamxyi'), current_date - 1,   '07:55', 'okay'),
  ((select id from public.profiles where username = 'kyraawr'),   current_date - 1,   '08:02', 'good'),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date - 1,   '07:10', 'sleepy'),
  ((select id from public.profiles where username = 'namnamxyi'), current_date - 2,   '08:20', 'sleepy'),
  ((select id from public.profiles where username = 'kyraawr'),   current_date - 2,   '07:45', 'amazing'),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date - 2,   '06:40', 'good')
on conflict (user_id, date) do nothing;

-- ---------- Today's meals ----------
insert into public.meals (user_id, date, meal_type, meal_name, calories, meal_time, notes)
values
  ((select id from public.profiles where username = 'namnamxyi'), current_date, 'breakfast', 'Toast & Milk', 390, '08:21', 'cozy morning'),
  ((select id from public.profiles where username = 'namnamxyi'), current_date, 'lunch',     'Chicken Rice', 520, '13:12', null),
  ((select id from public.profiles where username = 'kyraawr'),   current_date, 'breakfast', 'Overnight Oats', 340, '07:50', 'with berries 🍓'),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date, 'breakfast', 'Smoothie Bowl', 310, '07:15', null),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date, 'snack',     'Fruit Platter', 150, '10:40', 'watermelon season');

-- ---------- Today's water & steps ----------
insert into public.water_logs (user_id, date, glasses)
values
  ((select id from public.profiles where username = 'namnamxyi'), current_date, 5),
  ((select id from public.profiles where username = 'kyraawr'),   current_date, 8),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date, 6)
on conflict (user_id, date) do update set glasses = excluded.glasses;

insert into public.step_logs (user_id, date, steps)
values
  ((select id from public.profiles where username = 'namnamxyi'), current_date, 6421),
  ((select id from public.profiles where username = 'kyraawr'),   current_date, 7230),
  ((select id from public.profiles where username = 'xcjessyx'),  current_date, 9102)
on conflict (user_id, date) do update set steps = excluded.steps;

-- ---------- Trends ----------
insert into public.trends (id, title, description, url, created_by, status, target_date)
values
  ('0a000000-0000-4000-8000-000000000001',
   'Picnic Day 🧺',
   'Matching outfits + park picnic + way too many photos.',
   'https://www.tiktok.com/tag/picnicaesthetic',
   (select id from public.profiles where username = 'xcjessyx'),
   'planned', current_date + 6),
  ('0a000000-0000-4000-8000-000000000002',
   'Viral Cloud Bread',
   'Try the 3-ingredient cloud bread from TikTok.',
   'https://www.youtube.com/results?search_query=cloud+bread',
   (select id from public.profiles where username = 'kyraawr'),
   'idea', null),
  ('0a000000-0000-4000-8000-000000000003',
   'Matching Photo Dump',
   'Same pose, three cities, one grid.',
   'https://www.instagram.com/explore/tags/photodump/',
   (select id from public.profiles where username = 'namnamxyi'),
   'done', current_date - 3)
on conflict (id) do nothing;

insert into public.trend_participants (trend_id, user_id)
select t.id, p.id
from public.trends t
cross join public.profiles p
where t.id in (
  '0a000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000002',
  '0a000000-0000-4000-8000-000000000003'
)
on conflict do nothing;

insert into public.trend_tasks (trend_id, title, completed, completed_by)
values
  ('0a000000-0000-4000-8000-000000000001', 'Choose location', true,
     (select id from public.profiles where username = 'namnamxyi')),
  ('0a000000-0000-4000-8000-000000000001', 'Choose outfits', true,
     (select id from public.profiles where username = 'xcjessyx')),
  ('0a000000-0000-4000-8000-000000000001', 'Buy snacks', false, null),
  ('0a000000-0000-4000-8000-000000000001', 'Take photos', false, null);

-- ---------- Chat ----------
insert into public.messages (sender_id, message, message_type, is_bot, created_at)
values
  (null, 'Welcome to Mikrokosmos 🌌 Your little universe is ready.', 'text', true, now() - interval '3 hours'),
  ((select id from public.profiles where username = 'namnamxyi'),
   'guys aku pengen makan seblak 😭', 'text', false, now() - interval '2 hours'),
  ((select id from public.profiles where username = 'xcjessyx'),
   'MAKAN AJA 😭', 'text', false, now() - interval '119 minutes'),
  ((select id from public.profiles where username = 'kyraawr'),
   'asal jangan satu panci 😭😭', 'text', false, now() - interval '118 minutes'),
  (null, 'BREAKING NEWS 🚨 Kyra hit her water goal. Hydration Queen behavior 👑', 'text', true, now() - interval '40 minutes');

-- ---------- Activity feed ----------
insert into public.activities (user_id, type, text, is_bot, created_at)
values
  ((select id from public.profiles where username = 'kyraawr'), 'water_goal',
   'Kyra completed today''s water goal 💧', false, now() - interval '40 minutes'),
  ((select id from public.profiles where username = 'xcjessyx'), 'meal',
   'Jessy added a snack 🍉', false, now() - interval '2 hours'),
  ((select id from public.profiles where username = 'namnamxyi'), 'checkin',
   'Namy started her day ☀️', false, now() - interval '3 hours'),
  ((select id from public.profiles where username = 'namnamxyi'), 'trend_done',
   'Namy completed the Matching Photo Dump trend ✨', false, now() - interval '1 day');
