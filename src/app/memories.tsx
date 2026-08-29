import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
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
import { RADIUS, useAppTheme } from '@/core/theme';
import { relativeTime } from '@/core/utils/date';
import type { Memory, Profile } from '@/models';
import { logActivity } from '@/repositories/activities';
import { fetchProfiles } from '@/repositories/profiles';
import {
  createMemory,
  deleteMemory,
  fetchMemories,
  subscribeToMemories,
  type MemoryInput,
} from '@/repositories/memories';
import { resolveMediaUrl, uploadImage } from '@/repositories/storage';
import { useAuth } from '@/features/auth/SessionProvider';

/**
 * Memories — the trio's shared scrapbook (Phase 2).
 * Moments saved from trend celebrations or added by hand:
 * a title, a caption, an optional photo. No rankings, no pressure.
 */
export default function MemoriesScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const router = useRouter();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, profiles] = await Promise.all([fetchMemories(), fetchProfiles()]);
      setMemories(list);
      const map: Record<string, Profile> = {};
      for (const p of profiles) map[p.id] = p;
      setProfileMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the scrapbook.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToMemories(load);
    return unsubscribe;
  }, [load]);

  // Resolve stored image paths into signed URLs for display.
  useEffect(() => {
    async function resolveImages() {
      const map: Record<string, string> = {};
      for (const m of memories) {
        if (m.image_url && !resolvedImages[m.id]) {
          const url = await resolveMediaUrl(m.image_url);
          if (url) map[m.id] = url;
        }
      }
      if (Object.keys(map).length > 0) setResolvedImages((prev) => ({ ...prev, ...map }));
    }
    if (memories.length > 0) void resolveImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories]);

  function confirmDelete(memory: Memory) {
    const doDelete = async () => {
      await deleteMemory(memory.id);
      await load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${memory.title}" from the scrapbook?`)) void doDelete();
      return;
    }
    Alert.alert('Remove this memory?', memory.title, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doDelete },
    ]);
  }

  async function handleCreate(input: MemoryInput, localImageUri: string | null) {
    if (!profile) return;
    let imagePath: string | null = null;
    if (localImageUri) {
      imagePath = await uploadImage(profile.id, localImageUri, 'meals');
      // Mock mode keeps the local data URI; Supabase nulls on failure —
      // the memory itself must still save.
    }
    await createMemory(profile.id, {
      ...input,
      image_url: imagePath ?? localImageUri,
    });
    await logActivity(
      profile.id,
      'memory',
      `${profile.display_name} saved a memory: "${input.title}" 💌`
    );
    await load();
  }

  if (loading && memories.length === 0 && !error) {
    return <LoadingView label="Opening the scrapbook…" />;
  }
  if (error && memories.length === 0) {
    return <ErrorState message={error} onRetry={load} />;
  }
  if (!profile) return null;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.primary}
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Memories 💌</Text>
          <Pressable
            onPress={() => setComposerOpen(true)}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="add" size={22} color={palette.white} />
          </Pressable>
        </View>

        <Text style={[styles.tagline, { color: palette.textSecondary }]}>
          Little moments the three of you kept — no rankings, just warm.
        </Text>

        {memories.length === 0 ? (
          <EmptyState
            emoji="💌"
            title="No memories yet"
            subtitle={'Finish a trend together and save the moment, or add one by hand.\nIt will live here, cozy forever.'}
            actionLabel="Save a Memory 💌"
            onAction={() => setComposerOpen(true)}
          />
        ) : (
          <View style={styles.memoryColumn}>
            {memories.map((memory) => {
              const author = memory.created_by ? profileMap[memory.created_by] : undefined;
              const imageUrl = resolvedImages[memory.id] ?? null;
              const isMine = memory.created_by === profile.id;
              return (
                <RoundedCard key={memory.id} style={styles.memoryCard}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.memoryImage} />
                  ) : null}
                  <View style={styles.memoryBody}>
                    <Text style={[styles.memoryTitle, { color: palette.text }]}>
                      {memory.title}
                    </Text>
                    {memory.caption ? (
                      <Text style={[styles.memoryCaption, { color: palette.textSecondary }]}>
                        {memory.caption}
                      </Text>
                    ) : null}
                    <View style={styles.memoryMetaRow}>
                      <Avatar profile={author} size={22} />
                      <Text style={[styles.memoryMeta, { color: palette.textFaint }]}>
                        {author ? `${author.display_name} · ` : ''}
                        {relativeTime(memory.created_at)}
                      </Text>
                      {isMine ? (
                        <Pressable onPress={() => confirmDelete(memory)} hitSlop={8} style={styles.deleteButton}>
                          <Ionicons name="trash-outline" size={15} color={palette.textFaint} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </RoundedCard>
              );
            })}
          </View>
        )}

        <View style={styles.bottomGap} />
      </ScrollView>

      <MemoryComposerModal
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSave={handleCreate}
      />
    </Screen>
  );
}

/** Bottom sheet for saving a new memory (title + caption + optional photo). */
function MemoryComposerModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: MemoryInput, localImageUri: string | null) => Promise<void>;
}) {
  const { theme, palette } = useAppTheme();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setCaption('');
      setImageUri(null);
    }
  }, [visible]);

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } catch {
      // Photo picking is optional — never block saving.
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(
        { title: title.trim(), caption: caption.trim() },
        imageUri
      );
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
            <View style={styles.composerHeader}>
              <Text style={[styles.composerTitle, { color: palette.text }]}>Save a Memory 💌</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={palette.textSecondary} />
              </Pressable>
            </View>

            <SoftInput
              placeholder="Give this moment a name"
              value={title}
              onChangeText={setTitle}
              containerStyle={styles.field}
            />
            <SoftInput
              placeholder="How did it feel? (optional)"
              value={caption}
              onChangeText={setCaption}
              containerStyle={styles.field}
              multiline
            />

            <View style={styles.photoRow}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
              ) : (
                <Pressable
                  onPress={pickPhoto}
                  style={[styles.photoPlaceholder, { backgroundColor: theme.light }]}
                >
                  <Ionicons name="camera-outline" size={24} color={theme.accent} />
                  <Text style={[styles.photoPlaceholderText, { color: theme.accent }]}>Add photo</Text>
                </Pressable>
              )}
              <PrimaryButton
                label={imageUri ? 'Change photo' : 'Pick a photo'}
                onPress={pickPhoto}
                variant="soft"
                style={styles.photoButton}
              />
            </View>

            <PrimaryButton
              label="Save to Scrapbook 💗"
              onPress={handleSave}
              disabled={!title.trim()}
              loading={saving}
            />
          </RoundedCard>
        </Pressable>
      </Pressable>
    </Modal>
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
  addButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  memoryColumn: { gap: 14 },
  memoryCard: { overflow: 'hidden' },
  memoryImage: {
    width: '100%',
    height: 190,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  memoryBody: { padding: 16 },
  memoryTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  memoryCaption: { fontSize: 13.5, lineHeight: 20, marginBottom: 10 },
  memoryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memoryMeta: { flex: 1, fontSize: 12 },
  deleteButton: { padding: 4 },
  bottomGap: { height: 24 },
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
    maxHeight: '86%',
    padding: 18,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  composerTitle: { fontSize: 19, fontWeight: '800' },
  closeButton: { padding: 6 },
  field: { marginBottom: 10 },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  photoPreview: {
    width: 86,
    height: 86,
    borderRadius: RADIUS.md,
  },
  photoPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderText: { fontSize: 11, fontWeight: '700' },
  photoButton: { flex: 1, minHeight: 40, paddingVertical: 8 },
});
