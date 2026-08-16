import type { Profile } from '@/models';

/**
 * Miko — the group's biggest fan (spec section 20).
 *
 * MVP uses event-based rules: each app event maps to a playful line.
 * The `MikoRule` shape is deliberately small so Phase 3 can replace
 * `pickLine` with an LLM call without touching callers.
 */

export type MikoEvent =
  | 'goal_completed'
  | 'new_streak'
  | 'meal_added'
  | 'trend_completed'
  | 'all_checked_in'
  | 'group_progress'
  | 'checkin_early';

interface MikoRule {
  event: MikoEvent;
  lines: ((name: string) => string)[];
}

const RULES: MikoRule[] = [
  {
    event: 'goal_completed',
    lines: [
      (n) => `BREAKING NEWS 🚨 ${n} completed a daily goal. Historic moment for Mikrokosmos.`,
      (n) => `${n} just crushed a goal. The universe is impressed ✨`,
    ],
  },
  {
    event: 'new_streak',
    lines: [
      (n) => `${n} is on a streak 🔥 Someone stop them (don't).`,
      (n) => `Streak unlocked by ${n}. Consistency queen behavior 👑`,
    ],
  },
  {
    event: 'meal_added',
    lines: [
      (n) => `${n} logged a meal. Fueling the friendship 🍱`,
      (n) => `${n} ate something and told us about it. We approve 🥹`,
    ],
  },
  {
    event: 'trend_completed',
    lines: [
      (n) => `${n} finished a trend! This is what peak performance looks like 💅`,
      () => `A trend has been conquered. Mikrokosmos celebrates 🎉`,
    ],
  },
  {
    event: 'all_checked_in',
    lines: [
      () => `All three of you checked in today. The trio is COMPLETE 🌌`,
      () => `Full house! Everyone started their day together 🥹✨`,
    ],
  },
  {
    event: 'group_progress',
    lines: [
      () => `Group progress is soaring today. I'm proud 😭`,
      () => `This universe is thriving. Keep glowing ✨`,
    ],
  },
  {
    event: 'checkin_early',
    lines: [
      (n) => `${n} checked in bright and early. Rise and shine behavior ☀️`,
    ],
  },
];

/** Pick a playful Miko line for an event. */
export function mikoLine(event: MikoEvent, profile?: Profile | null): string {
  const rule = RULES.find((r) => r.event === event);
  if (!rule) return '✨';
  const name = profile?.display_name ?? 'Someone';
  const line = rule.lines[Math.floor(Math.random() * rule.lines.length)];
  return line(name);
}
