// Edge function: notify-chat-push
// ─────────────────────────────────────────────────────────────────────────
// Called by the DB trigger (pg_net) whenever a chat message is inserted.
// Fans out an Expo push notification to every OTHER member's installs.
//
// Design notes (philosophy: gentle, never pushy):
//  - Bot messages never trigger (the DB trigger already filters is_bot).
//  - The CLIENT decides display: when the app is running with the chat
//    screen open, its notification handler suppresses the banner (the
//    realtime toast already showed it). Backgrounded/killed installs
//    always see the system notification.
//  - Delivery failures are logged, never thrown (the chat message is
//    already saved; push is best-effort).
//
// Auth: verify_jwt=false. Only the DB trigger may call this — it sends the
// shared vault secret (PUSH_CALL_SECRET) in the x-push-secret header, which
// we verify against the same vault secret stored in edge secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Only the DB trigger may call this (shared vault secret).
  const secret = req.headers.get('x-push-secret') ?? '';
  const expected = Deno.env.get('PUSH_CALL_SECRET') ?? '';
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const payload = await req.json().catch(() => null);
  const messageId: string | undefined = payload?.message_id;
  const senderId: string | undefined = payload?.sender_id;
  const text: string = payload?.text ?? '';
  if (!messageId || !senderId) {
    return new Response(JSON.stringify({ error: 'bad payload' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Who sent it?
  const { data: sender } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', senderId)
    .single();

  // ─── Who should be notified? Every member except the sender. ───────────
  const { data: recipients } = await supabase
    .from('profiles')
    .select('id, username')
    .neq('id', senderId);

  const recipientIds = (recipients ?? []).map((r) => r.id);
  if (recipientIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── Load their installs' push tokens. ──────────────────────────────────
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id, platform')
    .in('user_id', recipientIds);

  const installs = (tokens ?? []).filter((t) => t.token);
  if (installs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── Send via Expo push API (one batch call). ───────────────────────────
  const messages = installs.map((t) => ({
    to: t.token,
    sound: 'default',
    title: 'Pesan baru 💌',
    body: `${sender?.display_name ?? 'Sahabatmu'}: ${preview(text)}`,
    data: { screen: 'mikrokosmos', message_id: messageId },
    priority: 'high',
    channelId: 'chat',
  }));

  const expoHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) expoHeaders.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const staleTokens: string[] = [];
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: expoHeaders,
      body: JSON.stringify(messages),
    });
    const result = await res.json().catch(() => null);
    const entries: any[] = Array.isArray(result?.data) ? result.data : [];
    sent = entries.filter((d) => d?.status === 'ok').length;

    // Housekeeping: drop tokens for uninstalled/logged-out devices.
    // Expo returns one entry per message, in order.
    entries.forEach((d, idx) => {
      if (d?.status === 'error' && /not registered|invalid|no such user/i.test(d.details?.error ?? '')) {
        if (messages[idx]) staleTokens.push(messages[idx].to);
      }
    });
  } catch (err) {
    console.error('expo push fetch failed', err);
  }

  for (const token of staleTokens) {
    await supabase.from('push_tokens').delete().eq('token', token).then(
      () => {},
      () => {}
    );
  }

  return new Response(JSON.stringify({ sent, removed_stale: staleTokens.length }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

function preview(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}
