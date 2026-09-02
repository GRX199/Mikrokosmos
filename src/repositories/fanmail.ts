import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { FanAnswer, FanQuestion } from '@/models';
import { mockFanQuestions, nextMockId } from './mockStore';

/**
 * Fan Q&A — a shared board. Fans (bots) ask the trio; every member
 * answers on the same page. Dual-mode: Supabase when configured,
 * in-memory mock otherwise.
 */

/** Fetch the board: questions with all member answers joined in. */
export async function fetchFanBoard(limit = 50): Promise<FanQuestion[]> {
  if (!isSupabaseConfigured) {
    return mockFanQuestions
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await getSupabase()
    .from('fan_questions')
    .select('*, fan_answers(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as FanQuestion),
    answers: ((row.fan_answers as FanAnswer[] | null) ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ),
  }));
}

/** Post a new fan question (a member posts it on the fan's behalf). */
export async function insertFanQuestion(
  draft: { fan_name: string; fan_emoji: string; question: string }
): Promise<FanQuestion> {
  if (!isSupabaseConfigured) {
    const q: FanQuestion = {
      id: nextMockId(),
      ...draft,
      created_at: new Date().toISOString(),
      answers: [],
    };
    mockFanQuestions.unshift(q);
    return q;
  }
  const { data, error } = await getSupabase()
    .from('fan_questions')
    .insert(draft)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as FanQuestion), answers: [] };
}

/** A member answers a question (one answer per member per question). */
export async function answerFanQuestion(
  questionId: string,
  memberId: string,
  answer: string
): Promise<FanAnswer> {
  if (!isSupabaseConfigured) {
    const q = mockFanQuestions.find((m) => m.id === questionId);
    let row = q?.answers?.find((a) => a.member_id === memberId);
    if (q && row) {
      row.answer = answer;
      row.created_at = new Date().toISOString();
      return row;
    }
    const fresh: FanAnswer = {
      id: nextMockId(),
      question_id: questionId,
      member_id: memberId,
      answer,
      reaction: null,
      reaction_at: null,
      created_at: new Date().toISOString(),
    };
    q?.answers?.push(fresh);
    return fresh;
  }
  const { data, error } = await getSupabase()
    .from('fan_answers')
    .upsert(
      { question_id: questionId, member_id: memberId, answer },
      { onConflict: 'question_id,member_id' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FanAnswer;
}

/** The fan reacts to a member's answer (simulated fan behavior). */
export async function reactFanAnswer(
  answerId: string,
  reaction: 'love' | 'cry' | 'hype'
): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const q of mockFanQuestions) {
      const row = q.answers?.find((a) => a.id === answerId);
      if (row) {
        row.reaction = reaction;
        row.reaction_at = new Date().toISOString();
        return;
      }
    }
    return;
  }
  const { error } = await getSupabase()
    .from('fan_answers')
    .update({ reaction, reaction_at: new Date().toISOString() })
    .eq('id', answerId);
  if (error) throw new Error(error.message);
}

/**
 * Realtime: new fan questions + new answers land on the board live.
 * Returns an unsubscribe function. Mock mode: no-op.
 */
export function subscribeToFanBoard(
  onQuestion: (q: FanQuestion) => void,
  onAnswer: (a: FanAnswer) => void
): () => void {
  if (!isSupabaseConfigured) return () => {};
  const db = getSupabase();
  const channel = db
    .channel('mikrokosmos-fan-board')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fan_questions' },
      (payload) => onQuestion(payload.new as FanQuestion)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fan_answers' },
      (payload) => onAnswer(payload.new as FanAnswer)
    )
    .subscribe();
  return () => {
    db.removeChannel(channel);
  };
}
