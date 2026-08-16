import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Supabase client.
 *
 * The URL + anon key come from EXPO_PUBLIC_* env vars (see .env.local).
 * The anon key is public by design; all real protection comes from
 * Row Level Security policies in supabase/schema.sql.
 *
 * When env vars are missing the app still boots in mock mode so the UI
 * can be developed without a backend (spec section 53.9).
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(url as string, anonKey as string, {
    auth: {
      // SecureStore is unavailable on web; AsyncStorage covers every platform.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    realtime: { params: { eventsPerSecond: 5, maxConns: 3 } },
  });
}

/** Throws a friendly error if used while unconfigured. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local'
    );
  }
  return client;
}
