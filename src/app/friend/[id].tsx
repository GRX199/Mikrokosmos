import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { ProgressRing } from '@/components/ProgressRing';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { themeFor, moodMeta, mealMeta, performanceTier, RADIUS, useAppTheme } from '@/core/theme';
import { formatNumber, shortTime, todayKey } from '@/core/utils/date';
import type { DailyCheckin, Meal, PrivacySettings, Profile } from '@/models';
import { fetchCheckin, fetchUserCheckins } from '@/repositories/checkins';
import { fetchMealsForDate } from '@/repositories/meals';
import { fetchGoals, fetchPrivacy, fetchProfile } from '@/repositories/profiles';
import { fetchDayStats } from '@/repositories/waterSteps';
import { computePerformance } from '@/services/performance';
import { computeStreak } from '@/services/streak';

/** Friend profile — today's mood, progress and streak, privacy-aware (spec §27). */
export default function FriendScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useAppTheme();

  const [friend, setFriend] = useState<Profile | null>(null);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [water, setWater] = useState(0);
  const [steps, setSteps] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const date = todayKey();

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [profile, todayCheckin, history, goals, dayStats, privacySettings] = await Promise.all([
        fetchProfile(id),
        fetchCheckin(id, date),
        fetchUserCheckins(id),
        fetchGoals(id),
        fetchDayStats(date),
        fetchPrivacy(id),
      ]);
      if (!profile) throw new Error('Friend not found.');
      setFriend(profile);
      setCheckin(todayCheckin);
      setStreak(computeStreak(history));
      setWater(dayStats.water[id] ?? 0);
      setSteps(dayStats.steps[id] ?? 0);
      setPrivacy(privacySettings);

      // Meals may be RLS-hidden — never fail the whole screen over them.
      const mealList =
        privacySettings.meals_visibility === 'friends'
          ? await fetchMealsForDate(id, date).catch(() => [] as Meal[])
          : [];
      setMeals(mealList);

      setScore(
        computePerformance({
          checkin: todayCheckin,
          meals: mealList,
          glasses: dayStats.water[id] ?? 0,
          steps: dayStats.steps[id] ?? 0,
          goals,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this profile.');
    } finally {
      setLoading(false);
    }
  }, [id, date]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingView label="Visiting your friend…" />;
  if (error || !friend) return <ErrorState message={error ?? undefined} onRetry={() => router.back()} />;

  const friendTheme = themeFor(friend.theme);
  const tier = score !== null ? performanceTier(score) : null;
  const mealsVisible = privacy?.meals_visibility !== 'only_me';
  const caloriesVisible = privacy?.calories_visibility !== 'only_me';
  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            Friend
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Identity — colored with the FRIEND's theme, not yours */}
        <RoundedCard style={[styles.identityCard, { backgroundColor: friendTheme.light }]}>
          <Avatar profile={friend} size={72} />
          <Text style={[styles.name, { color: palette.text }]}>
            {friend.emoji} {friend.display_name}
          </Text>
          <Text style={[styles.username, { color: palette.textSecondary }]}>@{friend.username}</Text>
          {friend.bio ? (
            <Text style={[styles.bio, { color: palette.textSecondary }]}>{friend.bio}</Text>
          ) : null}
          <View style={[styles.streakChip, { backgroundColor: palette.card }]}>
            <Text style={[styles.streakText, { color: friendTheme.accent }]}>
              🔥 {streak} day streak
            </Text>
          </View>
        </RoundedCard>

        {/* Today */}
        <SectionTitle title="Today" />
        <RoundedCard>
          <View style={styles.todayRow}>
            <View style={styles.todayItem}>
              <Text style={styles.todayEmoji}>⏰</Text>
              <Text style={[styles.todayValue, { color: palette.text }]}>
                {checkin?.wake_up_time ? shortTime(checkin.wake_up_time) : '—'}
              </Text>
              <Text style={[styles.todayLabel, { color: palette.textSecondary }]}>Wake up</Text>
            </View>
            <View style={styles.todayItem}>
              <Text style={styles.todayEmoji}>{checkin ? moodMeta(checkin.mood).emoji : '🌙'}</Text>
              <Text style={[styles.todayValue, { color: palette.text }]}>
                {checkin ? moodMeta(checkin.mood).label : 'Not yet'}
              </Text>
              <Text style={[styles.todayLabel, { color: palette.textSecondary }]}>Mood</Text>
            </View>
            <View style={styles.todayItem}>
              <Text style={styles.todayEmoji}>{tier?.emoji ?? '🌱'}</Text>
              <Text style={[styles.todayValue, { color: palette.text }]}>{score ?? 0}%</Text>
              <Text style={[styles.todayLabel, { color: palette.textSecondary }]}>
                {tier?.label ?? 'Starting'}
              </Text>
            </View>
          </View>
          {!checkin ? (
            <Text style={[styles.notCheckedIn, { color: palette.textFaint }]}>
              {friend.display_name} hasn't started their day yet — maybe a little hype in the chat? 💬
            </Text>
          ) : null}
        </RoundedCard>

        {/* Progress rings */}
        <SectionTitle title="Progress" />
        <RoundedCard>
          <View style={styles.ringRow}>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={caloriesVisible && mealsVisible && calories > 0 ? Math.min(1, calories / 1600) : 0}
                size={74}
                label={mealsVisible && caloriesVisible ? formatNumber(calories) : '🔒'}
                sublabel={mealsVisible && caloriesVisible ? 'kcal' : 'private'}
                color={friendTheme.primary}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Calories</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={Math.min(1, water / 8)}
                size={74}
                label={`${water}`}
                sublabel="glasses"
                color={friendTheme.primary}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Water</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={Math.min(1, steps / 8000)}
                size={74}
                label={formatNumber(steps)}
                sublabel="steps"
                color={friendTheme.primary}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Steps</Text>
            </View>
          </View>
        </RoundedCard>

        {/* Meals — hidden entirely when privacy says Only Me */}
        <SectionTitle title="Meals" />
        {mealsVisible ? (
          meals.length === 0 ? (
            <RoundedCard>
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                Nothing logged yet today 🌱
              </Text>
            </RoundedCard>
          ) : (
            meals.map((meal) => (
              <RoundedCard key={meal.id} style={styles.mealRow}>
                <Text style={styles.mealEmoji}>{mealMeta(meal.meal_type).emoji}</Text>
                <View style={styles.mealTextWrap}>
                  <Text style={[styles.mealName, { color: palette.text }]}>{meal.meal_name}</Text>
                  <Text style={[styles.mealMetaText, { color: palette.textFaint }]}>
                    {mealMeta(meal.meal_type).label} · {shortTime(meal.meal_time)}
                  </Text>
                </View>
                {caloriesVisible && meal.calories != null ? (
                  <Text style={[styles.mealCalories, { color: friendTheme.accent }]}>
                    {meal.calories} kcal
                  </Text>
                ) : null}
              </RoundedCard>
            ))
          )
        ) : (
          <RoundedCard tinted>
            <Text style={[styles.privateText, { color: palette.textSecondary }]}>
              🔒 {friend.display_name} keeps their meals private — and that's perfectly okay.
            </Text>
          </RoundedCard>
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
  identityCard: { alignItems: 'center', paddingVertical: 26, marginBottom: 20 },
  name: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  username: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  streakChip: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill },
  streakText: { fontSize: 12, fontWeight: '700' },
  todayRow: { flexDirection: 'row' },
  todayItem: { flex: 1, alignItems: 'center', gap: 3 },
  todayEmoji: { fontSize: 22 },
  todayValue: { fontSize: 14, fontWeight: '800' },
  todayLabel: { fontSize: 11 },
  notCheckedIn: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  ringRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ringItem: { alignItems: 'center', gap: 6 },
  ringLabel: { fontSize: 11, fontWeight: '600' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  mealEmoji: { fontSize: 22 },
  mealTextWrap: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '700' },
  mealMetaText: { fontSize: 12, marginTop: 2 },
  mealCalories: { fontSize: 13, fontWeight: '800' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  privateText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  bottomGap: { height: 24 },
});
