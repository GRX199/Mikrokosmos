import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SoftInput } from '@/components/SoftInput';
import { RADIUS, trendStatusMeta, TREND_STATUSES, useAppTheme } from '@/core/theme';
import type { Profile, Trend, TrendStatus, TrendTask } from '@/models';
import { logActivity } from '@/repositories/activities';
import { sendMikoMessage } from '@/repositories/chat';
import { fetchProfiles } from '@/repositories/profiles';
import {
  addTask,
  deleteTask,
  deleteTrend,
  fetchParticipants,
  fetchTasks,
  fetchTrends,
  setTaskCompleted,
  subscribeToTrendChanges,
  updateTrendStatus,
} from '@/repositories/trends';
import { mikoLine } from '@/services/miko';
import { useAuth } from '@/features/auth/SessionProvider';
import { isValidUrl, linkSource } from '@/app/(tabs)/trends';

/**
 * Trend detail — link, status controls, shared checklist with realtime
 * sync, and the Done-status celebration moment (spec sections 23-24).
 */
export default function TrendDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();

  const [trend, setTrend] = useState<Trend | null>(null);
  const [tasks, setTasks] = useState<TrendTask[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [trendList, taskList, profiles, parts] = await Promise.all([
        fetchTrends(),
        fetchTasks(id),
        fetchProfiles(),
        fetchParticipants([id]),
      ]);
      setTrend(trendList.find((t) => t.id === id) ?? null);
      setTasks(taskList);
      setParticipantIds(parts[id] ?? []);
      const map: Record<string, Profile> = {};
      for (const p of profiles) map[p.id] = p;
      setProfileMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this trend.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToTrendChanges(load);
    return unsubscribe;
  }, [load]);

  if (loading && !trend) return <LoadingView label="Opening the trend…" />;
  if (error && !trend) return <ErrorState message={error} onRetry={load} />;
  if (!trend) return <ErrorState message="This trend drifted away." onRetry={() => router.back()} />;

  const source = linkSource(trend.url);
  const status = trendStatusMeta(trend.status);
  const doneCount = tasks.filter((t) => t.completed).length;

  // ---------- Actions ----------

  async function changeStatus(next: TrendStatus) {
    if (!profile || !trend || trend.status === next) return;
    const wasDone = trend.status === 'done';
    await updateTrendStatus(trend.id, next);
    setTrend({ ...trend, status: next });

    if (next === 'done' && !wasDone) {
      // Celebration moment (spec §24): modal first, activity + Miko after.
      setCelebrate(true);
      await logActivity(profile.id, 'trend_done', `${profile.display_name} finished "${trend.title}" ✅`);
      await sendMikoMessage(mikoLine('trend_completed', profile));
    }
  }

  async function handleSaveMemory() {
    if (!profile || !trend) return;
    // Phase 2 Memories seam: store a caption-only memory placeholder for now.
    await logActivity(profile.id, 'memory', `💌 Memory saved: "${trend.title}" — done together.`);
    setCelebrate(false);
  }

  async function handleAddTask() {
    if (!trend || !taskDraft.trim()) return;
    const title = taskDraft.trim();
    setTaskDraft('');
    await addTask(trend.id, title);
    await load();
  }

  async function toggleTask(task: TrendTask) {
    if (!profile) return;
    await setTaskCompleted(task.id, !task.completed, profile.id);
    await load();
  }

  function confirmDeleteTask(task: TrendTask) {
    Alert.alert('Remove this task?', task.title, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(task.id);
          await load();
        },
      },
    ]);
  }

  async function confirmDeleteTrend() {
    Alert.alert('Delete this trend?', trend!.title, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrend(trend!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            Trend
          </Text>
          <Pressable onPress={confirmDeleteTrend} style={styles.backButton}>
            <Ionicons name="trash-outline" size={19} color={palette.textSecondary} />
          </Pressable>
        </View>

        {/* Trend card */}
        <RoundedCard style={styles.card}>
          <View style={styles.chipRow}>
            <View style={[styles.sourceChip, { backgroundColor: theme.light }]}>
              <Text style={styles.chipText}>{source.emoji}</Text>
              <Text style={[styles.chipLabel, { color: theme.accent }]}>{source.label}</Text>
            </View>
            <View
              style={[styles.sourceChip, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.chipLabel, { color: palette.textSecondary }]}>
                {status.emoji} {status.label}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: palette.text }]}>{trend.title}</Text>
          {trend.description ? (
            <Text style={[styles.description, { color: palette.textSecondary }]}>
              {trend.description}
            </Text>
          ) : null}
          {trend.target_date ? (
            <Text style={[styles.meta, { color: palette.textFaint }]}>
              📅 Target: {trend.target_date}
            </Text>
          ) : null}

          {trend.url && isValidUrl(trend.url) ? (
            <Pressable
              onPress={() => Linking.openURL(trend.url!).catch(() => {})}
              style={[styles.openButton, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="open-outline" size={16} color={palette.white} />
              <Text style={[styles.openButtonText, { color: palette.white }]}>Open Link</Text>
            </Pressable>
          ) : null}

          {/* Participants */}
          <View style={styles.participantRow}>
            {participantIds.map((uid) => {
              const p = profileMap[uid];
              return (
                <View key={uid} style={styles.participant}>
                  <Avatar profile={p} size={34} />
                  <Text style={[styles.participantName, { color: palette.textSecondary }]}>
                    {p?.display_name ?? '…'}
                  </Text>
                </View>
              );
            })}
          </View>
        </RoundedCard>

        {/* Status control */}
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Status</Text>
        <View style={styles.statusRow}>
          {TREND_STATUSES.map((s) => {
            const active = trend.status === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => changeStatus(s.key)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? theme.primary : palette.card,
                    borderColor: active ? theme.primary : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusLabel,
                    { color: active ? palette.white : palette.textSecondary },
                  ]}
                >
                  {s.emoji} {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Shared checklist */}
        <View style={styles.checklistHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Our Checklist</Text>
          <Text style={[styles.checklistCount, { color: palette.textFaint }]}>
            {doneCount}/{tasks.length} done
          </Text>
        </View>

        <RoundedCard>
          {tasks.length === 0 ? (
            <Text style={[styles.emptyTasks, { color: palette.textSecondary }]}>
              No tasks yet. Add little steps so the three of you can share the work 💫
            </Text>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={[styles.taskRow, { borderBottomColor: palette.border }]}>
                <Pressable onPress={() => toggleTask(task)} style={styles.taskMain}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: task.completed ? theme.primary : palette.card,
                        borderColor: task.completed ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    {task.completed ? <Ionicons name="checkmark" size={14} color={palette.white} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.taskTitle,
                      {
                        color: task.completed ? palette.textFaint : palette.text,
                        textDecorationLine: task.completed ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {task.title}
                  </Text>
                </Pressable>
                <Pressable onPress={() => confirmDeleteTask(task)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={palette.textFaint} />
                </Pressable>
              </View>
            ))
          )}

          <View style={styles.addTaskRow}>
            <SoftInput
              value={taskDraft}
              onChangeText={setTaskDraft}
              placeholder="Add a step…"
              placeholderTextColor={palette.textFaint}
              style={[styles.taskInput, { color: palette.text }]}
              onSubmitEditing={handleAddTask}
              containerStyle={styles.taskInputContainer}
            />
            <Pressable
              onPress={handleAddTask}
              disabled={!taskDraft.trim()}
              style={[
                styles.addTaskButton,
                { backgroundColor: theme.primary, opacity: taskDraft.trim() ? 1 : 0.5 },
              ]}
            >
              <Ionicons name="add" size={20} color={palette.white} />
            </Pressable>
          </View>
        </RoundedCard>

        <View style={styles.bottomGap} />
      </ScrollView>

      {/* Done celebration (spec §24) */}
      <Modal
        visible={celebrate}
        transparent
        animationType="fade"
        onRequestClose={() => setCelebrate(false)}
      >
        <View style={[styles.celebrateBackdrop, { backgroundColor: palette.overlay }]}>
          <View style={[styles.celebrateCard, { backgroundColor: palette.card }]}>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={[styles.celebrateTitle, { color: palette.text }]}>You did it! ✨</Text>
            <Text style={[styles.celebrateText, { color: palette.textSecondary }]}>
              "{trend.title}" is officially done. Want to save this moment to Mikrokosmos Memories?
            </Text>
            <PrimaryButton label="Save Memory 💌" onPress={handleSaveMemory} />
            <Pressable onPress={() => setCelebrate(false)} style={styles.laterButton}>
              <Text style={[styles.laterText, { color: palette.textSecondary }]}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  card: { marginBottom: 20 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: { fontSize: 12 },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 12, marginBottom: 12 },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    marginBottom: 14,
  },
  openButtonText: { fontWeight: '700', fontSize: 14 },
  participantRow: { flexDirection: 'row', gap: 16 },
  participant: { alignItems: 'center', gap: 4 },
  participantName: { fontSize: 11, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  statusLabel: { fontSize: 13, fontWeight: '700' },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistCount: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  emptyTasks: { fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  addTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  taskInputContainer: { flex: 1 },
  taskInput: { fontSize: 14 },
  addTaskButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGap: { height: 24 },
  celebrateBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  celebrateCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.xl,
    padding: 28,
    alignItems: 'center',
  },
  celebrateEmoji: { fontSize: 46, marginBottom: 8 },
  celebrateTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  celebrateText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  laterButton: { marginTop: 12, padding: 6 },
  laterText: { fontSize: 13, fontWeight: '600' },
});
