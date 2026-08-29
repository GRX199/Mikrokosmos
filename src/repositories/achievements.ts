import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import { todayKey } from '@/core/utils/date';
import type { DailyCheckin, Goals, Meal } from '@/models';
import type { AchievementStats } from '@/services/achievements';
import { computeStreak } from '@/services/streak';
import { computePerformance } from '@/services/performance';
import {
  mockCheckins,
  mockMeals,
  mockMemories,
  mockMessages,
  mockSteps,
  mockTrends,
  mockWater,
} from './mockStore';
import { fetchCompletedTrendsCount } from './trends';
import { fetchGoals } from './profiles';

/**
 * Achievement stats aggregation — pulls everything the badge evaluator
 * needs in parallel. Dual-mode like every repository.
 * Window: last 60 days (enough for the 30-day streak badge).
 */

const WINDOW_DAYS = 60;

export async function fetchAchievementStats(userId: string): Promise<AchievementStats> {
  const since = todayKey(-WINDOW_DAYS);

  if (!isSupabaseConfigured) {
    return mockStats(userId, since);
  }

  const goals = await fetchGoals(userId);
  const supabase = getSupabase();
  const [
    checkinsRes,
    mealsRes,
    mealsCountRes,
    photoMealsRes,
    trendsCreatedRes,
    trendsDone,
    memoriesRes,
    waterRes,
    stepRes,
    mikoRes,
  ] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).gte('date', since),
    supabase.from('meals').select('*').eq('user_id', userId).gte('date', since),
    supabase.from('meals').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('image_url', 'is', null),
    supabase.from('trends').select('*', { count: 'exact', head: true }).eq('created_by', userId),
    fetchCompletedTrendsCount(userId),
    supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId),
    supabase.from('water_logs').select('date,glasses').eq('user_id', userId).gte('date', since),
    supabase.from('step_logs').select('date,steps').eq('user_id', userId).gte('date', since),
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .ilike('message', '%miko%'),
  ]);

  const firstError =
    checkinsRes.error ??
    mealsRes.error ??
    mealsCountRes.error ??
    photoMealsRes.error ??
    trendsCreatedRes.error ??
    memoriesRes.error ??
    waterRes.error ??
    stepRes.error ??
    mikoRes.error;
  if (firstError) throw new Error(firstError.message);

  return buildStats({
    goals,
    checkins: (checkinsRes.data ?? []) as DailyCheckin[],
    meals: (mealsRes.data ?? []) as Meal[],
    mealsLogged: mealsCountRes.count ?? 0,
    photoMeals: photoMealsRes.count ?? 0,
    trendsCreated: trendsCreatedRes.count ?? 0,
    trendsDone,
    memoriesSaved: memoriesRes.count ?? 0,
    water: (waterRes.data ?? []) as { date: string; glasses: number }[],
    steps: (stepRes.data ?? []) as { date: string; steps: number }[],
    mikoChats: mikoRes.count ?? 0,
  });
}

// ---------- shared evaluation ----------

interface StatsInput {
  goals: Goals;
  checkins: DailyCheckin[];
  meals: Meal[];
  mealsLogged: number;
  photoMeals: number;
  trendsCreated: number;
  trendsDone: number;
  memoriesSaved: number;
  water: { date: string; glasses: number }[];
  steps: { date: string; steps: number }[];
  mikoChats: number;
}

function buildStats(input: StatsInput): AchievementStats {
  const { goals, checkins, meals } = input;

  const checkinByDate = new Map(checkins.map((c) => [c.date, c]));
  const waterByDate = new Map(input.water.map((w) => [w.date, w.glasses]));
  const stepByDate = new Map(input.steps.map((s) => [s.date, s.steps]));
  const mealsByDate = new Map<string, Meal[]>();
  for (const meal of meals) {
    const list = mealsByDate.get(meal.date);
    if (list) list.push(meal);
    else mealsByDate.set(meal.date, [meal]);
  }

  const waterGoalDays = input.water.filter((w) => w.glasses >= goals.water_goal).length;
  const stepGoalDays = input.steps.filter((s) => s.steps >= goals.step_goal).length;

  // Cosmic day = performance 100 on a day that had any activity at all.
  let cosmicDays = 0;
  const daySet = new Set<string>([
    ...checkins.map((c) => c.date),
    ...input.water.map((w) => w.date),
    ...input.steps.map((s) => s.date),
    ...mealsByDate.keys(),
  ]);
  for (const date of daySet) {
    const score = computePerformance({
      checkin: checkinByDate.get(date) ?? null,
      meals: mealsByDate.get(date) ?? [],
      glasses: waterByDate.get(date) ?? 0,
      steps: stepByDate.get(date) ?? 0,
      goals,
    });
    if (score >= 100) cosmicDays += 1;
  }

  return {
    streak: computeStreak(checkins),
    checkinDays: new Set(checkins.map((c) => c.date)).size,
    mealsLogged: input.mealsLogged,
    photoMeals: input.photoMeals,
    trendsCreated: input.trendsCreated,
    trendsDone: input.trendsDone,
    memoriesSaved: input.memoriesSaved,
    waterGoalDays,
    stepGoalDays,
    cosmicDays,
    mikoChats: input.mikoChats,
  };
}

// ---------- mock mode ----------

function mockStats(userId: string, since: string): AchievementStats {
  const goals = mockGoalsFor(userId);
  const checkins = mockCheckins.filter((c) => c.user_id === userId && c.date >= since);
  const meals = mockMeals.filter((m) => m.user_id === userId && m.date >= since);

  const water: { date: string; glasses: number }[] = [];
  for (const [key, glasses] of Object.entries(mockWater)) {
    const [uid, date] = key.split(':');
    if (uid === userId && date >= since) water.push({ date, glasses });
  }
  const steps: { date: string; steps: number }[] = [];
  for (const [key, stepCount] of Object.entries(mockSteps)) {
    const [uid, date] = key.split(':');
    if (uid === userId && date >= since) steps.push({ date, steps: stepCount });
  }

  return buildStats({
    goals,
    checkins,
    meals,
    mealsLogged: mockMeals.filter((m) => m.user_id === userId).length,
    photoMeals: mockMeals.filter((m) => m.user_id === userId && m.image_url).length,
    trendsCreated: mockTrends.filter((t) => t.created_by === userId).length,
    trendsDone: mockTrends.filter((t) => t.status === 'done').length,
    memoriesSaved: mockMemories.filter((m) => m.created_by === userId).length,
    water,
    steps,
    mikoChats: mockMessages.filter(
      (m) => m.sender_id === userId && m.message.toLowerCase().includes('miko')
    ).length,
  });
}

/** Mock goals mirror the seeded defaults per member. */
function mockGoalsFor(userId: string): Goals {
  return (
    {
      user_id: userId,
      calorie_goal: 1600,
      water_goal: 8,
      step_goal: 8000,
    } satisfies Goals
  );
}
