import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { DailyCheckin, Mood } from '@/models';
import { mockCheckins, nextMockId } from './mockStore';

/** Morning check-ins (one per member per day). */

export async function fetchCheckin(userId: string, date: string): Promise<DailyCheckin | null> {
  if (!isSupabaseConfigured) {
    return mockCheckins.find((c) => c.user_id === userId && c.date === date) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DailyCheckin) ?? null;
}

export async function fetchCheckinsForDate(date: string): Promise<DailyCheckin[]> {
  if (!isSupabaseConfigured) return mockCheckins.filter((c) => c.date === date);
  const { data, error } = await getSupabase()
    .from('daily_checkins')
    .select('*')
    .eq('date', date);
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyCheckin[];
}

export async function fetchUserCheckins(userId: string, days = 60): Promise<DailyCheckin[]> {
  if (!isSupabaseConfigured) return mockCheckins.filter((c) => c.user_id === userId);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = since.toISOString().slice(0, 10);
  const { data, error } = await getSupabase()
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceKey)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyCheckin[];
}

export interface CheckinInput {
  wake_up_time: string; // HH:mm
  mood: Mood;
}

export async function createCheckin(
  userId: string,
  date: string,
  input: CheckinInput
): Promise<DailyCheckin> {
  if (!isSupabaseConfigured) {
    const checkin: DailyCheckin = {
      id: nextMockId(),
      user_id: userId,
      date,
      wake_up_time: input.wake_up_time,
      mood: input.mood,
      created_at: new Date().toISOString(),
    };
    mockCheckins.push(checkin);
    return checkin;
  }
  const { data, error } = await getSupabase()
    .from('daily_checkins')
    .insert({ user_id: userId, date, wake_up_time: input.wake_up_time, mood: input.mood })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DailyCheckin;
}
