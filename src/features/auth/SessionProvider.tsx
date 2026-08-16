import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { emailForUsername, MEMBERS } from '@/core/constants/app';
import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Profile } from '@/models';
import { fetchProfile } from '@/repositories/profiles';
import { MOCK_PROFILES } from '@/repositories/mockStore';

/**
 * SessionProvider — single source of truth for "who is exploring this
 * universe right now". Handles both live Supabase auth and the offline
 * mock mode (any of the three usernames, any password).
 */

const MOCK_SESSION_KEY = 'mikrokosmos.mockUserId';

interface AuthContextValue {
  /** True while restoring a persisted session on launch. */
  isLoading: boolean;
  profile: Profile | null;
  /** Returns an error message, or null on success. */
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Re-fetch the current profile (after edits). */
  refreshProfile: () => Promise<void>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  profile: null,
  signIn: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
  isMock: !isSupabaseConfigured,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured) {
      return MOCK_PROFILES.find((p) => p.id === userId) ?? null;
    }
    let loaded = await fetchProfile(userId);
    if (!loaded) {
      // First login before setup script ran: build the profile from auth metadata.
      const { data } = await getSupabase().auth.getUser();
      const meta = data.user?.user_metadata ?? {};
      const username = String(meta.username ?? '');
      const seed = MEMBERS.find((m) => m.username === username);
      if (username) {
        await getSupabase().from('profiles').insert({
          id: userId,
          username,
          display_name: String(meta.display_name ?? seed?.displayName ?? username),
          emoji: seed?.emoji ?? '✨',
          theme: seed?.theme ?? 'lilac',
        });
        loaded = await fetchProfile(userId);
      }
    }
    return loaded;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!isSupabaseConfigured) {
        const mockId = await AsyncStorage.getItem(MOCK_SESSION_KEY);
        if (mounted && mockId) {
          setProfile(MOCK_PROFILES.find((p) => p.id === mockId) ?? null);
        }
        if (mounted) setIsLoading(false);
        return;
      }
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const session: Session | null = data.session;
      if (session?.user && mounted) {
        setProfile(await loadProfile(session.user.id));
      }
      if (mounted) setIsLoading(false);

      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!mounted) return;
        if (newSession?.user) {
          setProfile(await loadProfile(newSession.user.id));
        } else {
          setProfile(null);
        }
      });
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const clean = username.trim().toLowerCase();
      if (!clean) return 'Tell us your username first ✨';
      if (!password) return 'Your password is needed to enter ✨';

      if (!isSupabaseConfigured) {
        const seed = MEMBERS.find((m) => m.username === clean);
        if (!seed) return 'That username is not part of this universe yet 🌌';
        const mockProfile = MOCK_PROFILES.find((p) => p.username === clean) ?? null;
        if (mockProfile) {
          await AsyncStorage.setItem(MOCK_SESSION_KEY, mockProfile.id);
          setProfile(mockProfile);
        }
        return null;
      }

      const { error } = await getSupabase().auth.signInWithPassword({
        email: emailForUsername(clean),
        password,
      });
      if (error) return 'Invalid username or password 🥺';
      return null;
    },
    []
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await getSupabase().auth.signOut();
    } else {
      await AsyncStorage.removeItem(MOCK_SESSION_KEY);
    }
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!profile) return;
    if (!isSupabaseConfigured) {
      setProfile(MOCK_PROFILES.find((p) => p.id === profile.id) ?? null);
      return;
    }
    setProfile(await fetchProfile(profile.id));
  }, [profile]);

  const value = useMemo(
    () => ({
      isLoading,
      profile,
      signIn,
      signOut,
      refreshProfile,
      isMock: !isSupabaseConfigured,
    }),
    [isLoading, profile, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
