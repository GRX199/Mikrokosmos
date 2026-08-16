import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import { DEFAULT_GOALS } from '@/core/constants/app';
import type { Goals, PrivacySettings, Profile } from '@/models';
import { MOCK_PROFILES, mockGoals, mockPrivacy } from './mockStore';

/** Profiles, goals and privacy settings. */

export async function fetchProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return MOCK_PROFILES;
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return MOCK_PROFILES.find((p) => p.id === userId) ?? null;
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'emoji' | 'avatar_url' | 'bio'>>
): Promise<void> {
  if (!isSupabaseConfigured) {
    const p = MOCK_PROFILES.find((x) => x.id === userId);
    if (p) Object.assign(p, patch);
    return;
  }
  const { error } = await getSupabase().from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function fetchGoals(userId: string): Promise<Goals> {
  if (!isSupabaseConfigured) {
    return mockGoals[userId] ?? { user_id: userId, ...DEFAULT_GOALS };
  }
  const { data, error } = await getSupabase()
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Goals) ?? { user_id: userId, ...DEFAULT_GOALS };
}

export async function fetchAllGoals(): Promise<Record<string, Goals>> {
  if (!isSupabaseConfigured) return mockGoals;
  const { data, error } = await getSupabase().from('goals').select('*');
  if (error) throw new Error(error.message);
  const map: Record<string, Goals> = {};
  for (const row of (data ?? []) as Goals[]) map[row.user_id] = row;
  return map;
}

const DEFAULT_PRIVACY: PrivacySettings = {
  user_id: '',
  weight_visibility: 'only_me',
  calories_visibility: 'friends',
  meals_visibility: 'friends',
};

export async function fetchPrivacy(userId: string): Promise<PrivacySettings> {
  if (!isSupabaseConfigured) return mockPrivacy[userId] ?? { ...DEFAULT_PRIVACY, user_id: userId };
  const { data, error } = await getSupabase()
    .from('privacy_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PrivacySettings) ?? { ...DEFAULT_PRIVACY, user_id: userId };
}

export async function fetchAllPrivacy(): Promise<Record<string, PrivacySettings>> {
  if (!isSupabaseConfigured) return mockPrivacy;
  const { data, error } = await getSupabase().from('privacy_settings').select('*');
  if (error) throw new Error(error.message);
  const map: Record<string, PrivacySettings> = {};
  for (const row of (data ?? []) as PrivacySettings[]) map[row.user_id] = row;
  return map;
}

export async function upsertPrivacy(
  userId: string,
  patch: Partial<Omit<PrivacySettings, 'user_id'>>
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockPrivacy[userId] = { ...(mockPrivacy[userId] ?? { ...DEFAULT_PRIVACY, user_id: userId }), ...patch };
    return;
  }
  const { error } = await getSupabase()
    .from('privacy_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
