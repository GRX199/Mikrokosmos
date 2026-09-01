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

/**
 * AppearanceProvider — light/dark mode on top of the member theme.
 * Mode is per-device (AsyncStorage), the theme stays per-member.
 * Default: follow the system preference, manual choice overrides.
 */

const STORAGE_KEY = 'mikrokosmos.appearance.mode';

export interface AppearanceContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** 'auto' until the user explicitly picks a mode. */
  followsSystem: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  mode: 'light',
  setMode: () => undefined,
  followsSystem: true,
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [savedMode, setSavedMode] = useState<Mode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') setSavedMode(saved);
      })
      .catch(() => undefined);
  }, []);

  const setMode = (m: Mode) => {
    setSavedMode(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => undefined);
  };

  const mode: Mode = savedMode ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo(
    () => ({ mode, setMode, followsSystem: savedMode === null }),
    [mode, savedMode]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearanceMode() {
  return useContext(AppearanceContext);
}
