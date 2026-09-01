import type { UserThemeKey } from '@/models';
import type { UserTheme } from '../theme/colors';

/**
 * Dark variants for each member theme. Keeps the same primary/accent
 * identity (so Namy stays lilac, Kyra sky, Jessy pink) but swaps the
 * surfaces for deep-space tones. Text contrast is tuned for dark
 * backgrounds (WCAG-ish, gentle on the eyes at night).
 */

export type Mode = 'light' | 'dark';

const COMMON_DARK = {
  border: '#332C42',
  text: '#ECE7F4',
  textSecondary: '#A79FBB',
  textFaint: '#6E6784',
  success: '#7BC9A3',
  warning: '#E8B45A',
  danger: '#EF8A9B',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

/** Slight tint blend so each friend's dark mode still feels personal. */
const TINT: Record<UserThemeKey, { background: string; card: string; light: string }> = {
  lilac: { background: '#16121F', card: '#211B2E', light: '#2C2440' },
  sky:   { background: '#101722', card: '#182030', light: '#243044' },
  pink:  { background: '#1C1218', card: '#271823', light: '#38222E' },
};

/** Full dark palette (same shape as PALETTE). */
export function darkPaletteFor(themeKey?: UserThemeKey | null) {
  const tint = TINT[themeKey ?? 'lilac'];
  return {
    ...COMMON_DARK,
    background: tint.background,
    card: tint.card,
  };
}

/** Dark `light` (soft fill) token per theme. */
export function darkLightToken(themeKey?: UserThemeKey | null): string {
  return TINT[themeKey ?? 'lilac'].light;
}

/** Dark user theme (background/gradient/surfaces for dark mode). */
export function darkUserTheme(key: UserThemeKey): UserTheme {
  const base = TINT[key];
  return {
    key,
    primary: USER_PRIMARY[key],
    light: base.light,
    accent: USER_ACCENT[key],
    background: base.background,
    surfaceSoft: base.card,
    gradient: [base.card, base.background] as [string, string],
  };
}

const USER_PRIMARY: Record<UserThemeKey, string> = {
  lilac: '#C9A8F5',
  sky: '#9FD9F7',
  pink: '#F7BAD8',
};

const USER_ACCENT: Record<UserThemeKey, string> = 
  USER_PRIMARY;
