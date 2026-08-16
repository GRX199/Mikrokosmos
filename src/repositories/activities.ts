import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Activity, ActivityType } from '@/models';
import { mockActivities, nextMockId } from './mockStore';

/** Activity feed — newest first, no spam (spec sections 10 + 41). */

export async function fetchActivities(limit = 30): Promise<Activity[]> {
  if (!isSupabaseConfigured) {
    return [...mockActivities]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await getSupabase()
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Activity[];
}

/**
 * Record an activity. `text` is pre-rendered ("Jessy added breakfast 🍓")
 * so the feed renders instantly without joins.
 */
export async function logActivity(
  userId: string,
  type: ActivityType,
  text: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockActivities.unshift({
      id: nextMockId(),
      user_id: userId,
      type,
      text,
      is_bot: false,
      created_at: new Date().toISOString(),
    });
    return;
  }
  await getSupabase().from('activities').insert({ user_id: userId, type, text });
}
