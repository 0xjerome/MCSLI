-- MCSLI Learning Platform – 20260927140000: cohorts as first-class content + native applications
-- Re-runnable. Extends the existing public.cohorts model (no second cohort architecture).
--
--   COURSE  = curriculum/program (one row per program, reused by every intake)
--   COHORT  = a specific intake taking a course during a period (public page, applications, dates)
--   COHORT APPLICATION = a person asking to join a cohort (before any account/enrollment/payment)
--
-- Public visitors read cohorts only through public_cohorts()/public_cohort(); they submit through
-- submit_cohort_application(), which enforces the deadline, rate limits, validation and duplicate
-- checks server-side. Applications reach enrollments only through the existing enroll_in_course()
-- (the applicant, with the cohort pre-selected) or an explicit admin assignment.

-- ---------------------------------------------------------------------------
-- 1. Cohort model
-- ---------------------------------------------------------------------------
alter table public.cohorts
  add column if not exists cohort_number integer,
  add column if not exists slug text,
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists delivery_mode text not null default 'hybrid',
  add column if not exists physical_location text,
  add column if not exists online_details text,
  add column if not exists schedule_notes text,
  add column if not exists application_opens_at timestamptz,
  add column if not exists application_deadline timestamptz,
  add column if not exists status_override text,
  add column if not exists capacity integer,
  add column if not exists is_published boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists hero_image_path text,
  add column if not exists announcement_url text,
  add column if not exists certificate_description text,
  add column if not exists eligibility text,
  add column if not exists registration_fee numeric(12,0),
  add column if not exists tuition_online numeric(12,0),
  add column if not exists tuition_physical numeric(12,0),
  add column if not exists currency text not null default 'UGX',
  add column if not exists auto_accept boolean not null default false,
  add column if not exists fallback_form_url text,
  add column if not exists verified_participant_count integer,
  add column if not exists completion_summary text,
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.cohorts add constraint cohorts_delivery_mode_check check (delivery_mode in ('online', 'physical', 'hybrid'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_status_override_check check (status_override is null or status_override in ('applications_open', 'applications_closed', 'completed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_number_check check (cohort_number is null or cohort_number between 1 and 999);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_capacity_check check (capacity is null or capacity > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_participants_check check (verified_participant_count is null or verified_participant_count >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_slug_check check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,59}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cohorts add constraint cohorts_dates_check check (end_date is null or start_date is null or end_date >= start_date);
exception when duplicate_object then null; end $$;
create unique index if not exists cohorts_slug_uq on public.cohorts (slug) where slug is not null;
create unique index if not exists cohorts_number_uq on public.cohorts (cohort_number) where cohort_number is not null;
create index if not exists cohorts_public_idx on public.cohorts (is_published, cohort_number desc);

-- slug defaults to "cohort-<number>" (or a slugified name); the audit trigger from 0008 keeps logging changes
create or replace function public.tg_cohort_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := case when new.cohort_number is not null then 'cohort-' || new.cohort_number
      else left(regexp_replace(lower(trim(new.name)), '[^a-z0-9]+', '-', 'g'), 60) end;
    new.slug := trim(both '-' from new.slug);
    if new.slug !~ '^[a-z0-9][a-z0-9-]{1,59}$' then new.slug := 'cohort-' || left(replace(new.id::text, '-', ''), 8); end if;
  end if;
  new.delivery_mode := coalesce(new.delivery_mode, 'hybrid');
  new.currency := coalesce(new.currency, 'UGX');
  new.sources := coalesce(new.sources, '[]'::jsonb);
  new.is_published := coalesce(new.is_published, false);
  new.is_featured := coalesce(new.is_featured, false);
  new.auto_accept := coalesce(new.auto_accept, false);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists cohort_defaults on public.cohorts;
create trigger cohort_defaults before insert or update on public.cohorts for each row execute function public.tg_cohort_defaults();
-- give pre-existing cohorts a slug (the trigger fills it in)
update public.cohorts set updated_at = now() where slug is null;

-- Derived status (never only manual text). Phase: upcoming | in_progress | completed.
create or replace function public.fn_cohort_phase(c public.cohorts) returns text
language sql stable set search_path = '' as $$
  select case
    when c.status_override = 'completed' then 'completed'
    when c.end_date is not null and c.end_date < current_date then 'completed'
    when c.start_date is not null and c.start_date <= current_date then 'in_progress'
    else 'upcoming' end;
$$;
-- Applications: open | closed | opening_soon. Deadline and opening time are enforced here (server-side).
create or replace function public.fn_cohort_applications_state(c public.cohorts) returns text
language sql stable set search_path = '' as $$
  select case
    when c.status_override = 'applications_open' then 'open'
    when c.status_override in ('applications_closed', 'completed') then 'closed'
    when c.end_date is not null and c.end_date < current_date then 'closed'
    when not c.is_open then 'closed'
    when c.application_opens_at is not null and now() < c.application_opens_at then 'opening_soon'
    when c.application_deadline is not null and now() > c.application_deadline then 'closed'
    else 'open' end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Configurable application questions
-- ---------------------------------------------------------------------------
create table if not exists public.cohort_questions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (length(label) between 2 and 200),
  help_text text,
  question_type text not null check (question_type in ('short_text', 'long_text', 'email', 'phone', 'date', 'single_choice', 'multiple_choice', 'yes_no', 'country', 'location', 'delivery_mode')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  is_active boolean not null default true,
  is_sensitive boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, key)
);
create index if not exists cohort_questions_cohort_idx on public.cohort_questions (cohort_id, position);
alter table public.cohort_questions enable row level security;
revoke all on public.cohort_questions from public, anon, authenticated;
grant select, insert, update, delete on public.cohort_questions to authenticated;
drop policy if exists cohort_questions_select_staff on public.cohort_questions;
create policy cohort_questions_select_staff on public.cohort_questions for select using (public.is_staff());
drop policy if exists cohort_questions_write_admin on public.cohort_questions;
create policy cohort_questions_write_admin on public.cohort_questions for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists set_updated_at on public.cohort_questions;
create trigger set_updated_at before update on public.cohort_questions for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Applications (kept after a cohort closes; a cohort with applications cannot be deleted)
-- ---------------------------------------------------------------------------
create table if not exists public.cohort_applications (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  reference text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (length(full_name) between 3 and 120),
  email text not null,
  phone text,
  delivery_mode text not null check (delivery_mode in ('online', 'physical', 'hybrid')),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'under_review', 'accepted', 'waitlisted', 'rejected', 'withdrawn')),
  answers jsonb not null default '[]'::jsonb,          -- snapshot: [{key,label,type,answer,sensitive}]
  source text not null default 'native' check (source in ('native', 'google_forms_import', 'staff')),
  external_ref text,
  consent_accepted_at timestamptz,
  submitted_at timestamptz not null default now(),
  email_verified_at timestamptz,
  verify_token_hash text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cohort_applications_cohort_idx on public.cohort_applications (cohort_id, status, submitted_at desc);
create index if not exists cohort_applications_user_idx on public.cohort_applications (user_id) where user_id is not null;
create unique index if not exists cohort_applications_email_uq on public.cohort_applications (cohort_id, lower(email)) where status <> 'withdrawn';
create unique index if not exists cohort_applications_user_uq on public.cohort_applications (cohort_id, user_id) where user_id is not null and status <> 'withdrawn';
create unique index if not exists cohort_applications_external_uq on public.cohort_applications (cohort_id, external_ref) where external_ref is not null;
create index if not exists cohort_applications_token_idx on public.cohort_applications (verify_token_hash) where verify_token_hash is not null;
alter table public.cohort_applications enable row level security;
revoke all on public.cohort_applications from public, anon, authenticated;
grant select on public.cohort_applications to authenticated;
drop policy if exists cohort_applications_select_admin on public.cohort_applications;
create policy cohort_applications_select_admin on public.cohort_applications for select using (public.is_admin());
-- applicants read their own application through my_cohort_applications() (no internal notes / tokens)
drop trigger if exists set_updated_at on public.cohort_applications;
create trigger set_updated_at before update on public.cohort_applications for each row execute function public.tg_set_updated_at();

create table if not exists public.cohort_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cohort_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists cohort_application_events_app_idx on public.cohort_application_events (application_id, created_at);
alter table public.cohort_application_events enable row level security;
revoke all on public.cohort_application_events from public, anon, authenticated;
grant select on public.cohort_application_events to authenticated;
drop policy if exists cohort_application_events_select_admin on public.cohort_application_events;
create policy cohort_application_events_select_admin on public.cohort_application_events for select using (public.is_admin());

-- the delivery mode a participant chose/was assigned, carried onto the enrollment
alter table public.enrollments add column if not exists delivery_mode text;
do $$ begin
  alter table public.enrollments add constraint enrollments_delivery_mode_check check (delivery_mode is null or delivery_mode in ('online', 'physical', 'hybrid'));
exception when duplicate_object then null; end $$;

-- cohort-scoped announcements (null = whole course, unchanged behaviour)
alter table public.discussion_threads add column if not exists cohort_id uuid references public.cohorts(id) on delete set null;
create index if not exists discussion_threads_cohort_idx on public.discussion_threads (cohort_id) where cohort_id is not null;

-- ---------------------------------------------------------------------------
-- 4. E-mail outbox: cohort templates + sending to an address without an account
-- ---------------------------------------------------------------------------
alter table public.email_outbox drop constraint if exists email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'payment_received', 'payment_confirmed', 'payment_rejected',
  'cohort_application_received', 'cohort_application_accepted', 'cohort_application_waitlisted', 'cohort_application_rejected',
  'cohort_enrollment_ready', 'cohort_starting_soon'));

create or replace function private.queue_email_to(p_to_email text, p_user uuid, p_template text, p_subject text, p_payload jsonb, p_entity_type text, p_entity_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_to_email is null or p_to_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  insert into public.email_outbox (user_id, to_email, template, subject, payload, entity_type, entity_id)
  values (p_user, lower(p_to_email), p_template, p_subject, coalesce(p_payload, '{}'::jsonb), p_entity_type, p_entity_id);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------
create or replace function private.normalize_email(p text) returns text
language sql immutable set search_path = '' as $$ select lower(trim(coalesce(p, ''))); $$;

-- Keeps digits (and a leading +); Ugandan local numbers (07…) become +2567…
create or replace function private.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  d := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
  if d = '' then return null; end if;
  d := regexp_replace(d, '(?<=.)\+', '', 'g');
  if d ~ '^0[0-9]{9}$' then d := '+256' || substr(d, 2); end if;
  if d ~ '^256[0-9]{9}$' then d := '+' || d; end if;
  if length(regexp_replace(d, '[^0-9]', '', 'g')) < 9 then return null; end if;
  return left(d, 20);
end $$;

create or replace function private.next_application_reference(p_cohort public.cohorts) returns text
language plpgsql volatile security definer set search_path = public as $$
declare n int; ref text;
begin
  perform pg_advisory_xact_lock(hashtext('cohort_application_ref:' || p_cohort.id::text));
  select count(*) + 1 into n from public.cohort_applications where cohort_id = p_cohort.id;
  loop
    ref := format('MCSLI-C%s-%s-%s', coalesce(p_cohort.cohort_number::text, 'X'), to_char(now(), 'YYYY'), lpad(n::text, 6, '0'));
    exit when not exists (select 1 from public.cohort_applications where reference = ref);
    n := n + 1;
  end loop;
  return ref;
end $$;

-- Validates and snapshots the answers against the cohort's ACTIVE questions.
create or replace function private.snapshot_application_answers(p_cohort_id uuid, p_answers jsonb, p_delivery_mode text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q record; v jsonb; out jsonb := '[]'::jsonb; opts text[]; s text; el jsonb;
begin
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then raise exception 'answers must be an object' using errcode = '22023'; end if;
  for q in select * from public.cohort_questions where cohort_id = p_cohort_id and is_active order by position, created_at loop
    v := coalesce(p_answers, '{}'::jsonb) -> q.key;
    if q.question_type = 'delivery_mode' then v := to_jsonb(p_delivery_mode); end if;
    if v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
      if q.required then raise exception 'Please answer "%".', q.label using errcode = 'P0001'; end if;
      continue;
    end if;
    select coalesce(array_agg(o #>> '{}'), '{}') into opts from jsonb_array_elements(case when jsonb_typeof(q.options) = 'array' then q.options else '[]'::jsonb end) o;
    if q.question_type in ('single_choice', 'yes_no') then
      if jsonb_typeof(v) <> 'string' then raise exception 'Invalid answer for "%".', q.label using errcode = '22023'; end if;
      s := v #>> '{}';
      if q.question_type = 'yes_no' and s not in ('yes', 'no') then raise exception 'Answer "%" with yes or no.', q.label using errcode = '22023'; end if;
      if q.question_type = 'single_choice' and array_length(opts, 1) > 0 and not (s = any(opts)) and not (s ~ '^Other: ' and 'Other' = any(opts)) then
        raise exception 'Invalid choice for "%".', q.label using errcode = '22023';
      end if;
      v := to_jsonb(left(s, 300));
    elsif q.question_type = 'multiple_choice' then
      if jsonb_typeof(v) <> 'array' then raise exception 'Invalid answer for "%".', q.label using errcode = '22023'; end if;
      for el in select * from jsonb_array_elements(v) loop
        s := el #>> '{}';
        if array_length(opts, 1) > 0 and not (s = any(opts)) and not (s ~ '^Other: ' and 'Other' = any(opts)) then raise exception 'Invalid choice for "%".', q.label using errcode = '22023'; end if;
      end loop;
      if jsonb_array_length(v) > 20 then raise exception 'Too many choices for "%".', q.label using errcode = '22023'; end if;
    elsif q.question_type = 'email' then
      s := lower(trim(v #>> '{}'));
      if s !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail address for "%".', q.label using errcode = '22023'; end if;
      v := to_jsonb(s);
    elsif q.question_type = 'phone' then
      s := private.normalize_phone(v #>> '{}');
      if s is null then raise exception 'Enter a valid phone number for "%".', q.label using errcode = '22023'; end if;
      v := to_jsonb(s);
    elsif q.question_type = 'date' then
      begin
        s := (v #>> '{}')::date::text;
      exception when others then
        raise exception 'Enter a valid date for "%".', q.label using errcode = '22023';
      end;
      v := to_jsonb(s);
    else
      if jsonb_typeof(v) <> 'string' then raise exception 'Invalid answer for "%".', q.label using errcode = '22023'; end if;
      v := to_jsonb(left(trim(v #>> '{}'), case when q.question_type = 'long_text' then 4000 else 300 end));
    end if;
    out := out || jsonb_build_object('key', q.key, 'label', q.label, 'type', q.question_type, 'answer', v, 'sensitive', q.is_sensitive);
  end loop;
  return out;
end $$;

-- Public JSON shape of a cohort (no internal fields)
create or replace function private.cohort_public_json(c public.cohorts) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'cohort_number', c.cohort_number, 'tagline', c.tagline, 'description', c.description,
    'delivery_mode', c.delivery_mode, 'physical_location', c.physical_location, 'online_details', c.online_details, 'schedule_notes', c.schedule_notes,
    'start_date', c.start_date, 'end_date', c.end_date, 'application_opens_at', c.application_opens_at, 'application_deadline', c.application_deadline,
    'capacity', c.capacity, 'is_featured', c.is_featured, 'hero_image_path', c.hero_image_path, 'announcement_url', c.announcement_url,
    'certificate_description', c.certificate_description, 'eligibility', c.eligibility,
    'registration_fee', c.registration_fee, 'tuition_online', c.tuition_online, 'tuition_physical', c.tuition_physical, 'currency', c.currency,
    'fallback_form_url', c.fallback_form_url, 'verified_participant_count', c.verified_participant_count, 'completion_summary', c.completion_summary,
    'sources', c.sources, 'phase', public.fn_cohort_phase(c), 'applications', public.fn_cohort_applications_state(c),
    'course', (select jsonb_build_object('id', co.id, 'slug', co.slug, 'title', co.title, 'short_description', co.short_description,
        'duration_months', co.duration_months, 'certificate_title', co.certificate_title, 'is_published', co.is_published) from public.courses co where co.id = c.course_id));
$$;

-- ---------------------------------------------------------------------------
-- 6. Public read
-- ---------------------------------------------------------------------------
create or replace function public.public_cohorts() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select private.cohort_public_json(c) from public.cohorts c where c.is_published
  order by c.cohort_number desc nulls last, c.start_date desc nulls last, c.created_at desc;
$$;

create or replace function public.public_cohort(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select private.cohort_public_json(c) || jsonb_build_object('questions', (
      select coalesce(jsonb_agg(jsonb_build_object('key', q.key, 'label', q.label, 'help_text', q.help_text, 'question_type', q.question_type,
        'options', q.options, 'required', q.required, 'is_sensitive', q.is_sensitive, 'position', q.position) order by q.position, q.created_at), '[]'::jsonb)
      from public.cohort_questions q where q.cohort_id = c.id and q.is_active))
  from public.cohorts c where c.is_published and c.slug = lower(trim(p_slug)) limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 7. Submitting an application (anonymous or signed in)
-- ---------------------------------------------------------------------------
create or replace function public.submit_cohort_application(p_slug text, p_full_name text, p_email text, p_phone text, p_delivery_mode text, p_answers jsonb default '{}'::jsonb, p_consent boolean default false, p_website text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.cohorts; v_email text; v_phone text; v_name text; v_user uuid; v_profile_email text; v_id uuid; v_ref text; v_status text;
        v_token text; v_hash text; v_answers jsonb; v_verified timestamptz;
begin
  -- honeypot field filled by bots
  if coalesce(p_website, '') <> '' then raise exception 'Spam check failed.' using errcode = 'P0001'; end if;
  if not public.is_staff() and not private.rate_limit('cohort_application', 5, 3600) then
    raise exception 'Too many applications from this connection. Please try again later.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  select * into c from public.cohorts where slug = lower(trim(p_slug)) and is_published;
  if c.id is null then raise exception 'cohort not found' using errcode = 'P0002'; end if;
  if public.fn_cohort_applications_state(c) <> 'open' then
    raise exception 'Applications for % are closed.', c.name using errcode = 'P0001';
  end if;
  v_name := left(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), 120);
  if length(v_name) < 3 then raise exception 'Enter your full name.' using errcode = '22023'; end if;
  v_email := private.normalize_email(p_email);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'Enter a valid e-mail address.' using errcode = '22023'; end if;
  v_phone := private.normalize_phone(p_phone);
  if v_phone is null then raise exception 'Enter a valid phone number (WhatsApp) including the country code.' using errcode = '22023'; end if;
  if p_delivery_mode is null or p_delivery_mode not in ('online', 'physical', 'hybrid') then raise exception 'Choose how you want to attend.' using errcode = '22023'; end if;
  if c.delivery_mode <> 'hybrid' and p_delivery_mode <> c.delivery_mode then raise exception 'This cohort is % only.', c.delivery_mode using errcode = '22023'; end if;
  if not coalesce(p_consent, false) then raise exception 'Please confirm the declaration to submit your application.' using errcode = '22023'; end if;
  v_user := auth.uid();
  if v_user is not null then
    select lower(email) into v_profile_email from public.profiles where id = v_user;
    if exists (select 1 from public.cohort_applications where cohort_id = c.id and user_id = v_user and status <> 'withdrawn') then
      raise exception 'You have already applied for %. See "My applications" in your account.', c.name using errcode = '23505';
    end if;
  end if;
  if exists (select 1 from public.cohort_applications where cohort_id = c.id and lower(email) = v_email and status <> 'withdrawn') then
    raise exception 'An application with this e-mail address already exists for %. Check your inbox for your reference number, or contact info@mcsli.org.', c.name using errcode = '23505';
  end if;
  v_answers := private.snapshot_application_answers(c.id, p_answers, p_delivery_mode);
  v_status := case when c.auto_accept then 'accepted' else 'submitted' end;
  v_id := gen_random_uuid();
  v_ref := private.next_application_reference(c);
  if v_user is not null and v_profile_email = v_email then
    v_verified := now();
  else
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    v_hash := encode(extensions.digest(convert_to(v_token, 'utf8'), 'sha256'), 'hex');
  end if;
  insert into public.cohort_applications (id, cohort_id, reference, user_id, full_name, email, phone, delivery_mode, status, answers, source, consent_accepted_at, submitted_at, email_verified_at, verify_token_hash)
  values (v_id, c.id, v_ref, v_user, v_name, v_email, v_phone, p_delivery_mode, v_status, v_answers, 'native', now(), now(), v_verified, v_hash);
  insert into public.cohort_application_events (application_id, from_status, to_status, actor_id, note) values (v_id, null, v_status, v_user, case when c.auto_accept then 'auto-accepted (cohort setting)' else null end);
  perform public.fn_audit('cohort_application.submitted', 'cohort_application', v_id::text, v_user, jsonb_build_object('cohort_id', c.id, 'reference', v_ref, 'delivery_mode', p_delivery_mode, 'source', 'native', 'auto_accept', c.auto_accept));
  perform private.queue_email_to(v_email, v_user, 'cohort_application_received', format('MCSLI %s application received – %s', c.name, v_ref),
    jsonb_build_object('reference', v_ref, 'cohort_name', c.name, 'full_name', v_name, 'delivery_mode', p_delivery_mode, 'verify_token', v_token, 'auto_accepted', c.auto_accept), 'cohort_application', v_id::text);
  if c.auto_accept then
    perform private.queue_email_to(v_email, v_user, 'cohort_application_accepted', format('You are accepted – MCSLI %s (%s)', c.name, v_ref),
      jsonb_build_object('reference', v_ref, 'cohort_name', c.name, 'full_name', v_name, 'cohort_slug', c.slug), 'cohort_application', v_id::text);
  end if;
  return jsonb_build_object('application_id', v_id, 'reference', v_ref, 'status', v_status, 'submitted_at', now(), 'full_name', v_name, 'email', v_email,
    'cohort', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'cohort_number', c.cohort_number), 'email_verification_required', v_verified is null);
end $$;

-- E-mail ownership for anonymous applications (link in the confirmation e-mail).
create or replace function public.verify_cohort_application(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare a public.cohort_applications; v_hash text;
begin
  if not private.rate_limit('cohort_application_verify', 20, 600) then raise exception 'Too many attempts. Please try again later.' using errcode = 'P0001', hint = 'rate_limited'; end if;
  if p_token is null or length(p_token) <> 48 or p_token !~ '^[0-9a-f]+$' then raise exception 'This verification link is not valid.' using errcode = 'P0002'; end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex');
  update public.cohort_applications set email_verified_at = coalesce(email_verified_at, now()), verify_token_hash = null
    where verify_token_hash = v_hash returning * into a;
  if a.id is null then raise exception 'This verification link is not valid or was already used.' using errcode = 'P0002'; end if;
  return jsonb_build_object('reference', a.reference, 'full_name', a.full_name, 'cohort', (select jsonb_build_object('name', name, 'slug', slug) from public.cohorts where id = a.cohort_id));
end $$;

-- Own applications for a signed-in person (links applications made before the account existed).
create or replace function public.my_cohort_applications() returns setof jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select lower(email) into v_email from public.profiles where id = auth.uid();
  update public.cohort_applications set user_id = auth.uid(), email_verified_at = coalesce(email_verified_at, now()), verify_token_hash = null
    where user_id is null and lower(email) = v_email and status <> 'withdrawn'
    and not exists (select 1 from public.cohort_applications x where x.cohort_id = cohort_applications.cohort_id and x.user_id = auth.uid() and x.status <> 'withdrawn');
  return query
    select jsonb_build_object('id', a.id, 'reference', a.reference, 'status', a.status, 'delivery_mode', a.delivery_mode, 'submitted_at', a.submitted_at,
      'email_verified', a.email_verified_at is not null, 'enrollment_id', a.enrollment_id, 'reviewed_at', a.reviewed_at,
      'answers', (select coalesce(jsonb_agg(x) filter (where not coalesce((x->>'sensitive')::boolean, false)), '[]'::jsonb) from jsonb_array_elements(a.answers) x),
      'cohort', private.cohort_public_json(c))
    from public.cohort_applications a join public.cohorts c on c.id = a.cohort_id
    where a.user_id = auth.uid() order by a.submitted_at desc;
end $$;

-- Applications made before sign-up are linked when the profile appears.
create or replace function public.tg_link_cohort_applications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.cohort_applications set user_id = new.id
    where user_id is null and lower(email) = lower(new.email) and status <> 'withdrawn'
    and not exists (select 1 from public.cohort_applications x where x.cohort_id = cohort_applications.cohort_id and x.user_id = new.id and x.status <> 'withdrawn');
  return new;
end $$;
drop trigger if exists link_cohort_applications on public.profiles;
create trigger link_cohort_applications after insert on public.profiles for each row execute function public.tg_link_cohort_applications();

-- When an accepted applicant enrolls with the cohort pre-selected, the application is linked and the
-- chosen delivery mode is carried onto the enrollment.
create or replace function public.tg_link_application_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.cohort_id is null then return new; end if;
  select * into a from public.cohort_applications where cohort_id = new.cohort_id and user_id = new.user_id and status = 'accepted' and enrollment_id is null limit 1;
  if a.id is not null then
    update public.cohort_applications set enrollment_id = new.id where id = a.id;
    if new.delivery_mode is null then update public.enrollments set delivery_mode = a.delivery_mode where id = new.id; end if;
    perform public.fn_audit('cohort_application.enrolled', 'cohort_application', a.id::text, new.user_id, jsonb_build_object('cohort_id', new.cohort_id, 'enrollment_id', new.id, 'reference', a.reference));
  end if;
  return new;
end $$;
drop trigger if exists link_application_enrollment on public.enrollments;
create trigger link_application_enrollment after insert or update of cohort_id on public.enrollments for each row execute function public.tg_link_application_enrollment();

-- enroll_in_course: a cohort may be chosen while its applications are open, or by an accepted applicant.
create or replace function public.enroll_in_course(p_course_id uuid, p_plan public.payment_plan_type, p_cohort_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; c record; v_id uuid; v_tuition numeric; ch public.cohorts;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.account_status <> 'active' then raise exception 'account suspended' using errcode = '42501'; end if;
  if coalesce((select value from public.platform_settings where key = 'registration_open'), 'true'::jsonb) = 'false'::jsonb then
    raise exception 'Enrollment is currently closed. Please contact MCSLI for the next intake.' using errcode = 'P0001';
  end if;
  select * into c from public.courses where id = p_course_id and is_published and not is_archived;
  if c.id is null then raise exception 'course not available' using errcode = 'P0002'; end if;
  if exists (select 1 from public.enrollments where user_id = p.id and course_id = c.id) then
    raise exception 'already enrolled' using errcode = '23505';
  end if;
  if p_cohort_id is not null then
    select * into ch from public.cohorts where id = p_cohort_id and course_id = c.id;
    if ch.id is null then raise exception 'cohort not open' using errcode = 'P0001'; end if;
    -- the derived state honours the manual switch, the opening time and the deadline
    if not (public.fn_cohort_applications_state(ch) = 'open'
            or exists (select 1 from public.cohort_applications a where a.cohort_id = ch.id and a.user_id = p.id and a.status = 'accepted')) then
      raise exception 'cohort not open' using errcode = 'P0001';
    end if;
  end if;
  -- price comes from the course and the student's nationality – never from the client
  v_tuition := case when p.nationality = 'ugandan' then c.tuition_national else c.tuition_international end;
  insert into public.enrollments (user_id, course_id, cohort_id, plan_type, nationality, currency, registration_fee, tuition_amount, installments)
  values (p.id, c.id, p_cohort_id, p_plan, p.nationality, c.currency, c.registration_fee, v_tuition, public.fn_build_installments(c.id, p.nationality, p_plan))
  returning id into v_id;
  perform public.fn_audit('enrollment.created', 'enrollment', v_id::text, p.id, jsonb_build_object('course_id', c.id, 'plan', p_plan, 'tuition', v_tuition, 'cohort_id', p_cohort_id));
  return v_id;
end $$;

-- Cohorts a signed-in student may enroll into for a course (open intakes + their accepted cohort).
create or replace function public.my_enrollable_cohorts(p_course_id uuid) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select private.cohort_public_json(c) || jsonb_build_object('accepted', exists (select 1 from public.cohort_applications a where a.cohort_id = c.id and a.user_id = auth.uid() and a.status = 'accepted'))
  from public.cohorts c
  where c.course_id = p_course_id and auth.uid() is not null
    and (public.fn_cohort_applications_state(c) = 'open' or exists (select 1 from public.cohort_applications a where a.cohort_id = c.id and a.user_id = auth.uid() and a.status = 'accepted'))
    and public.fn_cohort_phase(c) <> 'completed'
  order by (exists (select 1 from public.cohort_applications a where a.cohort_id = c.id and a.user_id = auth.uid() and a.status = 'accepted')) desc, c.cohort_number desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- 8. Staff review and cohort management (admins; audited)
-- ---------------------------------------------------------------------------
create or replace function public.review_cohort_application(p_application_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.cohort_applications; c public.cohorts; v_to text; v_action text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into a from public.cohort_applications where id = p_application_id for update;
  if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into c from public.cohorts where id = a.cohort_id;
  v_to := case p_decision when 'review' then 'under_review' when 'accept' then 'accepted' when 'waitlist' then 'waitlisted'
                          when 'reject' then 'rejected' when 'reopen' then 'submitted' when 'withdraw' then 'withdrawn' else null end;
  if v_to is null then raise exception 'unknown decision' using errcode = '22023'; end if;
  if a.status = 'withdrawn' and p_decision <> 'reopen' then raise exception 'This application was withdrawn.' using errcode = 'P0001'; end if;
  if a.enrollment_id is not null and p_decision in ('reject', 'waitlist', 'withdraw') then raise exception 'This applicant is already enrolled; change the enrollment instead.' using errcode = 'P0001'; end if;
  if v_to = a.status then return jsonb_build_object('id', a.id, 'status', a.status); end if;
  update public.cohort_applications set status = v_to, reviewed_by = auth.uid(), reviewed_at = now() where id = a.id;
  insert into public.cohort_application_events (application_id, from_status, to_status, actor_id, note) values (a.id, a.status, v_to, auth.uid(), left(p_note, 500));
  v_action := 'cohort_application.' || v_to;
  perform public.fn_audit(v_action, 'cohort_application', a.id::text, a.user_id, jsonb_build_object('cohort_id', a.cohort_id, 'reference', a.reference, 'from', a.status, 'to', v_to));
  if v_to = 'accepted' then
    perform private.queue_email_to(a.email, a.user_id, 'cohort_application_accepted', format('You are accepted – MCSLI %s (%s)', c.name, a.reference),
      jsonb_build_object('reference', a.reference, 'cohort_name', c.name, 'full_name', a.full_name, 'cohort_slug', c.slug, 'note', left(p_note, 500)), 'cohort_application', a.id::text);
  elsif v_to = 'waitlisted' then
    perform private.queue_email_to(a.email, a.user_id, 'cohort_application_waitlisted', format('Waiting list – MCSLI %s (%s)', c.name, a.reference),
      jsonb_build_object('reference', a.reference, 'cohort_name', c.name, 'full_name', a.full_name, 'note', left(p_note, 500)), 'cohort_application', a.id::text);
  elsif v_to = 'rejected' then
    perform private.queue_email_to(a.email, a.user_id, 'cohort_application_rejected', format('Your MCSLI %s application (%s)', c.name, a.reference),
      jsonb_build_object('reference', a.reference, 'cohort_name', c.name, 'full_name', a.full_name, 'note', left(p_note, 500)), 'cohort_application', a.id::text);
  end if;
  return jsonb_build_object('id', a.id, 'status', v_to);
end $$;

create or replace function public.set_cohort_application_notes(p_application_id uuid, p_notes text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.cohort_applications set internal_notes = left(p_notes, 4000) where id = p_application_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

-- Link an accepted applicant (who has an account and an enrollment in the cohort's course) to the cohort.
create or replace function public.assign_application_enrollment(p_application_id uuid, p_enrollment_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare a public.cohort_applications; e public.enrollments; c public.cohorts;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into a from public.cohort_applications where id = p_application_id for update;
  if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if a.status <> 'accepted' then raise exception 'Accept the application first.' using errcode = 'P0001'; end if;
  select * into e from public.enrollments where id = p_enrollment_id;
  if e.id is null then raise exception 'enrollment not found' using errcode = 'P0002'; end if;
  select * into c from public.cohorts where id = a.cohort_id;
  if e.course_id <> c.course_id then raise exception 'The enrollment is for a different course than this cohort.' using errcode = 'P0001'; end if;
  if a.user_id is null then
    if not exists (select 1 from public.profiles p where p.id = e.user_id and lower(p.email) = lower(a.email)) then
      raise exception 'The enrollment belongs to a different e-mail address than the application.' using errcode = 'P0001';
    end if;
    update public.cohort_applications set user_id = e.user_id where id = a.id;
  elsif a.user_id <> e.user_id then
    raise exception 'The enrollment belongs to a different person.' using errcode = 'P0001';
  end if;
  update public.enrollments set cohort_id = c.id, delivery_mode = coalesce(delivery_mode, a.delivery_mode) where id = e.id;
  update public.cohort_applications set enrollment_id = e.id where id = a.id;
  perform public.fn_audit('cohort_application.enrolled', 'cohort_application', a.id::text, e.user_id, jsonb_build_object('cohort_id', c.id, 'enrollment_id', e.id, 'reference', a.reference, 'by_staff', true));
  perform public.fn_queue_email(e.user_id, 'cohort_enrollment_ready', format('Your MCSLI %s enrollment is ready', c.name),
    jsonb_build_object('reference', a.reference, 'cohort_name', c.name, 'full_name', a.full_name), 'cohort_application', a.id::text);
  return jsonb_build_object('application_id', a.id, 'enrollment_id', e.id, 'cohort_id', c.id);
end $$;

create or replace function public.set_cohort_applications_open(p_cohort_id uuid, p_open boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.cohorts set is_open = p_open, status_override = case when status_override = 'completed' then status_override else null end where id = p_cohort_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.fn_audit(case when p_open then 'cohort.applications_opened' else 'cohort.applications_closed' end, 'cohort', p_cohort_id::text, null, '{}'::jsonb);
end $$;

create or replace function public.mark_cohort_completed(p_cohort_id uuid, p_summary text default null, p_participants integer default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.cohorts set status_override = 'completed', is_open = false, completion_summary = coalesce(left(p_summary, 2000), completion_summary),
    verified_participant_count = coalesce(p_participants, verified_participant_count) where id = p_cohort_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.fn_audit('cohort.completed', 'cohort', p_cohort_id::text, null, jsonb_build_object('participants', p_participants));
end $$;

create or replace function public.staff_cohort_stats(p_cohort_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'not authorised' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'applications', count(*), 'submitted', count(*) filter (where status = 'submitted'), 'under_review', count(*) filter (where status = 'under_review'),
    'accepted', count(*) filter (where status = 'accepted'), 'waitlisted', count(*) filter (where status = 'waitlisted'), 'rejected', count(*) filter (where status = 'rejected'),
    'withdrawn', count(*) filter (where status = 'withdrawn'), 'enrolled', count(*) filter (where enrollment_id is not null),
    'imported', count(*) filter (where source = 'google_forms_import'), 'email_unverified', count(*) filter (where email_verified_at is null and status <> 'withdrawn'),
    'online', count(*) filter (where delivery_mode = 'online' and status in ('accepted', 'submitted', 'under_review')),
    'physical', count(*) filter (where delivery_mode = 'physical' and status in ('accepted', 'submitted', 'under_review')),
    'hybrid', count(*) filter (where delivery_mode = 'hybrid' and status in ('accepted', 'submitted', 'under_review')))
    from public.cohort_applications where cohort_id = p_cohort_id)
  || (select jsonb_build_object(
    'enrollments', count(*), 'payment_pending', count(*) filter (where status = 'pending_payment'), 'active_students', count(*) filter (where status = 'active'),
    'completed_students', count(*) filter (where status = 'completed'),
    'payment_confirmed', count(*) filter (where status in ('active', 'completed')),
    'enrolled_online', count(*) filter (where delivery_mode = 'online'), 'enrolled_physical', count(*) filter (where delivery_mode = 'physical'), 'enrolled_hybrid', count(*) filter (where delivery_mode = 'hybrid'))
    from public.enrollments where cohort_id = p_cohort_id);
end $$;

-- Copy the question set from another cohort (so future intakes are configured without a developer).
create or replace function public.copy_cohort_questions(p_from_cohort uuid, p_to_cohort uuid) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.cohort_questions (cohort_id, key, label, help_text, question_type, options, required, is_active, is_sensitive, position)
  select p_to_cohort, key, label, help_text, question_type, options, required, is_active, is_sensitive, position from public.cohort_questions
  where cohort_id = p_from_cohort and not exists (select 1 from public.cohort_questions t where t.cohort_id = p_to_cohort and t.key = cohort_questions.key);
  get diagnostics n = row_count;
  return n;
end $$;

-- The default MCSLI question set (derived from the Cohort 9 application form; identity numbers are
-- deliberately NOT collected here – the secure identity-verification step handles that later).
create or replace function public.seed_default_cohort_questions(p_cohort_id uuid) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.cohort_questions (cohort_id, key, label, help_text, question_type, options, required, is_sensitive, position)
  select p_cohort_id, q.key, q.label, q.help_text, q.question_type, q.options, q.required, q.is_sensitive, q.position from (values
    ('gender', 'Gender', 'Optional. Helps MCSLI plan classes.', 'single_choice', '["Male","Female","Prefer not to say"]'::jsonb, false, true, 10),
    ('age_group', 'Age group', null, 'single_choice', '["Below 10 years","10 - 17 years","17 - 25 years","25 - 30 years","30 - 35 years","Above 35 years"]'::jsonb, true, false, 20),
    ('residence', 'Where do you currently live? (country and district)', null, 'location', '[]'::jsonb, true, false, 30),
    ('nationality', 'Nationality', null, 'country', '[]'::jsonb, true, false, 40),
    ('education', 'Level of education', null, 'single_choice', '["Primary","O''Level","A''Level","Certificate","Diploma","University/College/Vocational","Other"]'::jsonb, false, false, 50),
    ('occupation', 'Current occupation', null, 'single_choice', '["Student","Employed","Self-employed","Volunteer","Other"]'::jsonb, false, false, 60),
    ('organisation', 'Name of school, university, organisation or workplace', null, 'short_text', '[]'::jsonb, false, false, 70),
    ('attendance', 'Which training option will you attend?', 'Online classes, physical classes in Kampala, or the Saturday-only option (physical and online).', 'delivery_mode', '[]'::jsonb, true, false, 80),
    ('experience', 'Have you studied Sign Language before?', null, 'single_choice', '["No experience","Beginner","Intermediate","Advanced"]'::jsonb, false, false, 90),
    ('heard_before', 'Have you ever heard about Sign Language before?', null, 'single_choice', '["Yes","No","Maybe"]'::jsonb, true, false, 100),
    ('motivation', 'Why do you want to learn Sign Language?', null, 'long_text', '[]'::jsonb, true, false, 110),
    ('plans', 'What are your plans after completing the three-month training?', null, 'long_text', '[]'::jsonb, true, false, 120),
    ('certificate_needed', 'Do you need a certificate after completing the training?', null, 'yes_no', '[]'::jsonb, false, false, 130),
    ('heard_about', 'How did you hear about MCSLI?', null, 'multiple_choice', '["Internet","Facebook","Instagram","LinkedIn","X (Twitter)","WhatsApp","From a friend","School/University","Church","Other"]'::jsonb, false, false, 140),
    ('emergency_contact_name', 'Emergency contact name', 'Optional. Someone we can contact in an emergency during training.', 'short_text', '[]'::jsonb, false, true, 150),
    ('emergency_contact_phone', 'Emergency contact phone number', null, 'phone', '[]'::jsonb, false, true, 160),
    ('comments', 'Any comments?', null, 'long_text', '[]'::jsonb, false, false, 170)
  ) as q(key, label, help_text, question_type, options, required, is_sensitive, position)
  where not exists (select 1 from public.cohort_questions t where t.cohort_id = p_cohort_id and t.key = q.key);
  get diagnostics n = row_count;
  return n;
end $$;

-- One-time legacy import (Google Forms responses exported as CSV → rows mapped by the admin UI/script).
-- Dry-run by default; never accepts or enrolls; duplicates (e-mail or external reference) are reported, not overwritten.
create or replace function public.import_cohort_applications(p_cohort_id uuid, p_rows jsonb, p_dry_run boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c public.cohorts; r jsonb; i int := 0; n int := 0; v_email text; v_phone text; v_name text; v_mode text; v_ref text; v_ext text; v_when timestamptz; v_id uuid;
        dup jsonb := '[]'::jsonb; bad jsonb := '[]'::jsonb; seen text[] := '{}'; v_answers jsonb; v_reason text;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into c from public.cohorts where id = p_cohort_id;
  if c.id is null then raise exception 'cohort not found' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'send an array of at most 2000 rows' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_reason := null;
    v_name := left(regexp_replace(trim(coalesce(r->>'full_name', '')), '\s+', ' ', 'g'), 120);
    v_email := private.normalize_email(r->>'email');
    v_phone := private.normalize_phone(r->>'phone');
    v_mode := case lower(coalesce(r->>'delivery_mode', '')) when 'online' then 'online' when 'physical' then 'physical' when 'hybrid' then 'hybrid' else null end;
    v_ext := nullif(left(r->>'external_ref', 120), '');
    begin
      v_when := coalesce((r->>'submitted_at')::timestamptz, now());
    exception when others then
      v_when := now();
    end;
    if length(v_name) < 3 then v_reason := 'missing name';
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_reason := 'invalid e-mail';
    elsif v_mode is null then v_reason := 'delivery mode must be online, physical or hybrid';
    end if;
    if v_reason is not null then bad := bad || jsonb_build_object('row', i, 'reason', v_reason); continue; end if;
    if v_email = any(seen) then dup := dup || jsonb_build_object('row', i, 'email', v_email, 'reason', 'repeated in this file'); continue; end if;
    if exists (select 1 from public.cohort_applications where cohort_id = c.id and (lower(email) = v_email or (v_ext is not null and external_ref = v_ext)) and status <> 'withdrawn') then
      dup := dup || jsonb_build_object('row', i, 'email', v_email, 'reason', 'already exists for this cohort',
        'reference', (select reference from public.cohort_applications where cohort_id = c.id and lower(email) = v_email and status <> 'withdrawn' limit 1));
      continue;
    end if;
    seen := array_append(seen, v_email);
    -- imported answers are stored as given (labels from the file), without server validation of choices
    select coalesce(jsonb_agg(jsonb_build_object('key', left(regexp_replace(lower(k), '[^a-z0-9]+', '_', 'g'), 40), 'label', left(k, 200), 'type', 'short_text', 'answer', v, 'sensitive', false)), '[]'::jsonb)
      into v_answers from jsonb_each(case when jsonb_typeof(r->'answers') = 'object' then r->'answers' else '{}'::jsonb end) x(k, v);
    n := n + 1;
    if not p_dry_run then
      v_id := gen_random_uuid();
      v_ref := private.next_application_reference(c);
      insert into public.cohort_applications (id, cohort_id, reference, full_name, email, phone, delivery_mode, status, answers, source, external_ref, submitted_at, consent_accepted_at)
      values (v_id, c.id, v_ref, v_name, v_email, v_phone, v_mode, 'submitted', v_answers, 'google_forms_import', v_ext, v_when, v_when);
      insert into public.cohort_application_events (application_id, from_status, to_status, actor_id, note) values (v_id, null, 'submitted', auth.uid(), 'imported from Google Forms');
    end if;
  end loop;
  perform public.fn_audit('cohort.import_executed', 'cohort', c.id::text, null, jsonb_build_object('dry_run', p_dry_run, 'rows', i, 'imported', case when p_dry_run then 0 else n end, 'importable', n, 'duplicates', jsonb_array_length(dup), 'invalid', jsonb_array_length(bad)));
  return jsonb_build_object('dry_run', p_dry_run, 'rows', i, 'importable', n, 'imported', case when p_dry_run then 0 else n end, 'duplicates', dup, 'invalid', bad);
end $$;

-- "Starting soon" reminder to everyone enrolled in the cohort (explicit staff action, audited).
create or replace function public.send_cohort_start_reminder(p_cohort_id uuid, p_message text default null) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare c public.cohorts; r record; n int := 0;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into c from public.cohorts where id = p_cohort_id;
  if c.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  for r in select e.user_id from public.enrollments e where e.cohort_id = c.id and e.status in ('pending_payment', 'active') loop
    perform public.fn_queue_email(r.user_id, 'cohort_starting_soon', format('MCSLI %s is starting soon', c.name),
      jsonb_build_object('cohort_name', c.name, 'start_date', c.start_date, 'delivery_mode', c.delivery_mode, 'physical_location', c.physical_location, 'schedule_notes', c.schedule_notes, 'message', left(p_message, 1000)), 'cohort', c.id::text);
    n := n + 1;
  end loop;
  perform public.fn_audit('cohort.start_reminder_sent', 'cohort', c.id::text, null, jsonb_build_object('recipients', n));
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Cohort-scoped announcements
-- ---------------------------------------------------------------------------
drop policy if exists threads_select on public.discussion_threads;
create policy threads_select on public.discussion_threads for select
  using ((not is_hidden or author_id = auth.uid() or public.is_staff())
    and (public.is_staff() or (public.fn_student_enrolled_in_course(course_id)
      and (cohort_id is null or exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.course_id = discussion_threads.course_id and e.cohort_id = discussion_threads.cohort_id)))));

create or replace function public.tg_announcement_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.is_announcement then
    for r in select user_id from public.enrollments where course_id = new.course_id and status in ('active', 'completed', 'pending_payment')
             and (new.cohort_id is null or cohort_id = new.cohort_id) loop
      perform public.fn_notify(r.user_id, 'trainer_announcement', 'Announcement: ' || left(new.title, 80), left(new.body, 140), '/app/discussions/' || new.id);
    end loop;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Grants (whitelist model)
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.tg_cohort_defaults()', 'public.tg_link_cohort_applications()', 'public.tg_link_application_enrollment()',
    'private.queue_email_to(text, uuid, text, text, jsonb, text, text)', 'private.normalize_email(text)', 'private.normalize_phone(text)',
    'private.next_application_reference(public.cohorts)', 'private.snapshot_application_answers(uuid, jsonb, text)', 'private.cohort_public_json(public.cohorts)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- helper predicates usable by anyone (they only read the row passed in)
  foreach f in array array['public.fn_cohort_phase(public.cohorts)', 'public.fn_cohort_applications_state(public.cohorts)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  foreach f in array array['public.public_cohorts()', 'public.public_cohort(text)', 'public.submit_cohort_application(text, text, text, text, text, jsonb, boolean, text)', 'public.verify_cohort_application(text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.my_cohort_applications()', 'public.my_enrollable_cohorts(uuid)', 'public.review_cohort_application(uuid, text, text)', 'public.set_cohort_application_notes(uuid, text)',
    'public.assign_application_enrollment(uuid, uuid)', 'public.set_cohort_applications_open(uuid, boolean)', 'public.mark_cohort_completed(uuid, text, integer)',
    'public.staff_cohort_stats(uuid)', 'public.copy_cohort_questions(uuid, uuid)', 'public.seed_default_cohort_questions(uuid)',
    'public.import_cohort_applications(uuid, jsonb, boolean)', 'public.send_cohort_start_reminder(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

comment on table public.cohort_applications is 'Native MCSLI cohort applications. Public visitors submit through submit_cohort_application(); applicants read their own through my_cohort_applications(); admins review through review_cohort_application(). Answers are a snapshot taken at submission.';
comment on table public.cohort_questions is 'Configurable application questions per cohort (label, help text, type, options, required, active, sensitive). Changing them never alters submitted applications.';
