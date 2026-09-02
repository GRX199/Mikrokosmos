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
 * Subscribe to new activities (other members' doings) in realtime.
 * Returns an unsubscribe function. Mock mode: no-op (activities are
 * only ever created by the local user in mock mode).
 */
export function subscribeToActivities(onChange: (activity: Activity) => void): () => void {
  if (!isSupabaseConfigured) {
    return () => {}; // nothing to watch in mock mode
  }
  const channel = getSupabase()
    .channel('mikrokosmos-activities')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activities' },
      (payload) => onChange(payload.new as Activity)
    )
    .subscribe();
  return () => {
    getSupabase().removeChannel(channel);
  };
}

/**
 * Record an activity. `text` is pre-rendered ("Jessy added breakfast 🍓")
 * so the feed renders instantly without joins.
 * `referenceId` optionally links to a related record (e.g., meal_id).
 */
export async function logActivity(
  userId: string,
  type: ActivityType,
  text: string,
  referenceId?: string | null
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockActivities.unshift({
      id: nextMockId(),
      user_id: userId,
      type,
      text,
      reference_id: referenceId ?? null,
      is_bot: false,
      created_at: new Date().toISOString(),
    });
    return;
  }
  await getSupabase().from('activities').insert({ 
    user_id: userId, 
    type, 
    text,
    reference_id: referenceId ?? null 
  });
}
