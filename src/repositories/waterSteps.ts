import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import { mockSteps, mockWater } from './mockStore';

/** Water + step logs: one row per member per day, upserted in place. */

export async function fetchWater(userId: string, date: string): Promise<number> {
  if (!isSupabaseConfigured) return mockWater[`${userId}:${date}`] ?? 0;
  const { data, error } = await getSupabase()
    .from('water_logs')
    .select('glasses')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.glasses ?? 0;
}

export async function setWater(userId: string, date: string, glasses: number): Promise<number> {
  const safe = Math.max(0, Math.round(glasses));
  if (!isSupabaseConfigured) {
    mockWater[`${userId}:${date}`] = safe;
    return safe;
  }
  const { error } = await getSupabase()
    .from('water_logs')
    .upsert({ user_id: userId, date, glasses: safe }, { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
  return safe;
}

export async function fetchSteps(userId: string, date: string): Promise<number> {
  if (!isSupabaseConfigured) return mockSteps[`${userId}:${date}`] ?? 0;
  const { data, error } = await getSupabase()
    .from('step_logs')
    .select('steps')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.steps ?? 0;
}

export async function setSteps(userId: string, date: string, steps: number): Promise<number> {
  const safe = Math.max(0, Math.round(steps));
  if (!isSupabaseConfigured) {
    mockSteps[`${userId}:${date}`] = safe;
    return safe;
  }
  const { error } = await getSupabase()
    .from('step_logs')
    .upsert({ user_id: userId, date, steps: safe }, { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
  return safe;
}

/** Everyone's water/steps for one date — powers group progress + friend cards. */
export async function fetchDayStats(
  date: string
): Promise<{ water: Record<string, number>; steps: Record<string, number> }> {
  if (!isSupabaseConfigured) {
    const water: Record<string, number> = {};
    const steps: Record<string, number> = {};
    for (const [key, value] of Object.entries(mockWater)) {
      if (key.endsWith(`:${date}`)) water[key.split(':')[0]] = value;
    }
    for (const [key, value] of Object.entries(mockSteps)) {
      if (key.endsWith(`:${date}`)) steps[key.split(':')[0]] = value;
    }
    return { water, steps };
  }
  const [waterRes, stepsRes] = await Promise.all([
    getSupabase().from('water_logs').select('user_id,glasses').eq('date', date),
    getSupabase().from('step_logs').select('user_id,steps').eq('date', date),
  ]);
  if (waterRes.error) throw new Error(waterRes.error.message);
  if (stepsRes.error) throw new Error(stepsRes.error.message);
  const water: Record<string, number> = {};
  const steps: Record<string, number> = {};
  for (const row of waterRes.data ?? []) water[row.user_id] = row.glasses;
  for (const row of stepsRes.data ?? []) steps[row.user_id] = row.steps;
  return { water, steps };
}
