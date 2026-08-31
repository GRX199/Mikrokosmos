import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { RADIUS, moodMeta, useAppTheme } from '@/core/theme';
import { monthYear, todayKey } from '@/core/utils/date';
import type { Activity, Profile } from '@/models';
import { fetchHistoryRange, type DayHistory } from '@/repositories/history';
import { fetchProfiles } from '@/repositories/profiles';
import { useAuth } from '@/features/auth/SessionProvider';

/**
 * Activity calendar (Phase 2): a month grid where every past day glows
 * by how alive it was, plus a detail card for the selected day.
 * Philosophy: no judgment — quiet days are just rest days 🌙
 */
export default function CalendarScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const router = useRouter();

  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [selected, setSelected] = useState<string>(todayKey());
  const [history, setHistory] = useState<DayHistory[] | null>(null);
  const [activitiesByDay, setActivitiesByDay] = useState<Record<string, Activity[]>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const monthWindow = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const y = base.getFullYear();
    const m = base.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const key = (d: Date) => {
      const mm = `${d.getMonth() + 1}`.padStart(2, '0');
      const dd = `${d.getDate()}`.padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    };
    return {
      year: y,
      month: m,
      firstKey: key(first),
      lastKey: key(last),
      daysInMonth: last.getDate(),
      firstWeekday: first.getDay(), // 0 = Sunday
      label: monthYear(first),
    };
  }, [monthOffset]);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const [range, allProfiles] = await Promise.all([
        fetchHistoryRange(monthWindow.firstKey, monthWindow.lastKey),
        fetchProfiles(),
      ]);
      setHistory(range.days);
      setActivitiesByDay(range.activitiesByDay);
      setProfiles(allProfiles);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the calendar.');
    } finally {
      setLoading(false);
    }
  }, [profile, monthWindow]);

  useEffect(() => {
    load();
  }, [load]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayHistory>();
    for (const day of history ?? []) map.set(day.date, day);
    return map;
  }, [history]);

  const selectedDay = dayMap.get(selected) ?? null;
  const selectedActivities = activitiesByDay[selected] ?? [];

  // A day's "aliveness": how many of the trio checked in / logged anything.
  const dayIntensity = useCallback((day: DayHistory): 0 | 1 | 2 | 3 => {
    let score = 0;
    if (Object.keys(day.checkins).length > 0) score += 1;
    if (Object.keys(day.meals).length > 0) score += 1;
    if (Object.keys(day.water).length > 0 || Object.keys(day.steps).length > 0) score += 1;
    return Math.min(score, 3) as 0 | 1 | 2 | 3;
  }, []);

  const isFuture = (key: string) => key > todayKey();

  if (loading && !history) return <LoadingView label="Unfolding the calendar…" />;
  if (error && !history) return <ErrorState message={error} onRetry={load} />;
  if (!profile) return null;

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
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/me'))}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Activity Calendar 📅</Text>
          <View style={styles.backButton} />
        </View>

        {/* Month switcher */}
        <View style={[styles.monthBar, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Pressable onPress={() => setMonthOffset((o) => o - 1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={theme.accent} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: palette.text }]}>{monthWindow.label}</Text>
          <Pressable
            onPress={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            disabled={monthOffset === 0}
            style={[styles.monthArrow, monthOffset === 0 && { opacity: 0.35 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.accent} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={[styles.weekLabel, { color: palette.textFaint }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={styles.grid}>
          {Array.from({ length: monthWindow.firstWeekday }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.cell} />
          ))}
          {Array.from({ length: monthWindow.daysInMonth }).map((_, i) => {
            const key = `${monthWindow.year}-${`${monthWindow.month + 1}`.padStart(2, '0')}-${`${i + 1}`.padStart(2, '0')}`;
            const day = dayMap.get(key);
            const intensity = day ? dayIntensity(day) : 0;
            const future = isFuture(key);
            const isToday = key === todayKey();
            const isSelected = key === selected;
            return (
              <Pressable
                key={key}
                onPress={() => !future && setSelected(key)}
                disabled={future}
                style={[
                  styles.cell,
                  isSelected && {
                    backgroundColor: theme.light,
                    borderRadius: RADIUS.md,
                    borderWidth: 2,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    { color: future ? palette.textFaint : palette.text },
                    isToday && { color: theme.accent, fontWeight: '900' },
                  ]}
                >
                  {i + 1}
                </Text>
                {!future && intensity > 0 ? (
                  <View style={styles.dotRow}>
                    {Array.from({ length: intensity }).map((_, j) => (
                      <View
                        key={j}
                        style={[styles.dot, { backgroundColor: j === 0 ? theme.primary : theme.accent }]}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: palette.textFaint }]}>check-in</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.legendText, { color: palette.textFaint }]}>meals / water / steps</Text>
          </View>
          <Text style={[styles.legendRest, { color: palette.textFaint }]}>
            quiet days are rest days 🌙
          </Text>
        </View>

        {/* Selected day detail */}
        <Text style={[styles.detailTitle, { color: palette.text }]}>
          {selected === todayKey() ? 'Today' : selected}
        </Text>
        {!selectedDay || selectedDay.activityCount === 0 ? (
          <EmptyState
            emoji="🌙"
            title="A quiet day"
            subtitle="Nothing was logged this day — and that's okay."
          />
        ) : (
          <RoundedCard style={styles.detailCard}>
            {/* Trio snapshot */}
            <View style={styles.trioRow}>
              {profiles.map((p) => {
                const checkin = selectedDay.checkins[p.id];
                const meals = selectedDay.meals[p.id] ?? [];
                const water = selectedDay.water[p.id] ?? 0;
                const steps = selectedDay.steps[p.id] ?? 0;
                const empty = !checkin && meals.length === 0 && water === 0 && steps === 0;
                return (
                  <View key={p.id} style={styles.trioCell}>
                    <Avatar profile={p} size={34} />
                    <Text style={[styles.trioName, { color: palette.text }]} numberOfLines={1}>
                      {p.display_name}
                    </Text>
                    {empty ? (
                      <Text style={[styles.trioEmpty, { color: palette.textFaint }]}>rest 🌙</Text>
                    ) : (
                      <Text style={[styles.trioMeta, { color: palette.textSecondary }]}>
                        {checkin ? `${moodMeta(checkin.mood).emoji}` : ''}
                        {meals.length > 0 ? ` 🍱${meals.length}` : ''}
                        {water > 0 ? ` 💧${water}` : ''}
                        {steps > 0 ? ` 👟${formatSteps(steps)}` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Activity feed for that day */}
            {selectedActivities.length > 0 ? (
              <View style={[styles.feedWrap, { borderTopColor: palette.border }]}>
                {selectedActivities.map((a, idx) => (
                  <View key={a.id} style={styles.feedRow}>
                    <Text style={styles.feedEmoji}>{ACTIVITY_ICONS[a.type] ?? '✨'}</Text>
                    <Text style={[styles.feedText, { color: palette.text }]}>{a.text}</Text>
                    {idx === 0 ? null : null}
                  </View>
                ))}
              </View>
            ) : null}
          </RoundedCard>
        )}

        <View style={styles.bottomGap} />
      </ScrollView>
    </Screen>
  );
}

function formatSteps(steps: number): string {
  if (steps >= 1000) return `${(steps / 1000).toFixed(1)}k`;
  return `${steps}`;
}

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
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  monthArrow: { padding: 8 },
  monthLabel: { fontSize: 15, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayNum: { fontSize: 14, fontWeight: '600' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11 },
  legendRest: { fontSize: 11, fontStyle: 'italic' },
  detailTitle: { fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  detailCard: { padding: 14 },
  trioRow: { flexDirection: 'row', gap: 8 },
  trioCell: { flex: 1, alignItems: 'center', gap: 4 },
  trioName: { fontSize: 11.5, fontWeight: '700' },
  trioMeta: { fontSize: 10.5, textAlign: 'center' },
  trioEmpty: { fontSize: 10.5, fontStyle: 'italic' },
  feedWrap: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedEmoji: { fontSize: 14 },
  feedText: { fontSize: 12.5, flex: 1 },
  bottomGap: { height: 24 },
});
