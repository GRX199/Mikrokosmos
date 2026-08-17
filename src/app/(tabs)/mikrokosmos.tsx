import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { LoadingView } from '@/components/LoadingView';
import { Screen } from '@/components/Screen';
import { MIKO } from '@/core/constants/app';
import { RADIUS, REACTION_EMOJIS, themeFor, useAppTheme } from '@/core/theme';
import { relativeTime } from '@/core/utils/date';
import type { ChatMessage, MessageReaction, Profile } from '@/models';
import {
  fetchMessages,
  fetchReactions,
  sendMessage,
  sendMikoMessage,
  subscribeToMessages,
  toggleReaction,
} from '@/repositories/chat';
import { fetchProfiles } from '@/repositories/profiles';
import { resolveMediaUrl, uploadImage } from '@/repositories/storage';
import { useAuth } from '@/features/auth/SessionProvider';
import { askMiko, mikoFallbackReply, getQuotaExceededMessage, isQuotaExceeded } from '@/services/miko';
import { clearUnread, incrementUnread } from '@/stores/unreadChatStore';
import { useFocusEffect } from 'expo-router';

/** Mikrokosmos chat — the trio's private living room (spec section 19). */
export default function ChatScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [isFocused, setIsFocused] = useState(true);
  const isFocusedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      isFocusedRef.current = true;
      clearUnread();
      return () => {
        setIsFocused(false);
        isFocusedRef.current = false;
      };
    }, [])
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactionTarget, setReactionTarget] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);

  const loadReactions = useCallback(async (msgs: ChatMessage[]) => {
    try {
      const all = await fetchReactions(msgs.map((m) => m.id));
      const map: Record<string, MessageReaction[]> = {};
      for (const r of all) (map[r.message_id] ??= []).push(r);
      setReactions(map);
    } catch {
      // Reactions are decorative — never break chat over them.
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [msgs, profiles] = await Promise.all([fetchMessages(120), fetchProfiles()]);
      setMessages(msgs);
      const map: Record<string, Profile> = {};
      for (const p of profiles) map[p.id] = p;
      setProfileMap(map);
      await loadReactions(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the chat.');
    } finally {
      setLoading(false);
    }
  }, [loadReactions]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: append incoming messages in realtime.
  useEffect(() => {
    const unsubscribe = subscribeToMessages((incoming) => {
      setMessages((prev) =>
        prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
      );
      loadReactions([incoming]);
      // Increment unread if chat is not focused (use ref to avoid recreating subscription)
      if (!isFocusedRef.current) {
        incrementUnread();
      }
    });
    return unsubscribe;
  }, [loadReactions]);

  useEffect(() => {
    // Scroll to bottom on initial load and when new messages arrive
    if (!loading && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading, messages.length]);

  const replyPreview = useMemo(() => {
    if (!replyTo) return null;
    const sender = replyTo.is_bot ? MIKO.name : profileMap[replyTo.sender_id ?? '']?.display_name;
    return { sender, text: replyTo.message };
  }, [replyTo, profileMap]);

  async function handleSend() {
    if (!profile || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    try {
      await sendMessage(profile.id, { message: text, reply_to: replyId });
      if (!isSupabaseRealtime()) await load(); // mock mode: refresh manually
      // Miko replies to messages that mention her (only on the sender's device,
      // so the bot never gets duplicated across the 3 friends).
      void maybeAskMiko(text, profile);
    } finally {
      setSending(false);
    }
  }

  async function handleAttachImage() {
    if (!profile) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      const path = await uploadImage(profile.id, result.assets[0].uri, 'chat');
      await sendMessage(profile.id, {
        message: draft.trim() || '📸',
        message_type: 'image',
        media_url: path ?? result.assets[0].uri,
        reply_to: replyTo?.id ?? null,
      });
      setReplyTo(null);
      setDraft('');
      if (!isSupabaseRealtime()) await load();
    } catch {
      // Never crash chat over an attachment.
    }
  }

  async function handleReact(emoji: string) {
    if (!profile || !reactionTarget) return;
    const target = reactionTarget;
    setReactionTarget(null);
    const existing = (reactions[target.id] ?? []).find(
      (r) => r.user_id === profile.id && r.emoji === emoji
    );
    await toggleReaction(target.id, profile.id, emoji, existing);
    await loadReactions([target]);
  }

  async function maybeAskMiko(text: string, sender: Profile) {
    if (!/\bmiko\b/i.test(text)) return;
    try {
      const reply = await askMiko(
        text,
        sender.display_name,
        messages.map((m) => ({
          who: m.is_bot ? 'Miko' : profileMap[m.sender_id ?? '']?.display_name ?? 'Friend',
          text: m.message,
        }))
      );
      // Use quota message if quota exceeded, otherwise use reply or fallback
      const mikoReply = reply ?? (isQuotaExceeded() ? getQuotaExceededMessage() : mikoFallbackReply());
      await sendMikoMessage(mikoReply);
      if (!isSupabaseRealtime()) await load();
    } catch {
      // Miko stays silent rather than breaking the chat.
    }
  }

  if (loading) return <LoadingView label="Opening the group chat…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Screen padded={false} style={{ paddingBottom: 0 }}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={styles.headerEmoji}>🌌</Text>
          <View style={styles.flex}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Mikrokosmos</Text>
            <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
              Namy · Kyra · Jessy · {MIKO.emoji} Miko
            </Text>
          </View>
          <View style={styles.avatarStack}>
            {Object.values(profileMap).slice(0, 3).map((p) => (
              <Avatar key={p.id} profile={p} size={30} />
            ))}
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 130 }]}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              mine={item.sender_id === profile?.id}
              sender={item.is_bot ? null : profileMap[item.sender_id ?? ''] ?? null}
              replyPreviewOf={
                item.reply_to ? messages.find((m) => m.id === item.reply_to) ?? null : null
              }
              profileMap={profileMap}
              reactions={reactions[item.id] ?? []}
              onLongPress={() => setReactionTarget(item)}
              onReply={() => setReplyTo(item)}
            />
          )}
        />

        {/* Reply preview */}
        {replyPreview ? (
          <View style={[styles.replyBar, { backgroundColor: theme.light }]}>
            <Ionicons name="arrow-undo" size={14} color={theme.accent} />
            <Text style={[styles.replyText, { color: theme.accent }]} numberOfLines={1}>
              Replying to {replyPreview.sender}: {replyPreview.text}
            </Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color={theme.accent} />
            </Pressable>
          </View>
        ) : null}

        {/* Composer */}
        <View
          style={[
            styles.composer,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.border,
              paddingBottom: Math.max(insets.bottom, 90),
            },
          ]}
        >
          <View style={styles.composerInner}>
            <Pressable onPress={handleAttachImage} style={styles.attachButton}>
              <Ionicons name="image-outline" size={22} color={theme.accent} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Say something cute…"
              placeholderTextColor={palette.textFaint}
              style={[styles.input, { color: palette.text }]}
              multiline
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary, opacity: draft.trim() && !sending ? 1 : 0.5 },
              ]}
            >
              <Ionicons name="send" size={17} color={palette.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Reaction picker */}
      <Modal
        visible={reactionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <Pressable
          style={[styles.reactionBackdrop, { backgroundColor: palette.overlay }]}
          onPress={() => setReactionTarget(null)}
        >
          <View style={[styles.reactionSheet, { backgroundColor: palette.card }]}>
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => handleReact(emoji)} style={styles.reactionButton}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setReplyTo(reactionTarget);
                setReactionTarget(null);
              }}
              style={styles.reactionButton}
            >
              <Ionicons name="arrow-undo" size={20} color={palette.textSecondary} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function isSupabaseRealtime(): boolean {
  // Small helper to keep mock-mode refresh logic in one place.
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL);
}

function MessageBubble({
  message,
  mine,
  sender,
  replyPreviewOf,
  profileMap,
  reactions,
  onLongPress,
  onReply,
}: {
  message: ChatMessage;
  mine: boolean;
  sender: Profile | null;
  replyPreviewOf: ChatMessage | null;
  profileMap: Record<string, Profile>;
  reactions: MessageReaction[];
  onLongPress: () => void;
  onReply: () => void;
}) {
  const { theme, palette } = useAppTheme();

  if (message.is_bot) {
    return (
      <View style={styles.mikoRow}>
        <View style={[styles.mikoBubble, { backgroundColor: theme.light, borderColor: theme.primary }]}>
          <Text style={[styles.mikoName, { color: theme.accent }]}>
            {MIKO.emoji} Miko
          </Text>
          <Text style={[styles.mikoText, { color: palette.text }]}>{message.message}</Text>
          <Text style={[styles.timeText, { color: palette.textFaint }]}>
            {relativeTime(message.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  const bubbleTheme = mine ? theme : themeFor(sender?.theme);
  const replySender = replyPreviewOf?.is_bot
    ? MIKO.name
    : profileMap[replyPreviewOf?.sender_id ?? '']?.display_name;

  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      {!mine ? <Avatar profile={sender} size={32} /> : null}
      <Pressable
        onLongPress={onLongPress}
        onPress={onReply}
        delayLongPress={250}
        style={[
          styles.bubble,
          {
            backgroundColor: mine ? bubbleTheme.primary : palette.card,
            borderColor: mine ? bubbleTheme.primary : palette.border,
          },
        ]}
      >
        {!mine ? (
          <Text style={[styles.senderName, { color: bubbleTheme.accent }]}>
            {sender ? `${sender.emoji} ${sender.display_name}` : 'Friend'}
          </Text>
        ) : null}

        {replyPreviewOf ? (
          <View
            style={[
              styles.replyQuote,
              { backgroundColor: mine ? 'rgba(255,255,255,0.3)' : bubbleTheme.light },
            ]}
          >
            <Text style={[styles.replyQuoteSender, { color: mine ? palette.white : bubbleTheme.accent }]}>
              {replySender}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.replyQuoteText, { color: mine ? palette.white : palette.textSecondary }]}
            >
              {replyPreviewOf.message}
            </Text>
          </View>
        ) : null}

        {message.message_type === 'image' && message.media_url ? (
          <MediaImage pathOrUri={message.media_url} />
        ) : null}

        <Text style={[styles.bubbleText, { color: mine ? palette.white : palette.text }]}>
          {message.message}
        </Text>
        <Text style={[styles.timeText, { color: mine ? 'rgba(255,255,255,0.75)' : palette.textFaint }]}>
          {relativeTime(message.created_at)}
        </Text>
      </Pressable>

      {reactions.length > 0 ? (
        <View style={[styles.reactionRow, mine && styles.bubbleRowMine]}>
          {groupReactions(reactions).map(({ emoji, count }) => (
            <View key={emoji} style={[styles.reactionChip, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={styles.reactionChipEmoji}>{emoji}</Text>
              {count > 1 ? <Text style={styles.reactionChipCount}>{count}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MediaImage({ pathOrUri }: { pathOrUri: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    resolveMediaUrl(pathOrUri).then((resolved) => {
      if (mounted) setUrl(resolved);
    });
    return () => {
      mounted = false;
    };
  }, [pathOrUri]);
  if (!url) return null;
  return <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />;
}

function groupReactions(reactions: MessageReaction[]) {
  const map = new Map<string, number>();
  for (const r of reactions) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerEmoji: {
    fontSize: 26,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
    maxWidth: '86%',
  },
  bubbleRowMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubble: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  senderName: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 3,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  replyQuote: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyQuoteSender: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  replyQuoteText: {
    fontSize: 12,
    marginTop: 1,
  },
  mikoRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  mikoBubble: {
    maxWidth: '80%',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mikoName: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  mikoText: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
    bottom: -10,
    left: 40,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  reactionChipEmoji: {
    fontSize: 11,
  },
  reactionChipCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14.5,
    maxHeight: 96,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionSheet: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  reactionButton: {
    padding: 6,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  mediaImage: {
    width: 200,
    height: 150,
    borderRadius: 14,
    marginBottom: 6,
  },
});
