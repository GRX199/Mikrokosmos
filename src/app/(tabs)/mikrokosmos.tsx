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
import { useI18n } from '@/core/i18n';
import { clearUnread, incrementUnread } from '@/stores/unreadChatStore';
import { useFocusEffect } from 'expo-router';

/** Mikrokosmos chat — the trio's private living room (spec section 19). */
export default function ChatScreen() {
  const { profile } = useAuth();
  const { theme, palette } = useAppTheme();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [isFocused, setIsFocused] = useState(true);
  const isFocusedRef = useRef(true);
  // Is the user reading near the bottom? If she scrolled up through
  // history, new messages must NOT yank her down.
  const nearBottomRef = useRef(true);
  const sendingRef = useRef(false);
  // Last known content height — guards onContentSizeChange against
  // Android layout oscillation (keyboard/insets) re-yanking the scroll.
  const lastContentHeightRef = useRef<number | null>(null);

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
      setError(e instanceof Error ? e.message : t('Could not open the chat.'));
    } finally {
      setLoading(false);
    }
  }, [loadReactions]);

  // NOTE: initial load happens in useFocusEffect below (fires on mount too)
  // — a second useEffect here caused a visible double-fetch "blink" every
  // time the tab opened or came back into focus.

  // Catch up on anything missed while the tab was in the background —
  // realtime can drop events (reconnects, deep sleep).
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      isFocusedRef.current = true;
      nearBottomRef.current = true; // reopening the chat = show the newest
      clearUnread();
      load();
      return () => {
        setIsFocused(false);
        isFocusedRef.current = false;
      };
    }, [load])
  );

  // Live updates: append incoming messages in realtime (kept sorted so the
  // newest message always lands at the bottom, even if events arrive late).
  useEffect(() => {
    const unsubscribe = subscribeToMessages((incoming) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming].sort(
          (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
        );
      });
      loadReactions([incoming]);
      // Increment unread if chat is not focused (use ref to avoid recreating subscription)
      if (!isFocusedRef.current) {
        incrementUnread();
      }
    });
    return unsubscribe;
  }, [loadReactions]);

  // ─── Inverted chat list (index 0 = newest) ───────────────────────────────
  // Android: a normal FlatList loses scroll position when the data array
  // is replaced on refocus (blink + "blank until touched" + snap-to-top).
  // Inverted lists keep offset 0 == newest message, so refocus needs no
  // scroll juggling at all and the position survives data refreshes.
  const invertedData = useMemo(() => [...messages].reverse(), [messages]);

  // New message while pinned near bottom → FlatList stays visually at the
  // newest (offset 0). No rAF scroll dance needed anymore.

  // Also scroll when the tab regains focus. Returning to the chat always
  // means: show the newest first.
  useFocusEffect(
    useCallback(() => {
      if (messages.length > 0) {
        // offset 0 in an inverted list IS the bottom (newest).
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      }
    }, [messages.length])
  );

  const replyPreview = useMemo(() => {
    if (!replyTo) return null;
    const sender = replyTo.is_bot ? MIKO.name : profileMap[replyTo.sender_id ?? '']?.display_name;
    return { sender, text: replyTo.message };
  }, [replyTo, profileMap]);

  async function handleSend() {
    // Synchronous ref guard: Android can fire onSubmitEditing twice in one
    // tick (IME action + raw key event). State guards are async and lose the
    // race, which double-sent the message.
    if (!profile || !draft.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    try {
      const sent = await sendMessage(profile.id, { message: text, reply_to: replyId });
      // Optimistic: append immediately so the message is visible even before
      // the realtime echo arrives (channels can drop events).
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id)
          ? prev
          : [...prev, sent].sort(
              (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
            )
      );
      nearBottomRef.current = true; // her own send always follows to the bottom
      if (!isSupabaseRealtime()) await load(); // mock mode: refresh manually
      // Miko replies to messages that mention her (only on the sender's device,
      // so the bot never gets duplicated across the 3 friends).
      void maybeAskMiko(text, profile);
    } finally {
      sendingRef.current = false;
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
      const sent = await sendMessage(profile.id, {
        message: draft.trim() || '📸',
        message_type: 'image',
        media_url: path ?? result.assets[0].uri,
        reply_to: replyTo?.id ?? null,
      });
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id)
          ? prev
          : [...prev, sent].sort(
              (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
            )
      );
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

  const [mikoTyping, setMikoTyping] = useState(false);

  async function maybeAskMiko(text: string, sender: Profile) {
    if (!/\bmiko\b/i.test(text)) return;
    setMikoTyping(true);
    try {
      const reply = await askMiko(
        text,
        sender.display_name,
        messages.map((m) => ({
          who: m.is_bot ? 'Miko' : profileMap[m.sender_id ?? '']?.display_name ?? 'Friend',
          text: m.message,
        })),
        language
      );
      // Use quota message if quota exceeded, otherwise use reply or fallback
      const mikoReply = reply ?? (isQuotaExceeded() ? getQuotaExceededMessage(language) : mikoFallbackReply(language));
      const sent = await sendMikoMessage(mikoReply);
      if (sent) {
        // Optimistic append — same guarantee as regular sends.
        setMessages((prev) =>
          prev.some((m) => m.id === sent.id)
            ? prev
            : [...prev, sent].sort(
                (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
              )
        );
      } else if (!isSupabaseRealtime()) {
        await load();
      }
    } catch {
      // Miko stays silent rather than breaking the chat.
    } finally {
      setMikoTyping(false);
    }
  }

  if (loading) return <LoadingView label={t('Opening the group chat…')} />;
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

        {/* Messages — inverted list: offset 0 == newest message. This is
            what real chat apps use; it kills the Android "blank until
            touched" / snap-to-top / blink issues on refocus. */}
        <FlatList
          ref={listRef}
          data={invertedData}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingTop: 12 }]}
          onScroll={(e) => {
            // Inverted list: offset 0 == newest (bottom). Scrolling UP in
            // visual terms means the offset grows; distanceFromBottom is
            // simply the offset itself.
            const { contentOffset } = e.nativeEvent;
            // "Near bottom" (newest) with a little tolerance (60px).
            nearBottomRef.current = contentOffset.y < 60;
          }}
          scrollEventThrottle={16}
          onContentSizeChange={(_w, h) => {
            // Track content height only — inverted lists at offset 0 stay
            // pinned to the newest automatically; no scroll juggling.
            lastContentHeightRef.current = h;
          }}
          ListHeaderComponent={
            mikoTyping ? (
              <View style={styles.mikoRow}>
                <View style={[styles.mikoBubble, { backgroundColor: theme.light, borderColor: theme.primary }]}>
                  <Text style={[styles.mikoName, { color: theme.accent }]}>
                    {MIKO.emoji} Miko
                  </Text>
                  <Text style={[styles.mikoTypingText, { color: palette.textSecondary }]}>
                    {t('thinking…')}
                  </Text>
                </View>
              </View>
            ) : null
          }
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
              placeholder={t('Say something cute…')}
              placeholderTextColor={palette.textFaint}
              style={[styles.input, { color: palette.text }]}
              multiline
              returnKeyLabel={t('Send')}
              returnKeyType="send"
              blurOnSubmit={false}
              submitBehavior="submit"
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

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  sender: Profile | null;
  replyPreviewOf: ChatMessage | null;
  profileMap: Record<string, Profile>;
  reactions: MessageReaction[];
  onLongPress: () => void;
  onReply: () => void;
}

/** Memoized: typing in the composer must never re-render the whole list. */
const MessageBubble = React.memo(function MessageBubble({
  message,
  mine,
  sender,
  replyPreviewOf,
  profileMap,
  reactions,
  onLongPress,
  onReply,
}: MessageBubbleProps) {
  const { theme, palette } = useAppTheme();
  const { language } = useI18n();

  if (message.is_bot) {
    return (
      <View style={styles.mikoRow}>
        <View style={[styles.mikoBubble, { backgroundColor: theme.light, borderColor: theme.primary }]}>
          <Text style={[styles.mikoName, { color: theme.accent }]}>
            {MIKO.emoji} Miko
          </Text>
          <Text style={[styles.mikoText, { color: palette.text }]}>{message.message}</Text>
          <Text style={[styles.timeText, { color: palette.textFaint }]}>
            {relativeTime(message.created_at, language)}
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
          {relativeTime(message.created_at, language)}
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
});

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
    // Inverted list: visual bottom (newest) is index 0 / offset 0. Empty
    // space must sit at the visual TOP (far from the composer), so the
    // content stays pinned to the bottom.
    justifyContent: 'flex-start',
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
  mikoTypingText: {
    fontSize: 12.5,
    fontStyle: 'italic',
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
    boxShadow: '0px 8px 20px rgba(0,0,0,0.15)',
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
