import type { DailyCheckin } from '@/models';

/**
 * Streak = consecutive days (ending today or yesterday) with a check-in.
 * Self-love is about showing up gently, so a streak counts check-ins,
 * not perfection.
 */
export function computeStreak(checkins: DailyCheckin[]): number {
  if (!checkins.length) return 0;

  const days = new Set(checkins.map((c) => c.date));
  let streak = 0;
  const cursor = new Date();

  // Allow the streak to survive if today isn't checked in yet.
  if (!days.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  while (days.has(toKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function toKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Celebration milestones (spec section 42). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}
