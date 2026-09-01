import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { RADIUS, useAppTheme } from '@/core/theme';
import { useI18n } from '@/core/i18n';
import type { Profile } from '@/models';
import {
  ACHIEVEMENTS,
  collectionProgress,
  evaluateAchievements,
  type AchievementStats,
} from '@/services/achievements';
import { fetchAchievementStats } from '@/repositories/achievements';
import { fetchProfiles } from '@/repositories/profiles';
import { useAuth } from '@/features/auth/SessionProvider';

/**
 * Achievements — gentle milestone badges (Phase 2).
 * Everyone's collection is visible (celebrating each other is the point),
 * but nothing is ranked. A locked badge shows its hint, never shame.
 */
export default function AchievementsScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [myStats, setMyStats] = useState<AchievementStats | null>(null);
  const [friendStats, setFriendStats] = useState<Record<string, AchievementStats>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const allProfiles = await fetchProfiles();
      setProfiles(allProfiles);
      const mine = await fetchAchievementStats(profile.id);
      setMyStats(mine);
      const others = await Promise.all(
        allProfiles
          .filter((p) => p.id !== profile.id)
          .map(async (p) => [p.id, await fetchAchievementStats(p.id)] as const)
      );
      setFriendStats(Object.fromEntries(others));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not load the badge shelf.'));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const myUnlocked = useMemo(
    () => (myStats ? evaluateAchievements(myStats) : new Set<string>()),
    [myStats]
  );

  if (loading && !myStats) return <LoadingView label={t('Polishing the badges…')} />;
  if (error && !myStats) return <ErrorState message={error} onRetry={load} />;
  if (!profile || !myStats) return null;

  const friends = profiles.filter((p) => p.id !== profile.id);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/me'))}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Achievements 🏅</Text>
          <View style={styles.backButton} />
        </View>

        {/* My collection */}
        <RoundedCard tinted style={styles.progressCard}>
          <Text style={[styles.progressCount, { color: theme.accent }]}>
            {collectionProgress(myUnlocked)}
          </Text>
          <Text style={[styles.progressLabel, { color: palette.text }]}>
            badges collected — every one of them earned gently
          </Text>
        </RoundedCard>

        <View style={styles.badgeGrid}>
          {ACHIEVEMENTS.map((badge) => {
            const unlocked = myUnlocked.has(badge.key);
            return (
              <View
                key={badge.key}
                style={[
                  styles.badgeCard,
                  { backgroundColor: unlocked ? theme.light : palette.card },
                ]}
              >
                <Text style={[styles.badgeEmoji, { opacity: unlocked ? 1 : 0.35 }]}>{badge.emoji}</Text>
                <Text
                  style={[
                    styles.badgeTitle,
                    { color: unlocked ? palette.text : palette.textFaint },
                  ]}
                  numberOfLines={1}
                >
                  {badge.title}
                </Text>
                <Text
                  style={[
                    styles.badgeDescription,
                    { color: unlocked ? palette.textSecondary : palette.textFaint },
                  ]}
                  numberOfLines={2}
                >
                  {badge.description}
                </Text>
                {!unlocked ? (
                  <Text style={[styles.badgeHint, { color: palette.textFaint }]} numberOfLines={2}>
                    {badge.hint}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Friends' collections — celebration, never comparison */}
        <Text style={[styles.sectionTitle, { color: palette.text }]}>The Trio's Badges</Text>
        {friends.length === 0 ? (
          <EmptyState
            emoji="🌌"
            title={t('Just you so far')}
            subtitle={t('When your friends join, their badges will shine here too.')}
          />
        ) : (
          friends.map((friend) => {
            const stats = friendStats[friend.id];
            const unlocked = stats ? evaluateAchievements(stats) : new Set<string>();
            const friendBadges = ACHIEVEMENTS.filter((b) => unlocked.has(b.key));
            return (
              <RoundedCard key={friend.id} style={styles.friendCard}>
                <View style={styles.friendHeader}>
                  <Text style={styles.friendEmoji}>{friend.emoji}</Text>
                  <View style={styles.friendTitleWrap}>
                    <Text style={[styles.friendName, { color: palette.text }]}>
                      {friend.display_name}
                    </Text>
                    <Text style={[styles.friendCount, { color: palette.textFaint }]}>
                      {collectionProgress(unlocked)} collected
                    </Text>
                  </View>
                </View>
                <View style={styles.friendBadgeRow}>
                  {friendBadges.length === 0 ? (
                    <Text style={[styles.friendEmpty, { color: palette.textFaint }]}>
                      No badges yet — her universe is still warming up ✨
                    </Text>
                  ) : (
                    friendBadges.map((b) => (
                      <View
                        key={b.key}
                        style={[styles.friendBadgeChip, { backgroundColor: theme.light }]}
                      >
                        <Text style={styles.friendBadgeEmoji}>{b.emoji}</Text>
                        <Text style={[styles.friendBadgeTitle, { color: theme.accent }]} numberOfLines={1}>
                          {b.title}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </RoundedCard>
            );
          })
        )}

        <View style={styles.bottomGap} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  progressCard: { alignItems: 'center', paddingVertical: 20, marginBottom: 18 },
  progressCount: { fontSize: 28, fontWeight: '800' },
  progressLabel: { fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: {
    width: '31%',
    flexGrow: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeEmoji: { fontSize: 30, marginBottom: 6 },
  badgeTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  badgeDescription: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 14,
  },
  badgeHint: { fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 4, lineHeight: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  friendCard: { marginBottom: 12 },
  friendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  friendEmoji: { fontSize: 26 },
  friendTitleWrap: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700' },
  friendCount: { fontSize: 12, marginTop: 1 },
  friendBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friendEmpty: { fontSize: 13, fontStyle: 'italic' },
  friendBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  friendBadgeEmoji: { fontSize: 14 },
  friendBadgeTitle: { fontSize: 12, fontWeight: '700' },
  bottomGap: { height: 24 },
});
