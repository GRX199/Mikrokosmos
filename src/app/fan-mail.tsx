import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundedCard } from '@/components/RoundedCard';
import { useAuth } from '@/features/auth/SessionProvider';
import { useI18n } from '@/core/i18n';
import { RADIUS, useAppTheme } from '@/core/theme';
import { relativeTime } from '@/core/utils/date';
import type { FanMail } from '@/models';
import {
  fetchFanMails,
  insertFanMail,
  reactFanMail,
  replyFanMail,
} from '@/repositories/fanmail';
import { generateFanLetter } from '@/services/fanbot';
import { cancelNudge } from '@/services/nudges';

/**
 * Fan Mail 💌 — bot fans write letters to THIS member; she reads them
 * on a cozy letters shelf and replies whenever she likes. The fan then
 * reacts to her reply (love/cry/hype), like a real fan-vibe moment.
 */
export default function FanMailScreen() {
  const { theme, palette } = useAppTheme();
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const [mails, setMails] = useState<FanMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bringing, setBringing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<FanMail | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      setMails(await fetchFanMails(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not open your fan mail.'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    load();
  }, [load]);

  const bringNewLetter = async () => {
    if (!profile || bringing) return;
    setBringing(true);
    try {
      const draft = await generateFanLetter(
        profile,
        language,
        mails.map((m) => m.question)
      );
      const mail = await insertFanMail(profile.id, {
        fan_name: draft.name,
        fan_emoji: draft.emoji,
        question: draft.question,
      });
      setMails((prev) => [mail, ...prev]);
      cancelNudge('fan_mail').catch(() => undefined);
    } catch (e) {
      Alert.alert(t('Fan Mail 💌'), t('The letter got lost in the mail… try again?'));
    } finally {
      setBringing(false);
    }
  };

  const sendReply = async () => {
    if (!replyingTo) return;
    const text = replyDraft.trim();
    if (!text) return;
    const target = replyingTo;
    setReplyingTo(null);
    try {
      await replyFanMail(target.id, text);
      setMails((prev) =>
        prev.map((m) => (m.id === target.id ? { ...m, reply: text, reply_at: new Date().toISOString() } : m))
      );
      // The fan reacts ~1.2s after the reply lands (simulated).
      const reaction = pickFanReaction();
      setTimeout(() => {
        reactFanMail(target.id, reaction).catch(() => undefined);
        setMails((prev) =>
          prev.map((m) =>
            m.id === target.id
              ? {
                  ...m,
                  reply: text,
                  reply_at: new Date().toISOString(),
                  reply_reaction: reaction,
                  reply_reaction_at: new Date().toISOString(),
                }
              : m
          )
        );
      }, 1200);
    } catch {
      Alert.alert(t('Fan Mail 💌'), t('The letter got lost in the mail… try again?'));
    }
  };

  const unreadCount = mails.filter((m) => !m.reply).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: palette.text }]}>{t('Fan Mail 💌')}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            {t('Little letters from your fans')}
          </Text>
        </View>
        <Pressable
          onPress={bringNewLetter}
          disabled={bringing || !profile}
          style={[styles.bringButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.bringEmoji}>{bringing ? '📮' : '✉️'}</Text>
        </Pressable>
      </View>

      {/* Unread chip */}
      {unreadCount > 0 && (
        <View style={[styles.unreadChip, { backgroundColor: theme.light }]}>
          <Text style={[styles.unreadText, { color: theme.accent }]}>
            {unreadCount === 1
              ? t('1 letter is waiting for you 💌')
              : `${unreadCount} ${t('letters are waiting for you 💌')}`}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <EmptyState
            emoji="📡"
            title={t('Could not open your fan mail.')}
            subtitle={error}
            actionLabel={t('Try again')}
            onAction={load}
          />
        ) : loading ? (
          <EmptyState emoji="💌" title={t('Opening the letters…')} subtitle={null} />
        ) : mails.length === 0 ? (
          <EmptyState
            emoji="📮"
            title={t('No letters yet')}
            subtitle={t('Tap the envelope to receive your first fan letter!')}
          />
        ) : (
          mails.map((mail) => (
            <LetterCard
              key={mail.id}
              mail={mail}
              onReply={() => {
                setReplyDraft('');
                setReplyingTo(mail);
              }}
            />
          ))
        )}
      </ScrollView>

      {/* Reply sheet */}
      <Modal
        visible={!!replyingTo}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyingTo(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.replyOverlay}
        >
          <Pressable style={styles.replyOverlay} onPress={() => setReplyingTo(null)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <RoundedCard style={[styles.replyCard, { backgroundColor: palette.card }]}>
                <Text style={[styles.replyTitle, { color: palette.text }]}>
                  {t('Reply to')} {replyingTo?.fan_name}
                </Text>
                <TextInput
                  value={replyDraft}
                  onChangeText={setReplyDraft}
                  placeholder={t('Write something warm…')}
                  placeholderTextColor={palette.textFaint}
                  multiline
                  autoFocus
                  style={[styles.replyInput, { color: palette.text, borderColor: palette.border }]}
                />
                <PrimaryButton
                  label={t('Send Reply 💗')}
                  onPress={sendReply}
                  disabled={!replyDraft.trim()}
                />
                <Pressable onPress={() => setReplyingTo(null)} style={styles.laterButton}>
                  <Text style={[styles.laterText, { color: palette.textSecondary }]}>{t('Cancel')}</Text>
                </Pressable>
              </RoundedCard>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function pickFanReaction(): 'love' | 'cry' | 'hype' {
  const pool: ('love' | 'cry' | 'hype')[] = ['love', 'love', 'hype', 'cry'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function LetterCard({ mail, onReply }: { mail: FanMail; onReply: () => void }) {
  const { theme, palette } = useAppTheme();
  const { t, language } = useI18n();

  const reactionEmoji =
    mail.reply_reaction === 'love' ? '🥰' : mail.reply_reaction === 'cry' ? '🥺' : mail.reply_reaction === 'hype' ? '🤩' : null;

  return (
    <RoundedCard style={[styles.card, { backgroundColor: palette.card }]}>
      {/* Fan header */}
      <View style={styles.fanRow}>
        <View style={[styles.fanAvatar, { backgroundColor: theme.light }]}>
          <Text style={styles.fanAvatarEmoji}>{mail.fan_emoji}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.fanName, { color: palette.text }]}>{mail.fan_name}</Text>
          <Text style={[styles.fanTime, { color: palette.textFaint }]}>
            {relativeTime(mail.created_at, language)}
          </Text>
        </View>
        <Text style={styles.letterMark}>✉️</Text>
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: palette.text }]}>{mail.question}</Text>

      {/* Reply / CTA */}
      {mail.reply ? (
        <View style={[styles.replyBox, { backgroundColor: theme.light }]}>
          <Text style={[styles.replyLabel, { color: theme.accent }]}>{t('Your reply')}</Text>
          <Text style={[styles.replyText, { color: palette.text }]}>{mail.reply}</Text>
          {reactionEmoji && (
            <View style={styles.reactionRow}>
              <Text style={styles.reactionEmoji}>{reactionEmoji}</Text>
              <Text style={[styles.reactionText, { color: palette.textSecondary }]}>
                {t('the fan loved your reply')}{' '}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <PrimaryButton label={t('Write a Reply 💗')} onPress={onReply} />
      )}
    </RoundedCard>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  subtitle: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette } = useAppTheme();
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
      <Text style={[styles.emptyHint, { color: palette.textFaint }]}>{t('Fan Mail 💌')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: { padding: 4 },
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  bringButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bringEmoji: { fontSize: 20 },
  unreadChip: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 4,
  },
  unreadText: { fontSize: 12.5, fontWeight: '700' },
  list: { flex: 1, paddingHorizontal: 16 },
  card: { marginBottom: 14, padding: 16 },
  fanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fanAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanAvatarEmoji: { fontSize: 18 },
  fanName: { fontSize: 14.5, fontWeight: '700' },
  fanTime: { fontSize: 11.5, marginTop: 1 },
  letterMark: { fontSize: 16 },
  question: { fontSize: 15.5, lineHeight: 22, fontWeight: '500' },
  replyBox: { borderRadius: RADIUS.md, padding: 14, marginTop: 12, gap: 6 },
  replyLabel: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase' },
  replyText: { fontSize: 14.5, lineHeight: 21 },
  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  reactionEmoji: { fontSize: 16 },
  reactionText: { fontSize: 12.5 },
  replyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  replyCard: { margin: 12, marginBottom: 28, padding: 18, gap: 12 },
  replyTitle: { fontSize: 17, fontWeight: '800' },
  replyInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    minHeight: 90,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  laterButton: { alignItems: 'center', paddingVertical: 10 },
  laterText: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 13.5, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  emptyHint: { fontSize: 10, marginTop: 24 },
});
