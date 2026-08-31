import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Activity, DailyCheckin, Meal } from '@/models';
import {
  mockActivities,
  mockCheckins,
  mockMeals,
  mockSteps,
  mockWater,
} from './mockStore';

/**
 * Activity history per day — powers the calendar screen (Phase 2).
 * One row per member per day per metric, all fetched in one sweep for
 * a date range so the calendar can render a month at a time.
 */

export interface DayHistory {
  date: string;
  checkins: Record<string, DailyCheckin>; // userId -> checkin
  meals: Record<string, Meal[]>; // userId -> meals
  water: Record<string, number>; // userId -> glasses
  steps: Record<string, number>; // userId -> steps
  activityCount: number; // total activities logged that day
}

export interface HistoryRange {
  days: DayHistory[]; // ordered oldest -> newest
  activitiesByDay: Record<string, Activity[]>; // dateKey -> activities
}

/** Fetch everything for one month-window (default: the visible month). */
export async function fetchHistoryRange(
  fromDate: string,
  toDate: string
): Promise<HistoryRange> {
  if (!isSupabaseConfigured) {
    return mockHistory(fromDate, toDate);
  }
  const supabase = getSupabase();
  const [checkinsRes, mealsRes, waterRes, stepsRes, activitiesRes] = await Promise.all([
    supabase.from('daily_checkins').select('*').gte('date', fromDate).lte('date', toDate),
    supabase.from('meals').select('*').gte('date', fromDate).lte('date', toDate),
    supabase.from('water_logs').select('user_id,date,glasses').gte('date', fromDate).lte('date', toDate),
    supabase.from('step_logs').select('user_id,date,steps').gte('date', fromDate).lte('date', toDate),
    supabase
      .from('activities')
      .select('*')
      .gte('created_at', `${fromDate}T00:00:00`)
      .lte('created_at', `${toDate}T23:59:59.999`),
  ]);
  const firstError =
    checkinsRes.error ??
    mealsRes.error ??
    waterRes.error ??
    stepsRes.error ??
    activitiesRes.error;
  if (firstError) throw new Error(firstError.message);

  return buildRange({
    checkins: (checkinsRes.data ?? []) as DailyCheckin[],
    meals: (mealsRes.data ?? []) as Meal[],
    water: (waterRes.data ?? []) as { user_id: string; date: string; glasses: number }[],
    steps: (stepsRes.data ?? []) as { user_id: string; date: string; steps: number }[],
    activities: (activitiesRes.data ?? []) as Activity[],
    fromDate,
    toDate,
  });
}

// ---------- shared builder ----------

interface RangeInput {
  checkins: DailyCheckin[];
  meals: Meal[];
  water: { user_id: string; date: string; glasses: number }[];
  steps: { user_id: string; date: string; steps: number }[];
  activities: Activity[];
  fromDate: string;
  toDate: string;
}

function localDateKey(iso: string): string {
  // Postgres timestamptz -> local YYYY-MM-DD
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function buildRange(input: RangeInput): HistoryRange {
  const dayMap = new Map<string, DayHistory>();
  const ensure = (date: string): DayHistory => {
    let day = dayMap.get(date);
    if (!day) {
      day = { date, checkins: {}, meals: {}, water: {}, steps: {}, activityCount: 0 };
      dayMap.set(date, day);
    }
    return day;
  };

  for (const c of input.checkins) ensure(c.date).checkins[c.user_id] = c;
  for (const m of input.meals) (ensure(m.date).meals[m.user_id] ??= []).push(m);
  for (const w of input.water) ensure(w.date).water[w.user_id] = w.glasses;
  for (const s of input.steps) ensure(s.date).steps[s.user_id] = s.steps;

  const activitiesByDay: Record<string, Activity[]> = {};
  for (const a of input.activities) {
    const key = localDateKey(a.created_at);
    (activitiesByDay[key] ??= []).push(a);
    ensure(key).activityCount += 1;
  }

  // Ordered list oldest -> newest for every date in the window.
  const days: DayHistory[] = [];
  const cursor = new Date(`${input.fromDate}T00:00:00`);
  const end = new Date(`${input.toDate}T00:00:00`);
  const keyOf = (d: Date) => {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };
  while (cursor <= end) {
    const key = keyOf(cursor);
    days.push(
      dayMap.get(key) ?? { date: key, checkins: {}, meals: {}, water: {}, steps: {}, activityCount: 0 }
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return { days, activitiesByDay };
}

// ---------- mock mode ----------

function mockHistory(fromDate: string, toDate: string): HistoryRange {
  const checkins = mockCheckins.filter((c) => c.date >= fromDate && c.date <= toDate);
  const meals = mockMeals.filter((m) => m.date >= fromDate && m.date <= toDate);
  const water: { user_id: string; date: string; glasses: number }[] = [];
  for (const [key, glasses] of Object.entries(mockWater)) {
    const [uid, date] = key.split(':');
    if (date >= fromDate && date <= toDate) water.push({ user_id: uid, date, glasses });
  }
  const steps: { user_id: string; date: string; steps: number }[] = [];
  for (const [key, stepCount] of Object.entries(mockSteps)) {
    const [uid, date] = key.split(':');
    if (date >= fromDate && date <= toDate) steps.push({ user_id: uid, date, steps: stepCount });
  }
  const activities = mockActivities.filter(
    (a) =>
      localDateKey(a.created_at) >= fromDate && localDateKey(a.created_at) <= toDate
  );

  return buildRange({ checkins, meals, water, steps, activities, fromDate, toDate });
}
