-- Meal component breakdown from photo/name analysis (Phase: calorie details).
-- Stores the per-component estimate (e.g. Rice 210, Chicken 240) so history
-- and Recent Activity can show the full picture, not just the total.

alter table public.meals
  add column if not exists components jsonb;

comment on column public.meals.components is
  'Per-component calorie breakdown from AI analysis: [{name, calories}]';
