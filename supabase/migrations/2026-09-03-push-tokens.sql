-- Push notification tokens (FCM via Expo push service).
--
-- A token is "the install" — one per (user, device). A user may have many
-- installs (phone + tablet); all of them get chat notifications.
--
-- Trigger: on INSERT into public.messages (someone sent a chat), notify
-- every OTHER member's installs via the notify-chat-push edge function.
-- Bot messages don't trigger anything (they only appear when the app runs).

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- App reads/writes its own tokens only.
create policy "own tokens read"   on public.push_tokens for select using (auth.uid() = user_id);
create policy "own tokens insert" on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "own tokens update" on public.push_tokens for update using (auth.uid() = user_id);
create policy "own tokens delete" on public.push_tokens for delete using (auth.uid() = user_id);

-- ─── INSERT trigger on messages → notify-chat-push edge function ──────────
--
-- The edge function verifies a shared secret header (PUSH_CALL_SECRET,
-- stored as a vault secret) instead of a user JWT — pg_net cannot sign
-- user JWTs. Only Postgres itself can call the function.

create or replace function public.notify_push_on_message()
returns trigger
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  -- Skip bot messages and empty system rows.
  if new.is_bot then
    return new;
  end if;
  if new.sender_id is null then
    return new;
  end if;

  -- Shared secret from the Supabase vault (set once, see instructions at
  -- the bottom of this file). Missing secret = push not configured yet:
  -- skip silently, the app still works (local notifications only).
  --
  -- NOTE (2026-09 platform vault API): read the decrypted value from the
  -- vault.decrypted_secrets VIEW (the old vault.decrypted_secret(uuid)
  -- function no longer exists; vault.secrets.secret is ciphertext).
  begin
    select decrypted_secret::text into v_secret
    from vault.decrypted_secrets
    where name = 'PUSH_CALL_SECRET'
    limit 1;
  exception when others then
    v_secret := null;
  end;
  if v_secret is null or v_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url     := 'https://pcgqcquoogombkvnjacp.supabase.co/functions/v1/notify-chat-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'message_id', new.id,
      'sender_id',  new.sender_id,
      'text',       new.message
    ),
    -- pg_net 0.20.x names this parameter timeout_milliseconds
    timeout_milliseconds := 5000
  );
  return new;
end;
$$ language plpgsql;

create trigger notify_push_on_message_trigger
  after insert on public.messages
  for each row execute function public.notify_push_on_message();

-- ─── Setup steps (one-time, in the Supabase dashboard) ────────────────────
-- 1. Database → Extensions: enable "pg_net" (HTTP from triggers) and
--    "vault" (secret storage).
-- 2. SQL editor: generate a strong secret and store it:
--      select vault.create_secret(
--        gen_random_uuid()::text || gen_random_uuid()::text,
--        'PUSH_CALL_SECRET'
--      );
-- 3. Functions → deploy notify-chat-push (supabase functions deploy,
--    from supabase/functions) — it reads the same vault secret to verify.
-- 4. Edge function secret (same value as PUSH_CALL_SECRET):
--      supabase secrets set PUSH_CALL_SECRET=<the-value>
--    …plus the Expo push access token:
--      supabase secrets set EXPO_ACCESS_TOKEN=<expo token>
--
-- Without these steps chat still works; notifications stay local-only.
