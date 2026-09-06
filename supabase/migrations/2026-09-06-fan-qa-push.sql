-- Fan Q&A push notifications (same pattern as notify_push_on_message):
--   fan_questions INSERT → notify-fan-push kind='question'
--   fan_answers   INSERT → notify-fan-push kind='answer'
-- Auth: shared vault secret PUSH_CALL_SECRET via pg_net; edge function
-- verifies it. Missing secret = push not configured → skip silently.

create or replace function public.notify_push_on_fan_qa()
returns trigger
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_kind text;
  v_actor_id uuid;
  v_fan_name text;
  v_text text;
begin
  -- Which table fired?
  if tg_table_name = 'fan_questions' then
    v_kind := 'question';
    v_actor_id := null;               -- posted on the fan's behalf, no actor row
    v_fan_name := new.fan_name;
    v_text := new.question;
  else
    v_kind := 'answer';
    v_actor_id := new.member_id;      -- the answering member
    v_fan_name := null;
    v_text := new.answer;
  end if;

  -- Shared secret from the Supabase vault (see 2026-09-03-push-tokens.sql).
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
    url     := 'https://pcgqcquoogombkvnjacp.supabase.co/functions/v1/notify-fan-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'kind',     v_kind,
      'actor_id', v_actor_id,
      'fan_name', v_fan_name,
      'text',     v_text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$ language plpgsql;

create trigger notify_push_on_fan_question_trigger
  after insert on public.fan_questions
  for each row execute function public.notify_push_on_fan_qa();

create trigger notify_push_on_fan_answer_trigger
  after insert on public.fan_answers
  for each row execute function public.notify_push_on_fan_qa();
