import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { ProgressRing } from '@/components/ProgressRing';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SoftInput } from '@/components/SoftInput';
import { mealMeta, moodMeta, performanceTier, useAppTheme } from '@/core/theme';
import { formatNumber, shortTime, todayKey } from '@/core/utils/date';
import type { DailyCheckin, Goals, Meal, Profile } from '@/models';
import { fetchCheckin } from '@/repositories/checkins';
import {
  createMeal,
  deleteMeal,
  fetchMealsForDate,
  updateMeal,
  type MealInput,
} from '@/repositories/meals';
import { fetchGoals, fetchProfiles } from '@/repositories/profiles';
import { logActivity } from '@/repositories/activities';
import { uploadImage, resolveMediaUrl } from '@/repositories/storage';
import { fetchWater, setWater, setSteps, fetchSteps, fetchDayStats } from '@/repositories/waterSteps';
import { sendMikoMessage } from '@/repositories/chat';
import { mikoLine } from '@/services/miko';
import { computePerformance } from '@/services/performance';
import { useAuth } from '@/features/auth/SessionProvider';
import { AddMealModal } from '@/features/selfLove/AddMealModal';

/** Self Love — health & diet space with gentle wording (spec sections 11-18). */
export default function SelfLoveScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const date = todayKey();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [water, setWaterCount] = useState(0);
  const [steps, setStepCount] = useState(0);
  const [goals, setGoalsState] = useState<Goals | null>(null);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groupScores, setGroupScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [stepDraft, setStepDraft] = useState('');
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const [mealList, glasses, stepCount, goalList, todayCheckin, allProfiles] =
        await Promise.all([
          fetchMealsForDate(profile.id, date),
          fetchWater(profile.id, date),
          fetchSteps(profile.id, date),
          fetchGoals(profile.id),
          fetchCheckin(profile.id, date),
          fetchProfiles(),
        ]);
      setMeals(mealList);
      setWaterCount(glasses);
      setStepCount(stepCount);
      setStepDraft(String(stepCount || ''));
      setGoalsState(goalList);
      setCheckin(todayCheckin);
      setProfiles(allProfiles);

      // Group progress: average of each friend's performance (no ranking).
      const dayStats = await fetchDayStats(date);
      const scores = await Promise.all(
        allProfiles.map(async (p) => {
          const [pc, pm, pg] = await Promise.all([
            fetchCheckin(p.id, date),
            fetchMealsForDate(p.id, date).catch(() => [] as Meal[]),
            fetchGoals(p.id),
          ]);
          return computePerformance({
            checkin: pc,
            meals: pm,
            glasses: dayStats.water[p.id] ?? 0,
            steps: dayStats.steps[p.id] ?? 0,
            goals: pg,
          });
        })
      );
      setGroupScores(scores);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your self love space.');
    } finally {
      setLoading(false);
    }
  }, [profile, date]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve image URLs for food diary thumbnails
  useEffect(() => {
    async function resolveImages() {
      const map: Record<string, string> = {};
      for (const meal of meals) {
        if (meal.image_url && !resolvedImages[meal.id]) {
          const url = await resolveMediaUrl(meal.image_url);
          if (url) map[meal.id] = url;
        }
      }
      if (Object.keys(map).length > 0) {
        setResolvedImages((prev) => ({ ...prev, ...map }));
      }
    }
    if (meals.length > 0) {
      void resolveImages();
    }
  }, [meals]);

  if (loading && !goals) return <LoadingView label="Preparing your self love space…" />;
  if (error && !goals) return <ErrorState message={error} onRetry={load} />;
  if (!profile || !goals) return null;

  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const score = computePerformance({
    checkin,
    meals,
    glasses: water,
    steps,
    goals,
  });
  const tier = performanceTier(score);
  const groupAverage = groupScores.length
    ? Math.round(groupScores.reduce((a, b) => a + b, 0) / groupScores.length)
    : 0;

  // ---------- Actions ----------

  async function adjustWater(delta: number) {
    if (!profile) return;
    const next = Math.max(0, water + delta);
    setWaterCount(next);
    await setWater(profile.id, date, next);
    if (delta > 0 && next === goals!.water_goal) {
      await logActivity(profile.id, 'water_goal', `${profile.display_name} completed today's water goal 💧`);
      await sendMikoMessage(mikoLine('goal_completed', profile));
    }
  }

  async function saveSteps() {
    if (!profile) return;
    const next = Number(stepDraft.replace(/[^0-9]/g, '')) || 0;
    setStepCount(next);
    await setSteps(profile.id, date, next);
    if (next >= goals!.step_goal && steps < goals!.step_goal) {
      await logActivity(profile.id, 'step_goal', `${profile.display_name} reached their step goal 👟`);
      await sendMikoMessage(mikoLine('goal_completed', profile));
    }
  }

  async function handleSaveMeal(input: MealInput, localImageUri: string | null) {
    if (!profile) return;
    let imagePath: string | null = null;
    if (localImageUri && !editingMeal) {
      imagePath = await uploadImage(profile.id, localImageUri, 'meals');
    } else if (editingMeal) {
      imagePath = editingMeal.image_url ?? null;
    }
    if (editingMeal) {
      await updateMeal(editingMeal.id, { ...input, image_url: imagePath });
    } else {
      await createMeal(profile.id, date, { ...input, image_url: imagePath });
      await logActivity(
        profile.id,
        'meal',
        `${profile.display_name} added ${input.meal_name} ${mealMeta(input.meal_type).emoji}`
      );
    }
    setEditingMeal(null);
    await load();
  }

  function confirmDeleteMeal(meal: Meal) {
    Alert.alert('Remove this meal?', meal.meal_name, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(meal.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.accent}
            colors={[theme.primary]}
          />
        }
      >
        <Text style={[styles.header, { color: palette.text }]}>Today's Self Love 💗</Text>
        <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
          Small acts of care, one day at a time.
        </Text>

        {/* Overview rings */}
        <RoundedCard style={styles.overviewCard}>
          <View style={styles.ringRow}>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={goals.calorie_goal ? calories / goals.calorie_goal : 0}
                size={78}
                label={`${formatNumber(calories)}`}
                sublabel={`of ${formatNumber(goals.calorie_goal)}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Calories</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={goals.water_goal ? water / goals.water_goal : 0}
                size={78}
                label={`${water}`}
                sublabel={`of ${goals.water_goal}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Water</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={goals.step_goal ? steps / goals.step_goal : 0}
                size={78}
                label={`${formatNumber(steps)}`}
                sublabel={`of ${formatNumber(goals.step_goal)}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>Steps</Text>
            </View>
          </View>
          <View style={[styles.overviewRow, { backgroundColor: theme.light }]}>
            <Text style={[styles.overviewText, { color: theme.accent }]}>
              ⏰ Wake Up: {checkin ? shortTime(checkin.wake_up_time) : '—'}
            </Text>
            <Text style={[styles.overviewText, { color: theme.accent }]}>
              {checkin ? `${moodMeta(checkin.mood).emoji} ${moodMeta(checkin.mood).label}` : '😊 Check in to share your mood'}
            </Text>
          </View>
        </RoundedCard>

        {/* Water tracker */}
        <SectionTitle title="💧 Water" />
        <RoundedCard>
          <Text style={[styles.waterCount, { color: palette.text }]}>
            {water} / {goals.water_goal} glasses
          </Text>
          <View style={styles.glassRow}>
            {Array.from({ length: goals.water_goal }).map((_, i) => (
              <Text key={i} style={[styles.glass, { opacity: i < water ? 1 : 0.22 }]}>
                💧
              </Text>
            ))}
          </View>
          <View style={styles.waterButtons}>
            <Pressable
              onPress={() => adjustWater(-1)}
              style={[styles.waterButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.waterButtonText, { color: palette.textSecondary }]}>− Remove</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustWater(1)}
              style={[styles.waterButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={[styles.waterButtonText, { color: palette.white }]}>+ 1 Glass</Text>
            </Pressable>
          </View>
        </RoundedCard>

        {/* Steps */}
        <SectionTitle title="👟 Steps" />
        <RoundedCard>
          <Text style={[styles.stepsCount, { color: palette.text }]}>
            {formatNumber(steps)} / {formatNumber(goals.step_goal)} steps
          </Text>
          <View style={styles.stepInputRow}>
            <SoftInput
              placeholder="Enter today's steps"
              keyboardType="numeric"
              value={stepDraft}
              onChangeText={setStepDraft}
              containerStyle={styles.flex}
            />
            <Pressable onPress={saveSteps} style={[styles.stepSave, { backgroundColor: theme.primary }]}>
              <Text style={[styles.stepSaveText, { color: palette.white }]}>Save</Text>
            </Pressable>
          </View>
          <Text style={[styles.stepNote, { color: palette.textFaint }]}>
            Apple Health & Google Health Connect coming later ✨
          </Text>
        </RoundedCard>

        {/* Performance */}
        <SectionTitle title="Today's Performance" />
        <RoundedCard style={styles.performanceCard}>
          <ProgressRing
            progress={score / 100}
            size={104}
            strokeWidth={10}
            label={`${score}`}
            sublabel="/ 100"
          />
          <View style={styles.performanceInfo}>
            <Text style={[styles.tierLabel, { color: theme.accent }]}>
              {tier.emoji} {tier.label}
            </Text>
            <Text style={[styles.tierSub, { color: palette.textSecondary }]}>
              Every little thing you did today counts.
            </Text>
          </View>
        </RoundedCard>

        {/* Food diary */}
        <SectionTitle
          title="Food Diary"
          actionLabel="+ Add Meal"
          onAction={() => {
            setEditingMeal(null);
            setMealModalOpen(true);
          }}
        />
        {meals.length === 0 ? (
          <EmptyState
            emoji="🍓"
            title="Nothing logged yet"
            subtitle="Your tummy deserves a spotlight. Add your first meal!"
            actionLabel="+ Add Meal"
            onAction={() => setMealModalOpen(true)}
          />
        ) : (
          <RoundedCard style={styles.diaryCard}>
            {meals.map((meal, index) => (
              <Pressable
                key={meal.id}
                onLongPress={() => confirmDeleteMeal(meal)}
                onPress={() => {
                  setEditingMeal(meal);
                  setMealModalOpen(true);
                }}
                style={[
                  styles.diaryRow,
                  index !== meals.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
              >
                {resolvedImages[meal.id] ? (
                  <Image
                    source={{ uri: resolvedImages[meal.id] }}
                    style={styles.diaryThumbnail}
                  />
                ) : (
                  <View style={[styles.diaryIcon, { backgroundColor: theme.light }]}>
                    <Text>{mealMeta(meal.meal_type).emoji}</Text>
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={[styles.diaryTitle, { color: palette.text }]}>
                    {meal.meal_name}
                  </Text>
                  <Text style={[styles.diaryMeta, { color: palette.textSecondary }]}>
                    {mealMeta(meal.meal_type).label} · {shortTime(meal.meal_time)}
                    {meal.notes ? ` · ${meal.notes}` : ''}
                  </Text>
                </View>
                <Text style={[styles.diaryKcal, { color: theme.accent }]}>
                  {meal.calories != null ? `${formatNumber(meal.calories)} kcal` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
              </Pressable>
            ))}
            <View style={[styles.diaryTotalRow, { backgroundColor: theme.light }]}>
              <Text style={[styles.diaryTotalLabel, { color: theme.accent }]}>Today's Total</Text>
              <Text style={[styles.diaryTotalValue, { color: theme.accent }]}>
                {formatNumber(calories)} / {formatNumber(goals.calorie_goal)} kcal
              </Text>
            </View>
          </RoundedCard>
        )}

        {/* Group progress */}
        <SectionTitle title="Our Group Progress" />
        <RoundedCard style={styles.groupCard} tinted>
          <Text style={[styles.groupScore, { color: theme.accent }]}>{groupAverage}%</Text>
          <View style={styles.groupRow}>
            {profiles.map((friend, i) => (
              <View key={friend.id} style={styles.groupFriend}>
                <Avatar profile={friend} size={46} />
                <Text style={[styles.groupFriendScore, { color: palette.text }]}>
                  {groupScores[i] ?? 0}%
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.groupMessage, { color: palette.textSecondary }]}>
            {groupAverage >= 70
              ? "We're doing great today! ✨"
              : 'Growing together, one small step at a time 🌿'}
          </Text>
        </RoundedCard>

        <View style={styles.bottomGap} />
      </ScrollView>

      <AddMealModal
        visible={mealModalOpen}
        initial={editingMeal}
        onClose={() => {
          setMealModalOpen(false);
          setEditingMeal(null);
        }}
        onSave={handleSaveMeal}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexGrow: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  overviewCard: {
    gap: 14,
  },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ringItem: {
    alignItems: 'center',
    gap: 6,
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  overviewText: {
    fontSize: 13,
    fontWeight: '700',
  },
  waterCount: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  glassRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  glass: {
    fontSize: 22,
  },
  waterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  waterButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
  },
  waterButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepsCount: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  stepInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  stepSave: {
    borderRadius: 14,
    paddingHorizontal: 20,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSaveText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepNote: {
    fontSize: 11.5,
    marginTop: 8,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  performanceInfo: {
    flex: 1,
    gap: 4,
  },
  tierLabel: {
    fontSize: 19,
    fontWeight: '800',
  },
  tierSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  diaryCard: {
    padding: 8,
  },
  diaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  diaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  diaryTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  diaryMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  diaryKcal: {
    fontSize: 13,
    fontWeight: '800',
  },
  diaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    margin: 6,
  },
  diaryTotalLabel: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  diaryTotalValue: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  groupCard: {
    alignItems: 'center',
    gap: 12,
  },
  groupScore: {
    fontSize: 40,
    fontWeight: '800',
  },
  groupRow: {
    flexDirection: 'row',
    gap: 22,
  },
  groupFriend: {
    alignItems: 'center',
    gap: 4,
  },
  groupFriendScore: {
    fontSize: 12,
    fontWeight: '800',
  },
  groupMessage: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  bottomGap: {
    height: 130,
  },
});
