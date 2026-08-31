import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { BodyMetrics } from '@/models';
import { mockBodyMetrics } from './mockStore';

/**
 * Body metrics — strictly private to each member (RLS: owner-only).
 * Powers the smart calorie target on the Self Love screen.
 */

export async function fetchBodyMetrics(userId: string): Promise<BodyMetrics | null> {
  if (!isSupabaseConfigured) {
    return mockBodyMetrics[userId] ?? null;
  }
  const { data, error } = await getSupabase()
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BodyMetrics) ?? null;
}

export async function upsertBodyMetrics(
  userId: string,
  patch: Partial<Omit<BodyMetrics, 'user_id'>>
): Promise<BodyMetrics> {
  if (!isSupabaseConfigured) {
    const existing: BodyMetrics =
      mockBodyMetrics[userId] ?? {
        user_id: userId,
        sex: 'female',
        activity_level: 'light',
        goal: 'maintain',
      };
    const next = { ...existing, ...patch };
    mockBodyMetrics[userId] = next;
    return next;
  }
  const { data, error } = await getSupabase()
    .from('body_metrics')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BodyMetrics;
}
