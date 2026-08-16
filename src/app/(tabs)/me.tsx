import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SoftInput } from '@/components/SoftInput';
import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import { RADIUS, useAppTheme } from '@/core/theme';
import type { PrivacySettings, Visibility } from '@/models';
import { fetchUserCheckins } from '@/repositories/checkins';
import { fetchMealsCount } from '@/repositories/meals';
import {
  fetchPrivacy,
  updateProfile,
  upsertPrivacy,
} from '@/repositories/profiles';
import { fetchCompletedTrendsCount } from '@/repositories/trends';
import { computeStreak } from '@/services/streak';
import { useAuth } from '@/features/auth/SessionProvider';

/** Me tab — own profile, stats, privacy and settings (spec sections 26-27). */
export default function MeScreen() {
  const { profile, refreshProfile, signOut, isMock } = useAuth();
  const { theme, palette } = useAppTheme();

  const [stats, setStats] = useState({ streak: 0, checkins: 0, meals: 0, trendsDone: 0 });
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const [checkins, meals, trendsDone, privacySettings] = await Promise.all([
        fetchUserCheckins(profile.id),
        fetchMealsCount(profile.id),
        fetchCompletedTrendsCount(profile.id),
        fetchPrivacy(profile.id),
      ]);
      setStats({
        streak: computeStreak(checkins),
        checkins: new Set(checkins.map((c) => c.date)).size,
        meals,
        trendsDone,
      });
      setPrivacy(privacySettings);
    } catch {
      // Stats are nice-to-have; profile itself still renders.
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  async function handleTogglePrivacy(field: keyof Omit<PrivacySettings, 'user_id'>) {
    if (!profile || !privacy) return;
    const next: Visibility = privacy[field] === 'friends' ? 'only_me' : 'friends';
    const optimistic = { ...privacy, [field]: next };
    setPrivacy(optimistic);
    await upsertPrivacy(profile.id, { [field]: next });
  }

  function confirmLogout() {
    if (Platform.OS === 'web') {
      // React Native's Alert is a no-op on web — use the browser dialog instead.
      if (window.confirm('Log out? You can always come back to your universe ✨')) {
        signOut();
      }
      return;
    }
    Alert.alert('Log out?', 'You can always come back to your universe ✨', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Log out', onPress: () => signOut() },
    ]);
  }

  const statItems = [
    { emoji: '🔥', value: stats.streak, label: 'Day Streak' },
    { emoji: '💗', value: stats.checkins, label: 'Self Love Days' },
    { emoji: '🍱', value: stats.meals, label: 'Meals Logged' },
    { emoji: '✨', value: stats.trendsDone, label: 'Trends Done' },
  ];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <RoundedCard tinted style={styles.identityCard}>
          <Avatar profile={profile} size={72} />
          <Text style={[styles.name, { color: palette.text }]}>
            {profile.emoji} {profile.display_name}
          </Text>
          <Text style={[styles.username, { color: palette.textSecondary }]}>
            @{profile.username}
          </Text>
          {profile.bio ? (
            <Text style={[styles.bio, { color: palette.textSecondary }]}>{profile.bio}</Text>
          ) : null}
          <Pressable
            onPress={() => setEditOpen(true)}
            style={[styles.editButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="create-outline" size={15} color={palette.white} />
            <Text style={[styles.editButtonText, { color: palette.white }]}>Edit Profile</Text>
          </Pressable>
        </RoundedCard>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {statItems.map((item) => (
            <RoundedCard key={item.label} style={styles.statCard}>
              <Text style={styles.statEmoji}>{item.emoji}</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{item.label}</Text>
            </RoundedCard>
          ))}
        </View>

        {/* Menu */}
        <RoundedCard style={styles.menu}>
          <MenuItem
            icon="shield-checkmark-outline"
            label="Privacy"
            hint="Control what friends can see"
            onPress={() => setPrivacyOpen(true)}
          />
          <MenuItem
            icon="key-outline"
            label="Change Password"
            hint={isMock ? 'Connect Supabase to enable' : 'Keep your universe safe'}
            onPress={() =>
              isMock
                ? Alert.alert('Demo mode', 'Password changes need the live Supabase backend.')
                : setPasswordOpen(true)
            }
          />
          <MenuItem
            icon="sparkles-outline"
            label="About Mikrokosmos"
            hint="Our little universe"
            onPress={() => setAboutOpen(true)}
          />
          <MenuItem icon="log-out-outline" label="Log Out" danger onPress={confirmLogout} last />
        </RoundedCard>

        <Text style={[styles.footer, { color: palette.textFaint }]}>
          Made with 💗 by Namy, Kyra & Jessy
        </Text>
      </ScrollView>

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await refreshProfile();
          await load();
        }}
      />

      {/* Privacy modal */}
      <Modal visible={privacyOpen} transparent animationType="slide" onRequestClose={() => setPrivacyOpen(false)}>
        <View style={[styles.sheetBackdrop, { backgroundColor: palette.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: palette.card }]}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Privacy 🤍</Text>
            <Text style={[styles.sheetSub, { color: palette.textSecondary }]}>
              You choose what your friends can see. Everything else stays just yours.
            </Text>
            {privacy
              ? (
                  [
                    { field: 'weight_visibility' as const, label: 'Weight', emoji: '⚖️' },
                    { field: 'calories_visibility' as const, label: 'Calories', emoji: '🔥' },
                    { field: 'meals_visibility' as const, label: 'Meals', emoji: '🍱' },
                  ]
                ).map(({ field, label, emoji }) => (
                  <View key={field} style={[styles.privacyRow, { borderBottomColor: palette.border }]}>
                    <Text style={[styles.privacyLabel, { color: palette.text }]}>
                      {emoji} {label}
                    </Text>
                    <Pressable
                      onPress={() => handleTogglePrivacy(field)}
                      style={[
                        styles.privacyToggle,
                        {
                          backgroundColor:
                            privacy[field] === 'friends' ? theme.light : theme.surfaceSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.privacyToggleText,
                          { color: privacy[field] === 'friends' ? theme.accent : palette.textSecondary },
                        ]}
                      >
                        {privacy[field] === 'friends' ? '👯 Friends' : '🔒 Only Me'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              : null}
            <View style={styles.sheetGap} />
            <PrimaryButton label="Done" onPress={() => setPrivacyOpen(false)} />
          </View>
        </View>
      </Modal>

      <ChangePasswordModal visible={passwordOpen} onClose={() => setPasswordOpen(false)} />

      {/* About modal */}
      <Modal visible={aboutOpen} transparent animationType="fade" onRequestClose={() => setAboutOpen(false)}>
        <Pressable
          style={[styles.aboutBackdrop, { backgroundColor: palette.overlay }]}
          onPress={() => setAboutOpen(false)}
        >
          <View style={[styles.aboutCard, { backgroundColor: palette.card }]}>
            <Text style={styles.aboutEmoji}>🌌</Text>
            <Text style={[styles.aboutTitle, { color: palette.text }]}>Mikrokosmos</Text>
            <Text style={[styles.aboutSub, { color: palette.textSecondary }]}>
              A little universe shared by three best friends. Phase 1 — built with love, Expo and
              Supabase. No rankings, no pressure — just checking in on each other, one gentle day at
              a time.
            </Text>
            <Text style={[styles.aboutVersion, { color: palette.textFaint }]}>v1.0 · Phase 1 MVP</Text>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onPress,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const { theme, palette } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuItem, !last && { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? palette.border : theme.light }]}>
        <Ionicons name={icon} size={17} color={danger ? palette.danger : theme.accent} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuLabel, { color: danger ? palette.danger : palette.text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.menuHint, { color: palette.textFaint }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
    </Pressable>
  );
}

function EditProfileModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && profile) {
      setDisplayName(profile.display_name);
      setEmoji(profile.emoji);
      setBio(profile.bio ?? '');
    }
  }, [visible, profile]);

  async function handleSave() {
    if (!profile || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        display_name: displayName.trim(),
        emoji,
        bio: bio.trim() || null,
      });
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const emojiChoices = ['✨', '🪻', '☁️', '🌸', '🌙', '🫶', '🧸', '🍓', '🦋', '🌈'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheetBackdrop, { backgroundColor: palette.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: palette.card }]}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Edit Profile 🎀</Text>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Display name</Text>
          <SoftInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What friends call you"
            placeholderTextColor={palette.textFaint}
            style={{ color: palette.text }}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Your emoji</Text>
          <View style={styles.emojiRow}>
            {emojiChoices.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  styles.emojiChip,
                  {
                    backgroundColor: emoji === e ? theme.light : theme.surfaceSoft,
                    borderColor: emoji === e ? theme.primary : 'transparent',
                  },
                ]}
              >
                <Text style={styles.emojiChoice}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Bio (optional)</Text>
          <SoftInput
            value={bio}
            onChangeText={setBio}
            placeholder="A tiny line about you…"
            placeholderTextColor={palette.textFaint}
            style={{ color: palette.text }}
            multiline
          />

          <View style={styles.sheetGap} />
          <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={!displayName.trim()} />
          <Pressable onPress={onClose} style={styles.laterButton}>
            <Text style={[styles.laterText, { color: palette.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useAppTheme();
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNext('');
      setError(null);
    }
  }, [visible]);

  async function handleSave() {
    if (!isSupabaseConfigured) return;
    setError(null);
    if (next.length < 6) {
      setError('New password needs at least 6 characters ✨');
      return;
    }
    setSaving(true);
    try {
      const { error: authError } = await getSupabase().auth.updateUser({ password: next });
      if (authError) {
        setError(authError.message);
      } else {
        Alert.alert('Password updated 🔐', 'Your universe is safe.');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheetBackdrop, { backgroundColor: palette.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: palette.card }]}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>Change Password 🔐</Text>
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>New password</Text>
          <SoftInput
            value={next}
            onChangeText={setNext}
            placeholder="New password"
            placeholderTextColor={palette.textFaint}
            secureTextEntry
            style={{ color: palette.text }}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.sheetGap} />
          <PrimaryButton label="Update Password" onPress={handleSave} loading={saving} />
          <Pressable onPress={onClose} style={styles.laterButton}>
            <Text style={[styles.laterText, { color: palette.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 110 },
  identityCard: { alignItems: 'center', paddingVertical: 26 },
  name: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  username: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  editButtonText: { fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  statCard: { width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 16 },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 12, marginTop: 2 },
  menu: { marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700' },
  menuHint: { fontSize: 12, marginTop: 1 },
  footer: { textAlign: 'center', fontSize: 12 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    paddingBottom: 34,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sheetSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  sheetGap: { height: 18 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  privacyLabel: { fontSize: 15, fontWeight: '600' },
  privacyToggle: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill },
  privacyToggleText: { fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginVertical: 8, marginTop: 14 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChoice: { fontSize: 20 },
  laterButton: { marginTop: 12, alignSelf: 'center', padding: 6 },
  laterText: { fontSize: 13, fontWeight: '600' },
  errorText: { color: '#EF8A9B', fontSize: 12, marginTop: 8 },
  aboutBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  aboutCard: { width: '100%', maxWidth: 340, borderRadius: RADIUS.xl, padding: 26, alignItems: 'center' },
  aboutEmoji: { fontSize: 40 },
  aboutTitle: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  aboutSub: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  aboutVersion: { fontSize: 11, marginTop: 12 },
});
