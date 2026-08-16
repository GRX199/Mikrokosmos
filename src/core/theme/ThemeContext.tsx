import React, { createContext, useContext, useMemo } from 'react';

import type { UserThemeKey } from '@/models';
import { DEFAULT_THEME, PALETTE, USER_THEMES, type UserTheme } from './colors';

/**
 * ThemeContext — the whole app re-skins itself from the logged-in member's
 * theme key. Layout stays identical; only colors change (spec section 4).
 */

export interface ThemeContextValue {
  theme: UserTheme;
  palette: typeof PALETTE;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  palette: PALETTE,
});

export function ThemeProvider({
  themeKey,
  children,
}: {
  themeKey?: UserThemeKey | null;
  children: React.ReactNode;
}) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: (themeKey && USER_THEMES[themeKey]) || DEFAULT_THEME,
      palette: PALETTE,
    }),
    [themeKey]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

/** Resolve a full theme for any member (used for friend-colored chat bubbles). */
export function themeFor(themeKey?: UserThemeKey | null): UserTheme {
  return (themeKey && USER_THEMES[themeKey]) || DEFAULT_THEME;
}
