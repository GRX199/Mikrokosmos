import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Mode } from './darkTokens';
import { accountKey, onSessionUsernameChange } from '@/core/session/bridge';

/**
 * AppearanceProvider — light/dark mode on top of the member theme.
 * Mode is per-account (storage key includes the username), the theme
 * stays per-member. Default: LIGHT, an explicit choice overrides.
 */

const STORAGE_KEY = 'mikrokosmos.appearance.mode';

export interface AppearanceContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** True when no explicit choice has been made on this account. */
  followsSystem: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  mode: 'light',
  setMode: () => undefined,
  followsSystem: true,
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  // Kept for potential future "system" option; unused for the default now.
  const systemScheme = useColorScheme();
  const [savedMode, setSavedMode] = useState<Mode | null>(null);

  // Load the signed-in account's saved mode (per-account storage key).
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(accountKey(STORAGE_KEY))
      .then((saved) => {
        if (active && (saved === 'light' || saved === 'dark')) setSavedMode(saved);
        else if (active) setSavedMode(null); // no explicit choice → light
      })
      .catch(() => undefined);
    const off = onSessionUsernameChange(() => {
      AsyncStorage.getItem(accountKey(STORAGE_KEY))
        .then((saved) => {
          if (active) setSavedMode(saved === 'light' || saved === 'dark' ? saved : null);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  const setMode = (m: Mode) => {
    setSavedMode(m);
    AsyncStorage.setItem(accountKey(STORAGE_KEY), m).catch(() => undefined);
  };

  // Default: LIGHT (explicit product decision), manual choice overrides.
  const mode: Mode = savedMode ?? 'light';

  const value = useMemo(
    () => ({ mode, setMode, followsSystem: savedMode === null }),
    [mode, savedMode]
  );

  void systemScheme;

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearanceMode() {
  return useContext(AppearanceContext);
}
