import { useCallback, useEffect, useState } from 'react';

import { todayKey } from '@/core/utils/date';
import type {
  Activity,
  DailyCheckin,
  Goals,
  Meal,
  PrivacySettings,
  Profile,
} from '@/models';
import { logActivity, fetchActivities } from '@/repositories/activities';
import { fetchCheckinsForDate, fetchUserCheckins } from '@/repositories/checkins';
import { fetchMealsForDate } from '@/repositories/meals';
import { fetchAllGoals, fetchAllPrivacy, fetchProfiles } from '@/repositories/profiles';
import { fetchDayStats } from '@/repositories/waterSteps';
import { computePerformance } from '@/services/performance';
import { computeStreak } from '@/services/streak';

/**
 * useHomeData — everything the Home dashboard needs for today,
 * loaded together so the screen renders in one sweep.
 */

export interface HomeData {
  profiles: Profile[];
  checkins: Record<string, DailyCheckin>;
  dayStats: { water: Record<string, number>; steps: Record<string, number> };
  goals: Record<string, Goals>;
  privacy: Record<string, PrivacySettings>;
  mealsByUser: Record<string, Meal[]>;
  activities: Activity[];
  myStreak: number;
}

export function useHomeData(myUserId?: string) {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!myUserId) return;
    setError(null);
    try {
      const date = todayKey();
      const [profiles, checkins, dayStats, goals, privacy, activities, myCheckins] =
        await Promise.all([
          fetchProfiles(),
          fetchCheckinsForDate(date),
          fetchDayStats(date),
          fetchAllGoals(),
          fetchAllPrivacy(),
          fetchActivities(20),
          fetchUserCheckins(myUserId),
        ]);

      // Meals are privacy-filtered by RLS already; fetch whatever is visible.
      const mealsByUser: Record<string, Meal[]> = {};
      await Promise.all(
        profiles.map(async (p) => {
          mealsByUser[p.id] = await fetchMealsForDate(p.id, date).catch(() => []);
        })
      );

      const checkinMap: Record<string, DailyCheckin> = {};
      for (const c of checkins) checkinMap[c.user_id] = c;

      setData({
        profiles,
        checkins: checkinMap,
        dayStats,
        goals,
        privacy,
        mealsByUser,
        activities,
        myStreak: computeStreak(myCheckins),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach Mikrokosmos.');
    } finally {
      setLoading(false);
    }
  }, [myUserId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** Performance score for any friend on a given home-data snapshot. */
export function friendPerformance(data: HomeData, userId: string): number {
  const goals = data.goals[userId];
  if (!goals) return 0;
  return computePerformance({
    checkin: data.checkins[userId] ?? null,
    meals: data.mealsByUser[userId] ?? [],
    glasses: data.dayStats.water[userId] ?? 0,
    steps: data.dayStats.steps[userId] ?? 0,
    goals,
  });
}

/** Shared helper so check-in logging + Miko celebration stay consistent. */
export async function celebrateCheckin(profile: Profile, allCheckedIn: boolean) {
  await logActivity(profile.id, 'checkin', `${profile.display_name} started their day ☀️`);
  if (allCheckedIn) {
    const { sendMikoMessage } = await import('@/repositories/chat');
    const { mikoLine } = await import('@/services/miko');
    await sendMikoMessage(mikoLine('all_checked_in'));
  }
}
