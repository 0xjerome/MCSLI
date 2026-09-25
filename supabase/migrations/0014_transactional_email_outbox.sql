-- MCSLI Learning Platform – 0014: transactional e-mail outbox (payments)
--
-- Payment events queue an e-mail in public.email_outbox (same transaction as the event, so nothing is
-- lost). A pg_cron job calls the `email-dispatch` Edge Function every minute while messages are
-- queued; the function sends them through Resend and records the outcome.
--
-- Activation (see docs/SUPABASE_SETUP.md → "Transactional e-mail"):
--   * Edge Function secret RESEND_API_KEY (entered by MCSLI in the Supabase dashboard),
--   * verified Resend domain for no-reply@mcsli.org,
--   * private.email_dispatch_config row (function URL) + Vault secret mcsli_dispatch_secret
--     (created by the deploy step; the same value is set as the function's DISPATCH_SECRET).
-- Until then messages simply wait in the queue (status 'queued'); nothing fails.
-- Re-runnable.

-- pg_net / pg_cron exist on Supabase; plain-Postgres test databases skip the scheduler.
do $$ begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_net/pg_cron not available (%): e-mail dispatch scheduler not installed', sqlerrm;
end $$;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  template text not null check (template in ('payment_received', 'payment_confirmed', 'payment_rejected')),
  subject text not null,
  payload jsonb not null default '{}'::jsonb,   -- display values only (amount, purpose, receipt); no identity data
  entity_type text,
  entity_id text,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at);
alter table public.email_outbox enable row level security;
drop policy if exists email_outbox_select_admin on public.email_outbox;
create policy email_outbox_select_admin on public.email_outbox for select using (public.is_admin());
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;

create or replace function public.fn_queue_email(p_user uuid, p_template text, p_subject text, p_payload jsonb, p_entity_type text, p_entity_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select email into v_email from public.profiles where id = p_user;
  if v_email is null then return; end if;
  insert into public.email_outbox (user_id, to_email, template, subject, payload, entity_type, entity_id)
  values (p_user, v_email, p_template, p_subject, coalesce(p_payload, '{}'::jsonb), p_entity_type, p_entity_id);
end $$;

create or replace function public.tg_payment_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'amount', to_char(new.amount, 'FM999,999,999'), 'currency', new.currency, 'purpose', new.purpose,
    'installment', new.installment_number, 'reference', new.reference, 'receipt_number', new.receipt_number,
    'note', case when new.status = 'rejected' then left(coalesce(new.review_note, ''), 500) end);
  if tg_op = 'INSERT' then
    perform public.fn_queue_email(new.user_id, 'payment_received', 'We received your MCSLI payment details', v_payload, 'payment', new.id::text);
  elsif new.status is distinct from old.status and new.status = 'confirmed' then
    perform public.fn_queue_email(new.user_id, 'payment_confirmed', 'Your MCSLI payment is confirmed', v_payload, 'payment', new.id::text);
  elsif new.status is distinct from old.status and new.status = 'rejected' then
    perform public.fn_queue_email(new.user_id, 'payment_rejected', 'Your MCSLI payment could not be confirmed', v_payload, 'payment', new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists payment_email on public.payments;
create trigger payment_email after insert or update of status on public.payments for each row execute function public.tg_payment_email();

-- Dispatcher configuration (project-specific; filled in by the deploy step, never committed)
create schema if not exists private;
create table if not exists private.email_dispatch_config (
  id boolean primary key default true check (id),
  function_url text not null
);
revoke all on private.email_dispatch_config from public;

-- Called by the Edge Function (service role) to claim a batch atomically.
create or replace function public.claim_email_batch(p_limit int default 20)
returns setof public.email_outbox language sql security definer set search_path = public as $$
  update public.email_outbox o set status = 'sending', attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where status = 'queued' or (status = 'sending' and attempts < 5 and created_at < now() - interval '10 minutes')
    order by created_at limit greatest(1, least(p_limit, 50)) for update skip locked)
  returning o.*;
$$;

create or replace function public.complete_email(p_id uuid, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'queued' end,
    sent_at = case when p_ok then now() end,
    provider_message_id = p_provider_id,
    last_error = case when p_ok then null else left(p_error, 300) end
  where id = p_id;
$$;

-- pg_cron → Edge Function, only when something is queued and the dispatcher is configured.
create or replace function private.kick_email_dispatch() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'queued') then return; end if;
  select function_url into v_url from private.email_dispatch_config;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'mcsli_dispatch_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret), body := '{}'::jsonb, timeout_milliseconds := 20000);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'mcsli-email-dispatch') then
      perform cron.unschedule('mcsli-email-dispatch');
    end if;
    perform cron.schedule('mcsli-email-dispatch', '* * * * *', 'select private.kick_email_dispatch()');
  end if;
end $$;

revoke execute on function public.fn_queue_email(uuid, text, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.tg_payment_email() from public, anon, authenticated;
revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
revoke execute on function public.complete_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;
grant execute on function public.complete_email(uuid, boolean, text, text) to service_role;
revoke all on function private.kick_email_dispatch() from public;
