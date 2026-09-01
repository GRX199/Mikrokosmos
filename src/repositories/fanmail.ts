import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { FanMail } from '@/models';
import { mockFanMails, nextMockId } from './mockStore';

/**
 * Fan Mail — bot fans send letters (questions) to a member; the member
 * replies and the fan reacts. Dual-mode: Supabase when configured,
 * in-memory mock otherwise.
 */

export async function fetchFanMails(memberId: string): Promise<FanMail[]> {
  if (!isSupabaseConfigured) {
    return mockFanMails
      .filter((m) => m.member_id === memberId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await getSupabase()
    .from('fan_mails')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FanMail[];
}

export async function insertFanMail(
  memberId: string,
  draft: { fan_name: string; fan_emoji: string; question: string }
): Promise<FanMail> {
  if (!isSupabaseConfigured) {
    const mail: FanMail = {
      id: nextMockId(),
      member_id: memberId,
      fan_name: draft.fan_name,
      fan_emoji: draft.fan_emoji,
      question: draft.question,
      reply: null,
      reply_reaction: null,
      reply_reaction_at: null,
      reply_at: null,
      created_at: new Date().toISOString(),
    };
    mockFanMails.unshift(mail);
    return mail;
  }
  const { data, error } = await getSupabase()
    .from('fan_mails')
    .insert({
      member_id: memberId,
      fan_name: draft.fan_name,
      fan_emoji: draft.fan_emoji,
      question: draft.question,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FanMail;
}

export async function replyFanMail(mailId: string, reply: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const mail = mockFanMails.find((m) => m.id === mailId);
    if (mail) {
      mail.reply = reply;
      mail.reply_at = new Date().toISOString();
    }
    return;
  }
  const { error } = await getSupabase()
    .from('fan_mails')
    .update({ reply, reply_at: new Date().toISOString() })
    .eq('id', mailId);
  if (error) throw new Error(error.message);
}

/** The fan reacts to the member's reply (simulated fan behavior). */
export async function reactFanMail(
  mailId: string,
  reaction: 'love' | 'cry' | 'hype'
): Promise<void> {
  if (!isSupabaseConfigured) {
    const mail = mockFanMails.find((m) => m.id === mailId);
    if (mail) {
      mail.reply_reaction = reaction;
      mail.reply_reaction_at = new Date().toISOString();
    }
    return;
  }
  const { error } = await getSupabase()
    .from('fan_mails')
    .update({ reply_reaction: reaction, reply_reaction_at: new Date().toISOString() })
    .eq('id', mailId);
  if (error) throw new Error(error.message);
}
