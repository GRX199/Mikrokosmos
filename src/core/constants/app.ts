import type { UserThemeKey } from '@/models';

/**
 * The three founding members of this universe.
 * Passwords intentionally do NOT live here — auth is Supabase-only.
 */

export const EMAIL_DOMAIN = 'mikrokosmos.app';

/** Login maps a username to `<username>@mikrokosmos.app` for Supabase Auth. */
export function emailForUsername(username: string) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export interface MemberSeed {
  username: string;
  displayName: string;
  emoji: string;
  theme: UserThemeKey;
}

export const MEMBERS: MemberSeed[] = [
  { username: 'namnamxyi', displayName: 'Namy', emoji: '🪻', theme: 'lilac' },
  { username: 'kyraawr', displayName: 'Kyra', emoji: '☁️', theme: 'sky' },
  { username: 'xcjessyx', displayName: 'Jessy', emoji: '🌸', theme: 'pink' },
];

/** Miko — the group's biggest fan. Bot messages carry sender_id = null. */
export const MIKO = {
  name: 'Miko',
  emoji: '💫',
};

/** Default goals until a member customizes theirs. */
export const DEFAULT_GOALS = {
  calorie_goal: 1600,
  water_goal: 8,
  step_goal: 8000,
};

export const STORAGE_BUCKET = 'mikrokosmos-media';
