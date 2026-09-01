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
import { useI18n } from '@/core/i18n';
import { formatNumber, shortTime, todayKey } from '@/core/utils/date';
import type { BodyMetrics, DailyCheckin, Goals, Meal, Profile } from '@/models';
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
import { fetchBodyMetrics, upsertBodyMetrics } from '@/repositories/bodyMetrics';
import { sendMikoMessage } from '@/repositories/chat';
import { mikoLine } from '@/services/miko';
import { computePerformance } from '@/services/performance';
import { computeBodyInsights } from '@/services/bodyInsights';
import { useAuth } from '@/features/auth/SessionProvider';
import { AddMealModal } from '@/features/selfLove/AddMealModal';
import { BodyMetricsModal } from '@/features/selfLove/BodyMetricsModal';
import { cancelNudge, scheduleNudge } from '@/services/nudges';

/** Self Love — health & diet space with gentle wording (spec sections 11-18). */
export default function SelfLoveScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const { t, language } = useI18n();
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
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics | null>(null);
  const [bodyModalOpen, setBodyModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const [mealList, glasses, stepCount, goalList, todayCheckin, allProfiles, myBody] =
        await Promise.all([
          fetchMealsForDate(profile.id, date),
          fetchWater(profile.id, date),
          fetchSteps(profile.id, date),
          fetchGoals(profile.id),
          fetchCheckin(profile.id, date),
          fetchProfiles(),
          fetchBodyMetrics(profile.id).catch(() => null),
        ]);
      setMeals(mealList);
      setWaterCount(glasses);
      setStepCount(stepCount);
      setStepDraft(String(stepCount || ''));
      setGoalsState(goalList);
      setCheckin(todayCheckin);
      setProfiles(allProfiles);
      setBodyMetrics(myBody);

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
      setError(e instanceof Error ? e.message : t('Could not load your self love space.'));
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

  if (loading && !goals) return <LoadingView label={t('Preparing your self love space…')} />;
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
  // Smart target: from body metrics when set, else the static goal.
  const bodyInsights = bodyMetrics ? computeBodyInsights(bodyMetrics) : null;
  const smartGoal = bodyInsights?.targetCalories ?? goals.calorie_goal;

  // ---------- Actions ----------

  async function adjustWater(delta: number) {
    if (!profile) return;
    const next = Math.max(0, water + delta);
    setWaterCount(next);
    await setWater(profile.id, date, next);
    // Water nudges: halfway → gentle sip; goal reached → nothing more today.
    cancelNudge('water_early').catch(() => undefined);
    cancelNudge('water_goal').catch(() => undefined);
    if (delta > 0 && next === goals!.water_goal) {
      await logActivity(profile.id, 'water_goal', `${profile.display_name} completed today's water goal 💧`);
      await sendMikoMessage(mikoLine('goal_completed', profile, language));
    } else if (delta > 0 && next === goals!.water_goal - 1) {
      // One glass left — remind her softly in ~45 minutes.
      const at = new Date(Date.now() + 45 * 60 * 1000);
      scheduleNudge('water_goal', language, at).catch(() => undefined);
    }
  }

  async function saveSteps() {
    if (!profile) return;
    const next = Number(stepDraft.replace(/[^0-9]/g, '')) || 0;
    setStepCount(next);
    await setSteps(profile.id, date, next);
    if (next >= goals!.step_goal && steps < goals!.step_goal) {
      await logActivity(profile.id, 'step_goal', `${profile.display_name} reached their step goal 👟`);
      await sendMikoMessage(mikoLine('goal_completed', profile, language));
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
      const newMeal = await createMeal(profile.id, date, { ...input, image_url: imagePath });
      await logActivity(
        profile.id,
        'meal',
        `${profile.display_name} added ${input.meal_name} ${mealMeta(input.meal_type).emoji}`,
        newMeal.id // reference to the meal for detail view
      );
    }
    setEditingMeal(null);
    await load();
  }

  async function handleSaveBody(patch: Partial<Omit<BodyMetrics, 'user_id'>>) {
    if (!profile) return;
    const saved = await upsertBodyMetrics(profile.id, patch);
    setBodyMetrics(saved);
  }

  function confirmDeleteMeal(meal: Meal) {
    Alert.alert(t('Remove this meal?'), meal.meal_name, [
      { text: t('Keep it'), style: 'cancel' },
      {
        text: t('Remove'),
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
        <Text style={[styles.header, { color: palette.text }]}>{t("Today's Self Love 💗")}</Text>
        <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
          {t('Small acts of care, one day at a time.')}
        </Text>

        {/* Overview rings */}
        <RoundedCard style={styles.overviewCard}>
          <View style={styles.ringRow}>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={smartGoal ? calories / smartGoal : 0}
                size={78}
                label={`${formatNumber(calories)}`}
                sublabel={`of ${formatNumber(smartGoal)}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>{t('Calories')}</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={goals.water_goal ? water / goals.water_goal : 0}
                size={78}
                label={`${water}`}
                sublabel={`of ${goals.water_goal}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>{t('Water')}</Text>
            </View>
            <View style={styles.ringItem}>
              <ProgressRing
                progress={goals.step_goal ? steps / goals.step_goal : 0}
                size={78}
                label={`${formatNumber(steps)}`}
                sublabel={`of ${formatNumber(goals.step_goal)}`}
              />
              <Text style={[styles.ringLabel, { color: palette.textSecondary }]}>{t('Steps')}</Text>
            </View>
          </View>
          <View style={[styles.overviewRow, { backgroundColor: theme.light }]}>
            <Text style={[styles.overviewText, { color: theme.accent }]}>
              ⏰ {t('Wake Up')}: {checkin ? shortTime(checkin.wake_up_time) : '—'}
            </Text>
            <Text style={[styles.overviewText, { color: theme.accent }]}>
              {checkin
                ? `${moodMeta(checkin.mood).emoji} ${t(moodMeta(checkin.mood).label)}`
                : t('😊 Check in to share your mood')}
            </Text>
          </View>
        </RoundedCard>

        {/* Smart body insights (private) */}
        {bodyInsights && bodyInsights.targetCalories ? (
          <Pressable onPress={() => setBodyModalOpen(true)}>
            <RoundedCard style={styles.bodyCard} tinted>
              <View style={styles.bodyHeader}>
                <Text style={[styles.bodyTitle, { color: palette.text }]}>{t('My Body 🌸')}</Text>
                {bodyInsights.estimatedDays ? (
                  <View style={[styles.bodyBadge, { backgroundColor: theme.light }]}>
                    <Text style={[styles.bodyBadgeText, { color: theme.accent }]}>
                      ~{bodyInsights.estimatedDays} {t('days to healthy range')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.bodyStatsRow}>
                <View style={styles.bodyStat}>
                  <Text style={[styles.bodyStatValue, { color: theme.accent }]}>
                    {formatNumber(bodyInsights.targetCalories)}
                  </Text>
                  <Text style={[styles.bodyStatLabel, { color: palette.textSecondary }]}>
                    {t('kcal target')}
                  </Text>
                </View>
                <View style={styles.bodyStat}>
                  <Text style={[styles.bodyStatValue, { color: theme.accent }]}>
                    {bodyInsights.bmi}
                  </Text>
                  <Text style={[styles.bodyStatLabel, { color: palette.textSecondary }]}>
                    BMI {bodyInsights.bmiEmoji}
                  </Text>
                </View>
                <View style={styles.bodyStat}>
                  <Text style={[styles.bodyStatValue, { color: theme.accent }]}>
                    {bodyInsights.weeklyRateKg > 0 ? `−${bodyInsights.weeklyRateKg}` : '🌱'}
                  </Text>
                  <Text style={[styles.bodyStatLabel, { color: palette.textSecondary }]}>
                    {bodyInsights.weeklyRateKg > 0 ? t('kg / week') : t('maintaining')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.bodyNote, { color: palette.textFaint }]}>
                {t('Tap to adjust your numbers — private, always 💗')}
              </Text>
            </RoundedCard>
          </Pressable>
        ) : (
          <Pressable onPress={() => setBodyModalOpen(true)}>
            <RoundedCard style={styles.bodyCard} tinted>
              <Text style={[styles.bodyTitle, { color: palette.text }]}>{t('Smart calorie target ✨')}</Text>
              <Text style={[styles.bodyNote, { color: palette.textSecondary }]}>
                {t(
                  "Add your height, weight and goal — we'll compute a kind daily target just for you (only you can see it).",
                )}
              </Text>
            </RoundedCard>
          </Pressable>
        )}

        {/* Water tracker */}
        <SectionTitle title={t('💧 Water')} />
        <RoundedCard>
          <Text style={[styles.waterCount, { color: palette.text }]}>
            {water} / {goals.water_goal} {t('glasses')}
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
              <Text style={[styles.waterButtonText, { color: palette.textSecondary }]}>− {t('Remove')}</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustWater(1)}
              style={[styles.waterButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={[styles.waterButtonText, { color: palette.white }]}>+ {t('1 Glass')}</Text>
            </Pressable>
          </View>
        </RoundedCard>

        {/* Steps */}
        <SectionTitle title={t('👟 Steps')} />
        <RoundedCard>
          <Text style={[styles.stepsCount, { color: palette.text }]}>
            {formatNumber(steps)} / {formatNumber(goals.step_goal)} {t('steps')}
          </Text>
          <View style={styles.stepInputRow}>
            <SoftInput
              placeholder={t("Enter today's steps")}
              keyboardType="numeric"
              value={stepDraft}
              onChangeText={setStepDraft}
              containerStyle={styles.flex}
            />
            <Pressable onPress={saveSteps} style={[styles.stepSave, { backgroundColor: theme.primary }]}>
              <Text style={[styles.stepSaveText, { color: palette.white }]}>{t('Save')}</Text>
            </Pressable>
          </View>
          <Text style={[styles.stepNote, { color: palette.textFaint }]}>
            {t('Apple Health & Google Health Connect coming later ✨')}
          </Text>
        </RoundedCard>

        {/* Performance */}
        <SectionTitle title={t("Today's Performance")} />
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
              {tier.emoji} {t(tier.label)}
            </Text>
            <Text style={[styles.tierSub, { color: palette.textSecondary }]}>
              {t('Every little thing you did today counts.')}
            </Text>
          </View>
        </RoundedCard>

        {/* Food diary */}
        <SectionTitle
          title={t('Food Diary')}
          actionLabel={t('+ Add Meal')}
          onAction={() => {
            setEditingMeal(null);
            setMealModalOpen(true);
          }}
        />
        {meals.length === 0 ? (
          <EmptyState
            emoji="🍓"
            title={t('Nothing logged yet')}
            subtitle={t('Your tummy deserves a spotlight. Add your first meal!')}
            actionLabel={t('+ Add Meal')}
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
                    style={[styles.diaryThumbnail, { backgroundColor: palette.overlay }]}
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
                    {t(mealMeta(meal.meal_type).label)} · {shortTime(meal.meal_time)}
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
              <Text style={[styles.diaryTotalLabel, { color: theme.accent }]}>{t("Today's Total")}</Text>
              <Text style={[styles.diaryTotalValue, { color: theme.accent }]}>
                {formatNumber(calories)} / {formatNumber(smartGoal)} kcal
              </Text>
            </View>
          </RoundedCard>
        )}

        {/* Group progress */}
        <SectionTitle title={t('Our Group Progress')} />
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
              ? t("We're doing great today! ✨")
              : t('Growing together, one small step at a time 🌿')}
          </Text>
        </RoundedCard>

        <View style={styles.bottomGap} />
      </ScrollView>

      <BodyMetricsModal
        visible={bodyModalOpen}
        metrics={bodyMetrics}
        onClose={() => setBodyModalOpen(false)}
        onSave={handleSaveBody}
      />

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
  bodyCard: { marginTop: 16, padding: 16 },
  bodyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  bodyTitle: { fontSize: 16, fontWeight: '800' },
  bodyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bodyBadgeText: { fontSize: 11, fontWeight: '700' },
  bodyStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bodyStat: { flex: 1, alignItems: 'center', gap: 2 },
  bodyStatValue: { fontSize: 20, fontWeight: '800' },
  bodyStatLabel: { fontSize: 11 },
  bodyNote: { fontSize: 11.5, fontStyle: 'italic' },
});
