import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { GradientCard, RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { moodMeta, RADIUS, useAppTheme } from '@/core/theme';
import { friendlyDate, greetingFor, dayPhase, relativeTime, shortTime } from '@/core/utils/date';
import type { Activity, Mood, Profile } from '@/models';
import { createCheckin, fetchCheckinsForDate } from '@/repositories/checkins';
import { useAuth } from '@/features/auth/SessionProvider';
import {
  celebrateCheckin,
  friendPerformance,
  useHomeData,
  type HomeData,
} from '@/features/home/useHomeData';
import { MorningCheckinModal } from '@/features/home/MorningCheckinModal';
import { MealDetailModal } from '@/features/home/MealDetailModal';
import { todayKey } from '@/core/utils/date';

const ACTIVITY_ICONS: Record<string, string> = {
  checkin: '☀️',
  meal: '🍱',
  water_goal: '💧',
  step_goal: '👟',
  trend_added: '✨',
  trend_done: '✅',
  memory: '📸',
  achievement: '🏆',
  streak: '🔥',
  miko: '💫',
};

/** Home — what's happening in the friendship group today (spec sections 7-10). */
export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const { data, loading, error, refresh } = useHomeData(profile?.id);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mealDetailId, setMealDetailId] = useState<string | null>(null);

  const myCheckin = profile && data ? data.checkins[profile.id] : undefined;

  const load = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Open the morning check-in once when we know today's state.
  React.useEffect(() => {
    if (data && profile && !data.checkins[profile.id]) {
      setCheckinOpen(true);
    }
  }, [data, profile]);

  if (loading && !data) return <LoadingView label="Waking up your universe…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || !profile) return null;

  const phase = dayPhase();

  async function handleCheckin(wakeUpTime: string, mood: Mood) {
    if (!profile) return;
    await createCheckin(profile.id, todayKey(), { wake_up_time: wakeUpTime, mood });
    // If the trio is now complete, Miko celebrates in chat.
    const todays = await fetchCheckinsForDate(todayKey()).catch(() => []);
    const allIn = data!.profiles.every((p) => todays.some((c) => c.user_id === p.id));
    await celebrateCheckin(profile, allIn);
    setCheckinOpen(false);
    await refresh();
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={theme.accent}
            colors={[theme.primary]}
          />
        }
      >
        {/* Daily greeting */}
        <GradientCard style={styles.greeting}>
          <Text style={[styles.greetingTitle, { color: palette.text }]}>
            {greetingFor(phase)}, {profile.display_name} {profile.emoji}
          </Text>
          <Text style={[styles.greetingSubtitle, { color: palette.textSecondary }]}>
            Welcome back to your little universe.
          </Text>
          <Text style={[styles.greetingDate, { color: palette.textSecondary }]}>
            {friendlyDate()}
          </Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: palette.card }]}>
              <Text style={[styles.chipText, { color: theme.accent }]}>
                {data.myStreak > 0 ? `🔥 ${data.myStreak} Day Streak` : '🌱 A fresh day'}
              </Text>
            </View>
            {myCheckin ? (
              <View style={[styles.chip, { backgroundColor: palette.card }]}>
                <Text style={[styles.chipText, { color: theme.accent }]}>
                  {moodMeta(myCheckin.mood).emoji} Feeling {moodMeta(myCheckin.mood).label.toLowerCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </GradientCard>

        {/* Friend status */}
        <SectionTitle title="Our Mikrokosmos Today" />
        <View style={styles.friendColumn}>
          {data.profiles.map((friend) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              data={data}
              isMe={friend.id === profile.id}
              onPress={() =>
                friend.id === profile.id
                  ? router.push('/(tabs)/me')
                  : router.push(`/friend/${friend.id}`)
              }
            />
          ))}
        </View>

        {/* Recent activity */}
        <SectionTitle title="Recent Activity" />
        {data.activities.length === 0 ? (
          <EmptyState
            emoji="🌙"
            title="Quiet in the universe so far"
            subtitle="Check in, log a meal or add a trend — it will show up here."
          />
        ) : (
          <RoundedCard style={styles.activityCard}>
            {data.activities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                isLast={index === data.activities.length - 1}
                onPress={() => {
                  // Navigate based on activity type
                  switch (activity.type) {
                    case 'meal':
                      // Show meal detail modal if we have a reference
                      if (activity.reference_id) {
                        setMealDetailId(activity.reference_id);
                      } else {
                        router.push('/(tabs)/self-love');
                      }
                      break;
                    case 'checkin':
                    case 'water_goal':
                    case 'step_goal':
                      router.push('/(tabs)/self-love');
                      break;
                    case 'trend_added':
                    case 'trend_done':
                      router.push('/(tabs)/trends');
                      break;
                    case 'miko':
                      router.push('/(tabs)/mikrokosmos');
                      break;
                    default:
                      // memory, achievement, streak — no specific page
                      break;
                  }
                }}
              />
            ))}
          </RoundedCard>
        )}

        <View style={styles.bottomGap} />
      </ScrollView>

      {profile ? (
        <MorningCheckinModal
          visible={checkinOpen}
          profile={profile}
          onSubmit={handleCheckin}
        />
      ) : null}

      <MealDetailModal
        mealId={mealDetailId}
        visible={mealDetailId !== null}
        onClose={() => setMealDetailId(null)}
      />
    </Screen>
  );
}

function FriendCard({
  friend,
  data,
  isMe,
  onPress,
}: {
  friend: Profile;
  data: HomeData;
  isMe: boolean;
  onPress: () => void;
}) {
  const { theme, palette } = useAppTheme();
  const checkin = data.checkins[friend.id];
  const progress = friendPerformance(data, friend.id);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <RoundedCard style={styles.friendCard}>
        <Avatar profile={friend} size={48} />
        <View style={styles.friendInfo}>
          <View style={styles.friendTitleRow}>
            <Text style={[styles.friendName, { color: palette.text }]}>
              {friend.emoji} {friend.display_name}
              {isMe ? ' (you)' : ''}
            </Text>
            {checkin ? (
              <Text style={styles.moodEmoji}>{moodMeta(checkin.mood).emoji}</Text>
            ) : null}
          </View>
          <Text style={[styles.friendMeta, { color: palette.textSecondary }]}>
            {checkin
              ? `Wake Up: ${shortTime(checkin.wake_up_time)} · Mood: ${moodMeta(checkin.mood).label}`
              : 'Still drifting in dreamland ☁️'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: theme.primary },
              ]}
            />
          </View>
        </View>
        <View style={styles.progressLabelWrap}>
          <Text style={[styles.progressLabel, { color: theme.accent }]}>{progress}%</Text>
        </View>
      </RoundedCard>
    </Pressable>
  );
}

function ActivityRow({ activity, isLast, onPress }: { activity: Activity; isLast: boolean; onPress: () => void }) {
  const { theme, palette } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.activityRow,
        !isLast && { borderBottomColor: palette.border, borderBottomWidth: 1 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.activityIcon, { backgroundColor: theme.light }]}>
        <Text style={styles.activityEmoji}>{ACTIVITY_ICONS[activity.type] ?? '✨'}</Text>
      </View>
      <Text style={[styles.activityText, { color: palette.text }]}>{activity.text}</Text>
      <Text style={[styles.activityTime, { color: palette.textFaint }]}>
        {relativeTime(activity.created_at)}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={palette.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexGrow: 1,
  },
  greeting: {
    padding: 22,
  },
  greetingTitle: {
    fontSize: 23,
    fontWeight: '800',
  },
  greetingSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  greetingDate: {
    fontSize: 13,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  friendColumn: {
    gap: 10,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  friendInfo: {
    flex: 1,
    gap: 4,
  },
  friendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '800',
  },
  moodEmoji: {
    fontSize: 16,
  },
  friendMeta: {
    fontSize: 12.5,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelWrap: {
    width: 44,
    alignItems: 'flex-end',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  activityCard: {
    padding: 6,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmoji: {
    fontSize: 15,
  },
  activityText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomGap: {
    height: 120,
  },
});
