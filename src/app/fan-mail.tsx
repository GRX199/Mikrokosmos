import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GradientCard, RoundedCard } from '@/components/RoundedCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingView } from '@/components/LoadingView';
import { ErrorState } from '@/components/ErrorState';
import { useI18n } from '@/core/i18n';
import { useAppTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/SessionProvider';
import {
  answerFanQuestion,
  fetchFanBoard,
  insertFanQuestion,
  reactFanAnswer,
  subscribeToFanBoard,
} from '@/repositories/fanmail';
import { fetchProfiles } from '@/repositories/profiles';
import { generateFanLetter } from '@/services/fanbot';
import type { FanAnswer, FanQuestion } from '@/models';
import type { Profile } from '@/models';

const REACTIONS = ['love', 'cry', 'hype'] as const;
const REACTION_EMOJI: Record<string, string> = { love: '🥰', cry: '🥺', hype: '🤩' };

/**
 * Fan Mail 💌 — a SHARED Q&A board. Bot fans ask questions to the whole
 * trio; every member reads the same board and answers from the same
 * page. Each member has one answer per question (editable), and the
 * fan "reacts" to each answer with a cute emoji.
 */
export default function FanMailScreen() {
  const { t } = useI18n();
  const { language } = useI18n();
  const { theme, palette } = useAppTheme();
  const { profile } = useAuth();

  const [questions, setQuestions] = useState<FanQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bringing, setBringing] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [answering, setAnswering] = useState<FanQuestion | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [board, all] = await Promise.all([fetchFanBoard(), fetchProfiles()]);
      setQuestions(board);
      setProfiles(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: a new fan question or another member's answer lands live.
  useEffect(() => {
    const dispose = subscribeToFanBoard(
      (q) => {
        setQuestions((prev) => (prev ?? []).some((p) => p.id === q.id) ? prev : [{ ...q, answers: [] }, ...(prev ?? [])]);
      },
      (a) => {
        setQuestions((prev) =>
          (prev ?? []).map((q) => {
            if (q.id !== a.question_id) return q;
            if ((q.answers ?? []).some((x) => x.id === a.id)) return q;
            return { ...q, answers: [...(q.answers ?? []), a] };
          })
        );
      }
    );
    return dispose;
  }, []);

  const bringNewQuestion = async () => {
    if (!profile || bringing) return;
    setBringing(true);
    try {
      const draft = await generateFanLetter(
        language,
        (questions ?? []).map((q) => q.question)
      );
      const q = await insertFanQuestion({
        fan_name: draft.name,
        fan_emoji: draft.emoji,
        question: draft.question,
      });
      setQuestions((prev) => [q, ...(prev ?? [])]);
    } catch {
      Alert.alert(t('Fan Mail 💌'), t('The letter got lost in the mail… try again?'));
    } finally {
      setBringing(false);
    }
  };

  const submitAnswer = async () => {
    if (!profile || !answering) return;
    const text = answerDraft.trim();
    if (!text) return;
    const target = answering;
    setAnswering(null);
    try {
      const saved = await answerFanQuestion(target.id, profile.id, text);
      setQuestions((prev) =>
        (prev ?? []).map((q) => {
          if (q.id !== target.id) return q;
          const others = (q.answers ?? []).filter((a) => a.member_id !== profile.id);
          return { ...q, answers: [...others, saved].sort((a, b) => a.created_at.localeCompare(b.created_at)) };
        })
      );
      // The fan reacts to the answer after a short delay (~1.2s) 💗
      setTimeout(() => {
        const reactions = REACTIONS;
        const pick = reactions[Math.floor(Math.random() * reactions.length)];
        reactFanAnswer(saved.id, pick)
          .then(() => {
            setQuestions((prev) =>
              (prev ?? []).map((q) => ({
                ...q,
                answers: (q.answers ?? []).map((a) => (a.id === saved.id ? { ...a, reaction: pick } : a)),
              }))
            );
          })
          .catch(() => undefined);
      }, 1200);
    } catch {
      Alert.alert(t('Fan Mail 💌'), t('The reply got lost — try again?'));
    }
  };

  const startAnswering = (q: FanQuestion) => {
    const mine = q.answers?.find((a) => a.member_id === profile?.id);
    setAnswerDraft(mine?.answer ?? '');
    setAnswering(q);
  };

  if (!questions && error) return <ErrorState message={error} onRetry={load} />;
  if (!questions) return <LoadingView label={t('Opening the letters…')} />;

  const nameOf = (id: string) => profiles.find((p) => p.id === id);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>{t('Fan Mail 💌')}</Text>
        <Pressable
          onPress={bringNewQuestion}
          disabled={bringing}
          style={[styles.askButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.askButtonText}>{bringing ? '…' : t('New fan question')}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.primary} />
        }
      >
        <SectionTitle title={t('Fans ask, everyone answers 💗')} />
        {questions.length === 0 ? (
          <RoundedCard style={styles.emptyCard}>
            <Text style={[styles.emptyEmoji]}>💌</Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {t('Tap the envelope to receive your first fan letter!')}
            </Text>
          </RoundedCard>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              profiles={profiles}
              myId={profile?.id ?? ''}
              nameOf={nameOf}
              onAnswer={() => startAnswering(q)}
            />
          ))
        )}
      </ScrollView>

      {/* Answer sheet */}
      <Modal visible={answering !== null} transparent animationType="slide" onRequestClose={() => setAnswering(null)}>
        <KeyboardAvoidingView
          style={[styles.backdrop, { backgroundColor: palette.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropFill} onPress={() => setAnswering(null)}>
            <Pressable onPress={() => {}} style={styles.sheetAnchor}>
              <RoundedCard style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: palette.text }]} numberOfLines={1}>
                    {answering?.fan_emoji} {answering?.fan_name}
                  </Text>
                  <Pressable onPress={() => setAnswering(null)} style={styles.closeButton}>
                    <Ionicons name="close" size={22} color={palette.textSecondary} />
                  </Pressable>
                </View>
                <Text style={[styles.sheetQuestion, { color: palette.textSecondary }]}>
                  {answering?.question}
                </Text>
                <TextInput
                  value={answerDraft}
                  onChangeText={setAnswerDraft}
                  placeholder={t('Write something warm…')}
                  placeholderTextColor={palette.textFaint}
                  multiline
                  style={[styles.answerInput, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
                  autoFocus
                />
                <Pressable
                  onPress={submitAnswer}
                  disabled={!answerDraft.trim()}
                  style={[styles.sendButton, { backgroundColor: answerDraft.trim() ? theme.primary : palette.border }]}
                >
                  <Text style={[styles.sendButtonText, { color: answerDraft.trim() ? palette.white : palette.textFaint }]}>
                    {t('Send Reply 💗')}
                  </Text>
                </Pressable>
              </RoundedCard>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function QuestionCard({
  question,
  profiles,
  myId,
  nameOf,
  onAnswer,
}: {
  question: FanQuestion;
  profiles: Profile[];
  myId: string;
  nameOf: (id: string) => Profile | undefined;
  onAnswer: () => void;
}) {
  const { t } = useI18n();
  const { theme, palette } = useAppTheme();
  const answers = question.answers ?? [];
  const myAnswer = answers.find((a) => a.member_id === myId);
  const waitingForMe = !myAnswer;

  return (
    <GradientCard style={styles.card}>
      <View style={styles.fanRow}>
        <Text style={styles.fanEmoji}>{question.fan_emoji}</Text>
        <View style={styles.fanMeta}>
          <Text style={[styles.fanName, { color: palette.text }]}>{question.fan_name}</Text>
          <Text style={[styles.fanTime, { color: palette.textFaint }]}>
            {relativeTime(question.created_at, t)}
          </Text>
        </View>
      </View>
      <Text style={[styles.questionText, { color: palette.text }]}>{question.question}</Text>

      {/* Member answers */}
      {answers.length > 0 && (
        <View style={[styles.answersWrap, { borderColor: palette.border }]}>
          {answers.map((a) => (
            <AnswerRow key={a.id} answer={a} member={nameOf(a.member_id)} />
          ))}
        </View>
      )}

      {waitingForMe ? (
        <Pressable
          onPress={onAnswer}
          style={[styles.answerButton, { backgroundColor: theme.light, borderColor: theme.primary }]}
        >
          <Ionicons name="chatbubble-ellipses" size={15} color={theme.primary} />
          <Text style={[styles.answerButtonText, { color: theme.primary }]}>
            {t('Answer this fan 💗')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onAnswer}
          style={[styles.answerButton, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <Ionicons name="create-outline" size={15} color={palette.textSecondary} />
          <Text style={[styles.answerButtonText, { color: palette.textSecondary }]}>
            {t('Edit your reply')}
          </Text>
        </Pressable>
      )}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: palette.textFaint }]}>
          {answers.length}/{profiles.length} {t('members answered')}
        </Text>
      </View>
    </GradientCard>
  );
}

function AnswerRow({ answer, member }: { answer: FanAnswer; member?: Profile }) {
  const { palette } = useAppTheme();
  const memberTheme = member ? { color: themeColorFor(member) } : { color: palette.text };
  return (
    <View style={styles.answerRow}>
      <Text style={[styles.answerEmoji]}>{member?.emoji ?? '💗'}</Text>
      <View style={styles.answerBody}>
        <Text style={[styles.answerName, memberTheme]}>{member?.display_name ?? 'Member'}</Text>
        <Text style={[styles.answerText, { color: palette.text }]}>{answer.answer}</Text>
        {answer.reaction ? (
          <Text style={[styles.reactionText, { color: palette.textFaint }]}>
            {REACTION_EMOJI[answer.reaction]} {t9n(answer.reaction)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Tiny helper: member theme accent (kept soft, no full palettes here). */
function themeColorFor(member: Profile): string {
  return member.theme === 'sky' ? '#7EC8E3' : member.theme === 'pink' ? '#F4A7B9' : '#B79CED';
}

function t9n(reaction: string): string {
  if (reaction === 'love') return 'the fan loved this reply';
  if (reaction === 'cry') return 'the fan was touched';
  return 'the fan got hyped!';
}

function relativeTime(iso: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('just now');
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '900' },
  backButton: { padding: 6 },
  askButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  askButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  scroll: { padding: 16, paddingTop: 6, paddingBottom: 40, gap: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  card: { padding: 16, gap: 10 },
  fanRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fanEmoji: { fontSize: 24 },
  fanMeta: { flexShrink: 1 },
  fanName: { fontSize: 14, fontWeight: '800' },
  fanTime: { fontSize: 11 },
  questionText: { fontSize: 14.5, lineHeight: 21, fontWeight: '600' },
  answersWrap: { borderTopWidth: 1, paddingTop: 10, gap: 10, marginTop: 2 },
  answerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  answerEmoji: { fontSize: 18, marginTop: 1 },
  answerBody: { flexShrink: 1 },
  answerName: { fontSize: 12.5, fontWeight: '800' },
  answerText: { fontSize: 13, lineHeight: 19, marginTop: 1 },
  reactionText: { fontSize: 11.5, fontStyle: 'italic', marginTop: 3 },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  answerButtonText: { fontSize: 13, fontWeight: '700' },
  countRow: { alignItems: 'center' },
  countText: { fontSize: 11 },
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdropFill: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  sheetAnchor: { width: '100%', maxWidth: 520, padding: 12, paddingBottom: 24 },
  sheet: { padding: 18, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  closeButton: { padding: 6 },
  sheetQuestion: { fontSize: 13.5, lineHeight: 20, fontStyle: 'italic' },
  answerInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  sendButton: { paddingVertical: 13, borderRadius: 16, alignItems: 'center' },
  sendButtonText: { fontWeight: '800', fontSize: 14 },
});
