import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { ChatMessage, MessageReaction, MessageType } from '@/models';
import { mockMessages, nextMockId } from './mockStore';

/**
 * Mikrokosmos group chat.
 * Realtime mode subscribes to Supabase changes; mock mode notifies
 * local listeners so the UI behaves identically.
 */

type Listener = () => void;
const mockListeners = new Set<Listener>();

export async function fetchMessages(limit = 100): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) {
    return [...mockMessages].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit);
  }
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ChatMessage[]).reverse();
}

export interface SendMessageInput {
  message: string;
  message_type?: MessageType;
  media_url?: string | null;
  reply_to?: string | null;
}

export async function sendMessage(senderId: string, input: SendMessageInput): Promise<ChatMessage> {
  if (!isSupabaseConfigured) {
    const msg: ChatMessage = {
      id: nextMockId(),
      sender_id: senderId,
      message: input.message,
      message_type: input.message_type ?? 'text',
      media_url: input.media_url ?? null,
      reply_to: input.reply_to ?? null,
      is_bot: false,
      created_at: new Date().toISOString(),
    };
    mockMessages.push(msg);
    mockListeners.forEach((l) => l());
    return msg;
  }
  const { data, error } = await getSupabase()
    .from('messages')
    .insert({
      sender_id: senderId,
      message: input.message,
      message_type: input.message_type ?? 'text',
      media_url: input.media_url ?? null,
      reply_to: input.reply_to ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ChatMessage;
}

/**
 * Miko speaks with sender_id = null + is_bot = true.
 * With Supabase, the RLS insert policy allows user_id IS NULL rows for
 * authenticated members, so the triggering member's token is used.
 */
export async function sendMikoMessage(text: string): Promise<void> {
  if (!isSupabaseConfigured) {
    mockMessages.push({
      id: nextMockId(),
      sender_id: null,
      message: text,
      message_type: 'text',
      is_bot: true,
      created_at: new Date().toISOString(),
    });
    mockListeners.forEach((l) => l());
    return;
  }
  await getSupabase().from('messages').insert({
    sender_id: null,
    message: text,
    message_type: 'text',
    is_bot: true,
  });
}

export async function fetchReactions(messageIds: string[]): Promise<MessageReaction[]> {
  if (!messageIds.length) return [];
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase()
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageReaction[];
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
  existing?: MessageReaction
): Promise<void> {
  if (!isSupabaseConfigured) return; // reactions are server-only in demo mode
  if (existing) {
    const { error } = await getSupabase()
      .from('message_reactions')
      .delete()
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await getSupabase()
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: userId, emoji });
    if (error) throw new Error(error.message);
  }
}

/**
 * Subscribe to new messages. Returns an unsubscribe function.
 * In Supabase mode this uses the realtime channel on `messages`.
 */
export function subscribeToMessages(onChange: (message: ChatMessage) => void): () => void {
  if (!isSupabaseConfigured) {
    const listener: Listener = () => {
      const last = mockMessages[mockMessages.length - 1];
      if (last) onChange(last);
    };
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  }
  const channel = getSupabase()
    .channel('mikrokosmos-chat')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onChange(payload.new as ChatMessage)
    )
    .subscribe();
  return () => {
    getSupabase().removeChannel(channel);
  };
}
