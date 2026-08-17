import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Meal, MealType } from '@/models';
import { mockMeals, nextMockId } from './mockStore';

/** Self-love food logging. */

export async function fetchMealsForDate(userId: string, date: string): Promise<Meal[]> {
  if (!isSupabaseConfigured) {
    return mockMeals
      .filter((m) => m.user_id === userId && m.date === date)
      .sort((a, b) => a.meal_time.localeCompare(b.meal_time));
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('meal_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Meal[];
}

export async function fetchMealById(mealId: string): Promise<Meal | null> {
  if (!isSupabaseConfigured) {
    return mockMeals.find((m) => m.id === mealId) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('id', mealId)
    .single();
  if (error || !data) return null;
  return data as Meal;
}

export async function fetchMealsCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return mockMeals.filter((m) => m.user_id === userId).length;
  const { count, error } = await getSupabase()
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface MealInput {
  meal_type: MealType;
  meal_name: string;
  calories?: number | null;
  image_url?: string | null;
  notes?: string | null;
  meal_time: string; // HH:mm
}

export async function createMeal(userId: string, date: string, input: MealInput): Promise<Meal> {
  if (!isSupabaseConfigured) {
    const meal: Meal = {
      id: nextMockId(),
      user_id: userId,
      date,
      ...input,
      created_at: new Date().toISOString(),
    };
    mockMeals.push(meal);
    return meal;
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .insert({ user_id: userId, date, ...input })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Meal;
}

export async function updateMeal(id: string, patch: Partial<MealInput>): Promise<void> {
  if (!isSupabaseConfigured) {
    const meal = mockMeals.find((m) => m.id === id);
    if (meal) Object.assign(meal, patch);
    return;
  }
  const { error } = await getSupabase().from('meals').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteMeal(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockMeals.findIndex((m) => m.id === id);
    if (idx >= 0) mockMeals.splice(idx, 1);
    return;
  }
  const { error } = await getSupabase().from('meals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
