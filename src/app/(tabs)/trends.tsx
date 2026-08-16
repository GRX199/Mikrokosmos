import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Modal,
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
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SoftInput } from '@/components/SoftInput';
import { RADIUS, trendStatusMeta, TREND_STATUSES, useAppTheme } from '@/core/theme';
import type { Profile, Trend, TrendStatus } from '@/models';
import { fetchProfiles } from '@/repositories/profiles';
import {
  createTrend,
  fetchParticipants,
  fetchTrends,
  subscribeToTrendChanges,
} from '@/repositories/trends';
import { logActivity } from '@/repositories/activities';
import { useAuth } from '@/features/auth/SessionProvider';

/** Detect which platform a trend link points to, for pretty cards. */
export function linkSource(url?: string | null): { label: string; emoji: string } {
  if (!url) return { label: 'Idea', emoji: '💭' };
  if (url.includes('tiktok.com')) return { label: 'TikTok', emoji: '🎵' };
  if (url.includes('instagram.com')) return { label: 'Instagram', emoji: '📷' };
  if (url.includes('youtube.com') || url.includes('youtu.be')) return { label: 'YouTube', emoji: '▶️' };
  return { label: 'Link', emoji: '🔗' };
}

export function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+\..+/.test(url.trim());
}

/** Our Trends — shared things the trio wants to try (spec sections 21-22). */
export default function TrendsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();

  const [trends, setTrends] = useState<Trend[]>([]);
  const [participants, setParticipants] = useState<Record<string, string[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [tab, setTab] = useState<'all' | TrendStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [trendList, profiles] = await Promise.all([fetchTrends(), fetchProfiles()]);
      setTrends(trendList);
      setParticipants(await fetchParticipants(trendList.map((t) => t.id)));
      const map: Record<string, Profile> = {};
      for (const p of profiles) map[p.id] = p;
      setProfileMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load trends.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToTrendChanges(load);
    return unsubscribe;
  }, [load]);

  if (loading && trends.length === 0) return <LoadingView label="Gathering the fun list…" />;
  if (error && trends.length === 0) return <ErrorState message={error} onRetry={load} />;

  const filtered = tab === 'all' ? trends : trends.filter((t) => t.status === tab);

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
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.header, { color: palette.text }]}>Our Trends ✨</Text>
            <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
              Things we absolutely have to try together.
            </Text>
          </View>
          <Pressable
            onPress={() => setAddOpen(true)}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="add" size={22} color={palette.white} />
          </Pressable>
        </View>

        {/* Status tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {(['all', ...TREND_STATUSES.map((s) => s.key)] as const).map((key) => {
            const active = tab === key;
            const meta = key === 'all' ? null : trendStatusMeta(key);
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? theme.primary : palette.card,
                    borderColor: active ? theme.primary : palette.border,
                  },
                ]}
              >
                <Text
                  style={[styles.tabLabel, { color: active ? palette.white : palette.textSecondary }]}
                >
                  {key === 'all' ? 'All' : `${meta!.emoji} ${meta!.label}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            emoji="✨"
            title="No trends yet"
            subtitle={'Found something fun on TikTok?\nSave it here so you don\'t forget.'}
            actionLabel="+ Add Trend"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((trend) => (
              <TrendCard
                key={trend.id}
                trend={trend}
                creator={trend.created_by ? profileMap[trend.created_by] : null}
                participantIds={participants[trend.id] ?? []}
                profileMap={profileMap}
                onPress={() => router.push(`/trend/${trend.id}`)}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomGap} />
      </ScrollView>

      <AddTrendModal
        visible={addOpen}
        profiles={Object.values(profileMap)}
        onClose={() => setAddOpen(false)}
        onCreate={async (input) => {
          if (!profile) return;
          await createTrend(profile.id, input);
          await logActivity(profile.id, 'trend_added', `${profile.display_name} added a new trend ✨`);
          await load();
        }}
      />
    </Screen>
  );
}

function TrendCard({
  trend,
  creator,
  participantIds,
  profileMap,
  onPress,
}: {
  trend: Trend;
  creator: Profile | null;
  participantIds: string[];
  profileMap: Record<string, Profile>;
  onPress: () => void;
}) {
  const { theme, palette } = useAppTheme();
  const source = linkSource(trend.url);
  const status = trendStatusMeta(trend.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <RoundedCard style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.sourceChip, { backgroundColor: theme.light }]}>
            <Text style={styles.sourceEmoji}>{source.emoji}</Text>
            <Text style={[styles.sourceLabel, { color: theme.accent }]}>{source.label}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.statusLabel, { color: palette.textSecondary }]}>
              {status.emoji} {status.label}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, { color: palette.text }]}>{trend.title}</Text>
        {trend.description ? (
          <Text style={[styles.cardDescription, { color: palette.textSecondary }]} numberOfLines={2}>
            {trend.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.participantStack}>
            {participantIds.slice(0, 3).map((id) => (
              <Avatar key={id} profile={profileMap[id]} size={26} />
            ))}
          </View>
          <Text style={[styles.cardMeta, { color: palette.textFaint }]}>
            {creator ? `by ${creator.display_name}` : ''}
            {trend.target_date ? ` · ${trend.target_date}` : ''}
          </Text>
        </View>
      </RoundedCard>
    </Pressable>
  );
}

function AddTrendModal({
  visible,
  profiles,
  onClose,
  onCreate,
}: {
  visible: boolean;
  profiles: Profile[];
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description?: string | null;
    url?: string | null;
    target_date?: string | null;
    participant_ids?: string[];
  }) => Promise<void>;
}) {
  const { theme, palette } = useAppTheme();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [urlError, setUrlError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setUrl('');
      setDescription('');
      setTargetDate('');
      setSelected(profiles.map((p) => p.id));
      setUrlError(false);
    }
  }, [visible, profiles]);

  async function handleCreate() {
    if (!title.trim()) return;
    if (url.trim() && !isValidUrl(url)) {
      setUrlError(true);
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        target_date: /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim()) ? targetDate.trim() : null,
        participant_ids: selected,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheetAnchor}>
          <RoundedCard style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>New Trend ✨</Text>

            <SoftInput
              placeholder="Trend title"
              value={title}
              onChangeText={setTitle}
              containerStyle={styles.field}
            />
            <SoftInput
              placeholder="Link (TikTok / Instagram / YouTube…)"
              value={url}
              autoCapitalize="none"
              onChangeText={(text) => {
                setUrl(text);
                setUrlError(false);
              }}
              containerStyle={styles.field}
            />
            {urlError ? (
              <Text style={[styles.fieldError, { color: palette.danger }]}>
                That link doesn't look right — it should start with https://
              </Text>
            ) : null}
            <SoftInput
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              containerStyle={styles.field}
            />
            <SoftInput
              placeholder="Target date (YYYY-MM-DD, optional)"
              value={targetDate}
              onChangeText={setTargetDate}
              containerStyle={styles.field}
            />

            <Text style={[styles.participantsLabel, { color: palette.textSecondary }]}>
              Who's in?
            </Text>
            <View style={styles.participantSelectRow}>
              {profiles.map((p) => {
                const active = selected.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      setSelected((prev) =>
                        active ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    style={[
                      styles.participantSelect,
                      {
                        backgroundColor: active ? theme.light : palette.card,
                        borderColor: active ? theme.primary : palette.border,
                      },
                    ]}
                  >
                    <Text>{p.emoji}</Text>
                    <Text style={[styles.participantSelectLabel, { color: palette.text }]}>
                      {p.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton
              label="Add Trend ✨"
              onPress={handleCreate}
              disabled={!title.trim()}
              loading={saving}
              style={styles.createButton}
            />
          </RoundedCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    marginTop: 16,
    marginBottom: 4,
    flexGrow: 0,
  },
  tabChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 12,
    marginTop: 12,
  },
  card: {
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceEmoji: {
    fontSize: 12,
  },
  sourceLabel: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  statusChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  participantStack: {
    flexDirection: 'row',
  },
  cardMeta: {
    fontSize: 11.5,
  },
  bottomGap: {
    height: 130,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetAnchor: {
    width: '100%',
    maxWidth: 520,
    padding: 12,
  },
  sheet: {
    padding: 20,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  field: {
    marginBottom: 0,
  },
  fieldError: {
    fontSize: 12,
    marginTop: -4,
  },
  participantsLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  participantSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  participantSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participantSelectLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  createButton: {
    marginTop: 6,
  },
});
