-- MCSLI Learning Platform – 0010: hardening of anonymous endpoints
--  * verify_certificate: per-client rate limit + strict input validation
--  * contact form: per-client rate limit
--  * public website content: unverified impact statistics are never served to the public API
--
-- The database limiter is a second line of defence. The primary control for abusive traffic is an
-- edge rule (Cloudflare / hosting WAF) – see docs/SUPABASE_SETUP.md → "Rate limiting".

create schema if not exists private;

create table if not exists private.rate_limits (
  bucket text not null,
  subject text not null,          -- SHA-256 of the client IP, never the IP itself
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, subject, window_start)
);
revoke all on private.rate_limits from public;

-- Client identity as seen by PostgREST (Supabase's gateway sets X-Forwarded-For; Cloudflare adds
-- CF-Connecting-IP). Falls back to a shared bucket when no header is present (direct SQL).
create or replace function private.client_fingerprint() returns text
language plpgsql stable set search_path = '' as $$
declare h json; v text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  v := coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), h->>'x-real-ip');
  v := nullif(trim(v), '');
  return encode(extensions.digest(coalesce(v, 'no-client-ip'), 'sha256'), 'hex');
end $$;

-- Returns true when the call is allowed; counts it either way.
create or replace function private.rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        v_hits int;
begin
  insert into private.rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, private.client_fingerprint(), v_window, 1)
  on conflict (bucket, subject, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- opportunistic cleanup keeps the table tiny without a cron job
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end $$;
revoke all on function private.rate_limit(text, int, int) from public;
revoke all on function private.client_fingerprint() from public;

-- PUBLIC certificate verification: 30 lookups per client per 10 minutes.
drop function if exists public.verify_certificate(text);
create or replace function public.verify_certificate(p_number text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_number text := upper(trim(coalesce(p_number, ''))); c record;
begin
  if not private.rate_limit('verify_certificate', 30, 600) then
    raise exception 'Too many verification requests. Please wait a few minutes and try again.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if v_number !~ '^MCSLI-[0-9]{4}-[A-Z0-9]{6}$' then
    return jsonb_build_object('found', false);
  end if;
  select * into c from public.certificates where certificate_number = v_number;
  if c.id is null then
    return jsonb_build_object('found', false);
  end if;
  -- Only what a verifier needs. No user id, e-mail, enrollment, payment, identity or notes.
  return jsonb_build_object(
    'found', true,
    'certificate_number', c.certificate_number,
    'student_name', c.student_name,
    'course_title', c.course_title,
    'certificate_title', c.certificate_title,
    'completion_date', c.completion_date,
    'issued_at', c.issued_at,
    'status', c.status,
    'revoked_at', c.revoked_at
  );
end $$;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

-- Contact / volunteer form: 5 submissions per client per 10 minutes.
create or replace function public.tg_contact_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    if not private.rate_limit('contact_messages', 5, 600) then
      raise exception 'Too many messages sent. Please wait a few minutes and try again.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.status := 'new';
  end if;
  return new;
end $$;
drop trigger if exists contact_rate_limit on public.contact_messages;
create trigger contact_rate_limit before insert on public.contact_messages for each row execute function public.tg_contact_rate_limit();

-- ---------------------------------------------------------------------------
-- Public website content. The raw impact_stats row may contain figures MCSLI has not verified;
-- the public (anon and students) read content through site_content_public, which keeps only
-- stats with "verified": true. Admins still read/write the full rows.
-- ---------------------------------------------------------------------------
drop policy if exists site_content_select_public on public.site_content;
create policy site_content_select_public on public.site_content for select using (is_public and key <> 'impact_stats');

create or replace view public.site_content_public
with (security_invoker = false) as
  select sc.key,
    case when sc.key = 'impact_stats' then
      jsonb_set(sc.value, '{stats}', coalesce((
        select jsonb_agg(s) from jsonb_array_elements(coalesce(sc.value->'stats', '[]'::jsonb)) s
        where (s->>'verified')::boolean is true), '[]'::jsonb))
    else sc.value end as value,
    sc.updated_at
  from public.site_content sc
  where sc.is_public;
grant select on public.site_content_public to anon, authenticated;
