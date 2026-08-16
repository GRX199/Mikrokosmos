import type { Mood, MealType, TrendStatus, UserThemeKey } from '@/models';

/**
 * Mikrokosmos design tokens.
 *
 * The layout never changes between users — only the visual identity does.
 * Each member gets a full token set (primary/light/accent/background) that
 * flows into buttons, navigation, cards, progress rings and gradients.
 */

export interface UserTheme {
  key: UserThemeKey;
  /** Main brand color — buttons, active nav, highlights. */
  primary: string;
  /** Very light tint — chip backgrounds, soft fills. */
  light: string;
  /** Deeper tone — text on light fills, pressed states. */
  accent: string;
  /** Page background. */
  background: string;
  /** Softer card background for nested surfaces. */
  surfaceSoft: string;
  /** Gradient used on hero cards / login. */
  gradient: [string, string];
}

export const USER_THEMES: Record<UserThemeKey, UserTheme> = {
  lilac: {
    key: 'lilac',
    primary: '#B79CED',
    light: '#F2EAFF',
    accent: '#8D6CCF',
    background: '#FBF8FF',
    surfaceSoft: '#F7F1FF',
    gradient: ['#E9DCFF', '#FBF8FF'],
  },
  sky: {
    key: 'sky',
    primary: '#8FD3F4',
    light: '#EAF8FF',
    accent: '#56B4DF',
    background: '#F7FCFF',
    surfaceSoft: '#EFF8FE',
    gradient: ['#D8F1FF', '#F7FCFF'],
  },
  pink: {
    key: 'pink',
    primary: '#F3A6C8',
    light: '#FFF0F6',
    accent: '#DD78A8',
    background: '#FFF9FC',
    surfaceSoft: '#FFF3F8',
    gradient: ['#FFE1EE', '#FFF9FC'],
  },
};

/** Default (pre-login) look — Namy's lilac, the softest of the three. */
export const DEFAULT_THEME = USER_THEMES.lilac;

/** Colors shared by every theme (neutral chrome + semantic states). */
export const PALETTE = {
  text: '#2E2A3B',
  textSecondary: '#8A8499',
  textFaint: '#B7B2C4',
  card: '#FFFFFF',
  border: '#F0ECF7',
  success: '#7BC9A3',
  warning: '#F4C36B',
  danger: '#EF8A9B',
  white: '#FFFFFF',
  overlay: 'rgba(46, 42, 59, 0.35)',
};

export const RADIUS = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Web/tablet: keep content from stretching too wide (spec section 46). */
export const MAX_CONTENT_WIDTH = 560;

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'sleepy', emoji: '😴', label: 'Sleepy' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'good', emoji: '😊', label: 'Good' },
  { key: 'amazing', emoji: '🥰', label: 'Amazing' },
  { key: 'not_my_day', emoji: '😭', label: 'Not My Day' },
];

export function moodMeta(mood?: string | null) {
  return MOODS.find((m) => m.key === mood) ?? { key: 'okay' as Mood, emoji: '😐', label: 'Okay' };
}

export const MEAL_TYPES: { key: MealType; emoji: string; label: string }[] = [
  { key: 'breakfast', emoji: '🌅', label: 'Breakfast' },
  { key: 'lunch', emoji: '🍱', label: 'Lunch' },
  { key: 'dinner', emoji: '🌙', label: 'Dinner' },
  { key: 'snack', emoji: '🍓', label: 'Snack' },
];

export function mealMeta(type?: string | null) {
  return MEAL_TYPES.find((m) => m.key === type) ?? { key: 'snack' as MealType, emoji: '🍓', label: 'Snack' };
}

export const TREND_STATUSES: { key: TrendStatus; emoji: string; label: string }[] = [
  { key: 'idea', emoji: '💭', label: 'Idea' },
  { key: 'planned', emoji: '📌', label: 'Planned' },
  { key: 'doing', emoji: '⏳', label: 'Doing' },
  { key: 'done', emoji: '✅', label: 'Done' },
];

export function trendStatusMeta(status?: string | null) {
  return TREND_STATUSES.find((s) => s.key === status) ?? TREND_STATUSES[0];
}

/** Positive performance tiers — never "failed" or "bad" wording (spec §17). */
export const PERFORMANCE_TIERS = [
  { min: 95, label: 'Cosmic Day', emoji: '💫' },
  { min: 80, label: 'Amazing', emoji: '🌟' },
  { min: 60, label: 'Doing Great', emoji: '✨' },
  { min: 40, label: 'Growing', emoji: '🌿' },
  { min: 0, label: 'Starting', emoji: '🌱' },
];

export function performanceTier(score: number) {
  return PERFORMANCE_TIERS.find((t) => score >= t.min) ?? PERFORMANCE_TIERS[PERFORMANCE_TIERS.length - 1];
}

/** Chat reactions the friends can tap on a message. */
export const REACTION_EMOJIS = ['❤️', '😂', '😭', '🥹', '✨'];
