// Edge function: notify-fan-push
// ─────────────────────────────────────────────────────────────────────────
// Called by DB triggers (pg_net) on the fan Q&A board:
//   kind = 'question' → a fan question landed  (notify everyone but the poster)
//   kind = 'answer'   → a member answered       (notify everyone but the answerer)
// Same shared-secret auth + Expo push fan-out as notify-chat-push.

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

  const { kind, actor_id: actorId, fan_name: fanName, text } = (await req.json().catch(() => ({}))) as {
    kind?: string;
    actor_id?: string;
    fan_name?: string;
    text?: string;
  };
  if (kind !== 'question' && kind !== 'answer') {
    return new Response(JSON.stringify({ error: 'bad kind' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Legacy JWT service_role key (SVC_ROLE_JWT — see notify-chat-push notes).
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SVC_ROLE_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Who acted? (poster for questions, answerer for answers)
  let actorName = 'Sahabatmu';
  if (actorId) {
    const { data: actor } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', actorId)
      .single();
    if (actor?.display_name) actorName = actor.display_name;
  }

  // ─── Everyone except the actor. ─────────────────────────────────────────
  const { data: recipients } = await supabase
    .from('profiles')
    .select('id')
    .neq('id', actorId ?? '00000000-0000-0000-0000-000000000000');

  const recipientIds = (recipients ?? []).map((r) => r.id);
  if (recipientIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ─── Their installs' push tokens. ───────────────────────────────────────
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', recipientIds);

  const installs = (tokens ?? []).filter((t) => t.token);
  if (installs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const preview = (s?: string) => (s ?? '').replace(/\s+/g, ' ').slice(0, 80);
  const isQuestion = kind === 'question';
  const title = isQuestion ? 'Surat fans baru 💌' : `${actorName} menjawab ✨`;
  const body = isQuestion
    ? `${fanName ?? 'Seorang fans'} bertanya: ${preview(text)}`
    : `Di papan fans: ${preview(text)}`;

  const messages = installs.map((t) => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    data: { screen: 'fan-mail' },
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

    // Housekeeping: drop only permanently-dead device tokens.
    entries.forEach((d, idx) => {
      const err = String(d?.details?.error ?? d?.message ?? '');
      if (d?.status === 'error' && /DeviceNotRegistered|no such user/i.test(err)) {
        if (messages[idx]) staleTokens.push(messages[idx].to);
      }
    });
  } catch {
    // best-effort: the fan row is already saved
  }

  if (staleTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', staleTokens);
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
