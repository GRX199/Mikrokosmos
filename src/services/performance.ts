import type { DailyCheckin, Goals, Meal } from '@/models';

/**
 * Daily performance score (0-100), built from small positive signals.
 * Nothing here punishes — every component only adds to the score.
 *
 * Components (spec section 17):
 *  +15 morning check-in completed
 *  +20 calories logged within/under goal
 *  +20 water goal reached
 *  +20 step goal reached
 *  +15 at least one meal logged
 *  +10 mood checked in (part of check-in)
 */

export interface PerformanceInput {
  checkin?: DailyCheckin | null;
  meals: Meal[];
  glasses: number;
  steps: number;
  goals: Goals;
}

export function computePerformance(input: PerformanceInput): number {
  const { checkin, meals, glasses, steps, goals } = input;
  let score = 0;

  if (checkin) score += 15;

  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  if (calories > 0 && calories <= goals.calorie_goal * 1.15) score += 20;

  if (glasses >= goals.water_goal) score += 20;
  else if (glasses > 0) score += Math.round((glasses / goals.water_goal) * 14);

  if (steps >= goals.step_goal) score += 20;
  else if (steps > 0) score += Math.round((steps / goals.step_goal) * 14);

  if (meals.length > 0) score += 15;

  if (checkin?.mood) score += 10;

  return Math.min(100, score);
}
