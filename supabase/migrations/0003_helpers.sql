-- MCSLI Learning Platform – 0003: helper functions, triggers, views
-- These are used by the RLS policies (0004) and the business functions (0005).

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can read profiles regardless of RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('ADMIN', 'SUPER_ADMIN') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'SUPER_ADMIN' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'TRAINER' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.account_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select account_status = 'active' from public.profiles where id = auth.uid()), false);
$$;

-- Trainer assigned to a course (any cohort) or to the specific cohort.
create or replace function public.trainer_assigned_to_course(p_course_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trainer_assignments ta
    where ta.trainer_id = auth.uid() and ta.course_id = p_course_id
  );
$$;

create or replace function public.trainer_assigned_to_enrollment(p_enrollment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    join public.trainer_assignments ta on ta.course_id = e.course_id and ta.trainer_id = auth.uid()
    where e.id = p_enrollment_id
      and (ta.cohort_id is null or ta.cohort_id = e.cohort_id)
  );
$$;

-- Staff who may act on an enrollment: admins, or trainers assigned to it.
create or replace function public.can_manage_enrollment(p_enrollment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.trainer_assigned_to_enrollment(p_enrollment_id);
$$;

create or replace function public.owns_enrollment(p_enrollment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where id = p_enrollment_id and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Audit log helper
-- ---------------------------------------------------------------------------
create or replace function public.fn_audit(
  p_action text, p_entity_type text, p_entity_id text, p_target_user uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, target_user_id, metadata)
  values (auth.uid(), public.current_user_role(), p_action, p_entity_type, p_entity_id, p_target_user, coalesce(p_metadata, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Notification helper
-- ---------------------------------------------------------------------------
create or replace function public.fn_notify(
  p_user uuid, p_type public.notification_type, p_title text, p_body text default null, p_link text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
end $$;

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up (reads metadata supplied at registration).
-- ---------------------------------------------------------------------------
create or replace function public.tg_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nat public.nationality_class := 'ugandan';
begin
  if coalesce(new.raw_user_meta_data->>'nationality', '') = 'international' then
    v_nat := 'international';
  end if;
  insert into public.profiles (id, email, full_name, phone, nationality, country, city)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    v_nat,
    nullif(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'city', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.tg_handle_new_user();

-- ---------------------------------------------------------------------------
-- Prevent privilege escalation: role / account_status / nationality-after-enrollment
-- may only be changed by admins (SUPER_ADMIN for admin roles).
-- ---------------------------------------------------------------------------
create or replace function public.tg_protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.user_role := public.current_user_role();
begin
  -- Direct database / service-role access (no user JWT) is trusted: used to bootstrap the first admin.
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if v_actor is null then
      raise exception 'not authorised to change role' using errcode = '42501';
    end if;
    if v_actor = 'SUPER_ADMIN' then
      null;
    elsif v_actor = 'ADMIN' and new.role in ('STUDENT', 'TRAINER') and old.role in ('STUDENT', 'TRAINER') then
      null;
    else
      raise exception 'not authorised to change role' using errcode = '42501';
    end if;
    perform public.fn_audit('profile.role_changed', 'profile', new.id::text, new.id, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.account_status is distinct from old.account_status and not public.is_admin() then
    raise exception 'not authorised to change account status' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    -- e-mail changes must go through auth (Supabase updates auth.users; profile is synced separately)
    new.email := old.email;
  end if;
  -- Nationality drives pricing; lock it once an enrollment exists unless an admin edits it.
  if new.nationality is distinct from old.nationality and not public.is_admin()
     and exists (select 1 from public.enrollments where user_id = old.id) then
    raise exception 'nationality cannot be changed after enrollment; contact support' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.tg_protect_profile();

-- ---------------------------------------------------------------------------
-- Masking + identity summary view (base table has no direct SELECT for students)
-- ---------------------------------------------------------------------------
create or replace function public.mask_identifier(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    when length(p) <= 4 then repeat('•', length(p))
    else repeat('•', greatest(length(p) - 4, 4)) || right(p, 4)
  end;
$$;

create or replace view public.identity_summary
with (security_invoker = false) as
  select
    v.id,
    v.user_id,
    v.doc_type,
    public.mask_identifier(v.id_number) as id_number_masked,
    v.full_name_on_document,
    v.issuing_country,
    v.status,
    v.submitted_at,
    v.reviewed_at,
    v.reviewed_by,
    v.rejection_reason,
    v.consent_given_at
  from public.identity_verifications v
  where v.user_id = auth.uid() or public.is_admin();

-- Audited reveal of the full identification number (admins only, verification purposes).
create or replace function public.admin_reveal_identity_number(p_verification_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_number text; v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select id_number, user_id into v_number, v_user from public.identity_verifications where id = p_verification_id;
  if v_number is null then
    raise exception 'verification not found' using errcode = 'P0002';
  end if;
  perform public.fn_audit('identity.number_revealed', 'identity_verification', p_verification_id::text, v_user);
  return v_number;
end $$;

-- ---------------------------------------------------------------------------
-- Quiz/exam question views that never expose correct answers to students
-- ---------------------------------------------------------------------------
create or replace view public.quiz_questions_student
with (security_invoker = true) as
  select id, quiz_id, position, question_type, prompt, video_path, video_url, options, points
  from public.quiz_questions;

create or replace view public.exam_questions_student
with (security_invoker = true) as
  select id, exam_id, position, question_type, prompt, video_path, video_url, options, points, requires_manual_grading
  from public.exam_questions;

-- Public-safe profile view for discussions (name + role + avatar only).
create or replace view public.public_profiles
with (security_invoker = false) as
  select id, full_name, role, avatar_path from public.profiles;

-- ---------------------------------------------------------------------------
-- Certificate number generator: MCSLI-YYYY-XXXXXX (no ambiguous characters)
-- ---------------------------------------------------------------------------
create or replace function public.fn_generate_certificate_number() returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := 'MCSLI-' || to_char(now(), 'YYYY') || '-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.certificates where certificate_number = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.fn_generate_receipt_number() returns text
language sql as $$
  select 'RCPT-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8));
$$;
