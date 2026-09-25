-- MCSLI Learning Platform – 0013: staff invitations, staff MFA, launch safety rules
-- Re-runnable. No existing rows are modified except to add nullable columns.
--
--  1. staff_invitations: SUPER_ADMIN invites ADMIN/TRAINER, ADMIN invites TRAINER. Only a SHA-256
--     hash of the single-use token is stored; the role is granted only when the invited, e-mail-
--     confirmed account accepts before expiry. Every step is audited (never the token).
--  2. Optional staff MFA enforcement (platform setting require_staff_mfa): staff privileges then
--     require an aal2 session (TOTP verified). SUPER_ADMIN-only setting; cannot be switched on from
--     an aal1 session (prevents locking yourself out).
--  3. bootstrap_super_admin now requires a confirmed e-mail address (proven ownership).
--  4. Payment methods cannot be enabled without their required details.
--  5. Curriculum safety: a course cannot be published with missing content or demo media; content
--     with student history cannot be deleted (unpublish/archive instead).
--  6. Lesson thumbnails; course-media bucket restricted to video, captions and images.

-- ---------------------------------------------------------------------------
-- 2. Staff MFA
-- ---------------------------------------------------------------------------
create or replace function public.staff_mfa_satisfied() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.platform_settings where key = 'require_staff_mfa'), 'false'::jsonb) <> 'true'::jsonb
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('ADMIN', 'SUPER_ADMIN') and account_status = 'active' from public.profiles where id = auth.uid()), false)
     and public.staff_mfa_satisfied();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'SUPER_ADMIN' and account_status = 'active' from public.profiles where id = auth.uid()), false)
     and public.staff_mfa_satisfied();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN') and account_status = 'active' from public.profiles where id = auth.uid()), false)
     and public.staff_mfa_satisfied();
$$;

create or replace function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'TRAINER' and account_status = 'active' from public.profiles where id = auth.uid()), false)
     and public.staff_mfa_satisfied();
$$;

insert into public.platform_settings (key, value) values ('require_staff_mfa', 'false'::jsonb) on conflict (key) do nothing;

-- Critical settings are SUPER_ADMIN-only; enabling MFA enforcement requires an MFA session.
create or replace function public.set_platform_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_key in ('require_staff_mfa', 'registration_open', 'identity_retention_days') and not public.is_super_admin() then
    raise exception 'only a super admin can change this setting' using errcode = '42501';
  end if;
  if p_key = 'require_staff_mfa' and p_value = 'true'::jsonb and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Set up and verify two-factor authentication on your own account before requiring it for staff.' using errcode = 'P0001';
  end if;
  select value into v_old from public.platform_settings where key = p_key;
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  -- value recorded only for non-sensitive boolean/number switches
  perform public.fn_audit('platform_setting.updated', 'platform_setting', p_key, null,
    case when jsonb_typeof(p_value) in ('boolean', 'number') then jsonb_build_object('from', v_old, 'to', p_value) else '{}'::jsonb end);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Staff invitations
-- ---------------------------------------------------------------------------
create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  role public.user_role not null check (role in ('ADMIN', 'TRAINER')),
  token_hash text not null unique,            -- SHA-256 of the single-use token; the token itself is never stored
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists staff_invitations_email_idx on public.staff_invitations (lower(email), status);
alter table public.staff_invitations enable row level security;

drop policy if exists staff_invitations_select on public.staff_invitations;
create policy staff_invitations_select on public.staff_invitations for select
  using (public.is_super_admin() or (public.is_admin() and role = 'TRAINER'));
-- no insert/update/delete policies: writes only through the functions below
revoke all on public.staff_invitations from anon, authenticated;
grant select (id, email, full_name, role, status, invited_by, expires_at, accepted_by, accepted_at, cancelled_by, cancelled_at, created_at) on public.staff_invitations to authenticated;

create or replace function public.fn_hash_token(p_token text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Returns the plaintext token ONCE (to the caller, normally the invite-staff Edge Function, which puts
-- it only into the invitation e-mail link).
create or replace function public.create_staff_invitation(p_email text, p_full_name text, p_role public.user_role, p_valid_days int default 7)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_token text; v_id uuid; v_existing record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_role not in ('ADMIN', 'TRAINER') then raise exception 'invitations are for ADMIN or TRAINER roles only' using errcode = '22023'; end if;
  if p_role = 'ADMIN' and not public.is_super_admin() then raise exception 'only a super admin can invite administrators' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid e-mail address' using errcode = '22023'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then raise exception 'name is required' using errcode = '22023'; end if;
  if coalesce(p_valid_days, 7) not between 1 and 14 then raise exception 'validity must be 1–14 days' using errcode = '22023'; end if;
  select id, role into v_existing from public.profiles where lower(email) = v_email;
  if v_existing.id is not null and v_existing.role in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'this person already has an administrator account' using errcode = '23505';
  end if;
  if v_existing.id is not null and v_existing.role = p_role then
    raise exception 'this person already has that role' using errcode = '23505';
  end if;
  -- one open invitation per address: a new one replaces the previous (audited as cancelled)
  update public.staff_invitations set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now()
  where lower(email) = v_email and status = 'pending';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.staff_invitations (email, full_name, role, token_hash, invited_by, expires_at)
  values (v_email, trim(p_full_name), p_role, public.fn_hash_token(v_token), auth.uid(), now() + make_interval(days => coalesce(p_valid_days, 7)))
  returning id into v_id;
  perform public.fn_audit('staff_invitation.created', 'staff_invitation', v_id::text, v_existing.id,
    jsonb_build_object('role', p_role, 'email_domain', split_part(v_email, '@', 2), 'expires_days', coalesce(p_valid_days, 7)));
  return jsonb_build_object('invitation_id', v_id, 'token', v_token, 'email', v_email, 'role', p_role, 'existing_account', v_existing.id is not null);
end $$;

create or replace function public.cancel_staff_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into i from public.staff_invitations where id = p_invitation_id for update;
  if i.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if i.role = 'ADMIN' and not public.is_super_admin() then raise exception 'only a super admin can cancel administrator invitations' using errcode = '42501'; end if;
  if i.status <> 'pending' then raise exception 'only pending invitations can be cancelled' using errcode = 'P0001'; end if;
  update public.staff_invitations set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now() where id = i.id;
  perform public.fn_audit('staff_invitation.cancelled', 'staff_invitation', i.id::text, null, jsonb_build_object('role', i.role));
end $$;

-- Marks overdue invitations as expired (audited). Called when listing and when a token is presented.
create or replace function public.expire_staff_invitations() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in update public.staff_invitations set status = 'expired' where status = 'pending' and expires_at <= now() returning id, role loop
    n := n + 1;
    perform public.fn_audit('staff_invitation.expired', 'staff_invitation', r.id::text, null, jsonb_build_object('role', r.role));
  end loop;
  return n;
end $$;

create or replace function public.list_staff_invitations()
returns setof public.staff_invitations language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  perform public.expire_staff_invitations();
  return query select * from public.staff_invitations i
    where public.is_super_admin() or i.role = 'TRAINER'
    order by i.created_at desc limit 200;
end $$;

-- Called by the invited person after following the e-mail link (signed in as that address).
-- Invalid/used/expired/cancelled/wrong-account outcomes are RETURNED (not raised) so that their
-- audit rows are kept; the client shows `message`.
create or replace function public.accept_staff_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i record; v_uid uuid := auth.uid(); v_email text; v_confirmed timestamptz; v_prev public.user_role;
begin
  if v_uid is null then raise exception 'sign in with the invited e-mail address first' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'This invitation link is not valid.');
  end if;
  perform public.expire_staff_invitations();
  select * into i from public.staff_invitations where token_hash = public.fn_hash_token(p_token) for update;
  if i.id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'This invitation link is not valid.');
  end if;
  if i.status = 'accepted' then return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'This invitation has already been used.'); end if;
  if i.status = 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'cancelled', 'message', 'This invitation was cancelled. Ask MCSLI for a new one.'); end if;
  if i.status = 'expired' then return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'This invitation has expired. Ask MCSLI for a new one.'); end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is distinct from lower(i.email) then
    perform public.fn_audit('staff_invitation.rejected_wrong_account', 'staff_invitation', i.id::text, v_uid, jsonb_build_object('role', i.role));
    return jsonb_build_object('ok', false, 'reason', 'wrong_account', 'message', 'This invitation was sent to a different e-mail address. Sign in with the invited address.');
  end if;
  if v_confirmed is null then
    return jsonb_build_object('ok', false, 'reason', 'unconfirmed', 'message', 'Confirm your e-mail address first.');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and account_status <> 'active') then
    return jsonb_build_object('ok', false, 'reason', 'suspended', 'message', 'This account is suspended. Contact MCSLI.');
  end if;
  select role into v_prev from public.profiles where id = v_uid;
  if v_prev = 'SUPER_ADMIN' or (v_prev = 'ADMIN' and i.role = 'TRAINER') then
    return jsonb_build_object('ok', false, 'reason', 'higher_role', 'message', 'Your account already has a higher role.');
  end if;
  -- mark accepted FIRST: tg_protect_profile allows exactly this role change in this transaction
  update public.staff_invitations set status = 'accepted', accepted_by = v_uid, accepted_at = now() where id = i.id;
  update public.profiles set role = i.role, full_name = coalesce(nullif(trim(full_name), ''), i.full_name) where id = v_uid;
  perform public.fn_audit('staff_invitation.accepted', 'staff_invitation', i.id::text, v_uid, jsonb_build_object('role', i.role, 'invited_by', i.invited_by));
  perform public.fn_audit(case when i.role = 'ADMIN' then 'staff.admin_created' else 'staff.trainer_created' end, 'profile', v_uid::text, v_uid,
    jsonb_build_object('from', v_prev, 'to', i.role, 'invitation_id', i.id, 'invited_by', i.invited_by));
  return jsonb_build_object('ok', true, 'role', i.role);
end $$;

-- Role changes: admins (existing rules) OR the acceptance of a valid invitation in this transaction.
create or replace function public.tg_protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.user_role := public.current_user_role();
  v_invited boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    select exists (
      select 1 from public.staff_invitations si
      where si.accepted_by = new.id and si.accepted_by = auth.uid() and si.status = 'accepted'
        and si.role = new.role and si.accepted_at = now()
    ) into v_invited;
    if v_invited then
      null;  -- audited by accept_staff_invitation()
    else
      if v_actor is null or not public.is_admin() then
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
  end if;
  if new.account_status is distinct from old.account_status then
    if not public.is_admin() or (old.role in ('ADMIN', 'SUPER_ADMIN') and not public.is_super_admin()) then
      raise exception 'not authorised to change account status' using errcode = '42501';
    end if;
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    new.email := old.email;
  end if;
  if new.nationality is distinct from old.nationality and not public.is_admin()
     and exists (select 1 from public.enrollments where user_id = old.id) then
    raise exception 'nationality cannot be changed after enrollment; contact support' using errcode = '42501';
  end if;
  if new.nationality is distinct from old.nationality then
    perform public.fn_audit('profile.nationality_changed', 'profile', new.id::text, new.id, jsonb_build_object('from', old.nationality, 'to', new.nationality));
  end if;
  return new;
end $$;

-- Staff suspension / reactivation audited with explicit staff actions
create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'you cannot suspend yourself' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then raise exception 'account not found' using errcode = 'P0002'; end if;
  if not public.is_super_admin() and v_role in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'only a super admin can suspend an admin' using errcode = '42501';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  perform public.fn_audit(
    case when v_role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN') then (case when p_status = 'suspended' then 'staff.suspended' else 'staff.reactivated' end) else 'profile.status_changed' end,
    'profile', p_user_id::text, p_user_id, jsonb_build_object('status', p_status, 'role', v_role, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- 3. First super admin: e-mail ownership must be proven
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_super_admin(p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_confirmed timestamptz;
begin
  if auth.uid() is not null then
    raise exception 'bootstrap must be run from a direct database session' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'a super admin already exists; use Admin → Staff to grant roles' using errcode = 'P0001';
  end if;
  select p.id, u.email_confirmed_at into v_id, v_confirmed
  from public.profiles p join auth.users u on u.id = p.id where lower(p.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'no account with that e-mail; invite or register it first' using errcode = 'P0002';
  end if;
  if v_confirmed is null then
    raise exception 'the e-mail address has not been confirmed yet' using errcode = 'P0001';
  end if;
  update public.profiles set role = 'SUPER_ADMIN', account_status = 'active' where id = v_id;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, target_user_id, metadata)
  values (null, null, 'profile.super_admin_bootstrapped', 'profile', v_id::text, v_id, jsonb_build_object('via', 'bootstrap_super_admin', 'db_user', current_user));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Payment methods: required details before enabling
-- ---------------------------------------------------------------------------
create or replace function public.tg_payment_method_complete() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_enabled then
    if new.method_type = 'bank' and (coalesce(trim(new.bank_name), '') = '' or coalesce(trim(new.account_name), '') = '' or coalesce(trim(new.account_number), '') = '') then
      raise exception 'Enter the bank name, account name and account number before enabling this payment method.' using errcode = 'P0001';
    end if;
    if new.method_type in ('mtn', 'airtel') and (coalesce(trim(new.merchant_code), '') = '' or coalesce(trim(new.account_name), '') = '') then
      raise exception 'Enter the merchant code and the registered merchant name before enabling this payment method.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payment_method_complete on public.payment_methods;
create trigger payment_method_complete before insert or update on public.payment_methods for each row execute function public.tg_payment_method_complete();

-- ---------------------------------------------------------------------------
-- 5. Curriculum safety
-- ---------------------------------------------------------------------------
alter table public.lessons add column if not exists thumbnail_path text;   -- poster image in course-media
alter table public.practice_items add column if not exists thumbnail_path text;

create or replace function public.fn_course_publish_problems(p_course_id uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when (select coalesce(trim(title), '') = '' or tuition_national <= 0 or tuition_international <= 0 from public.courses where id = p_course_id)
      then 'Title and both tuition prices are required' end,
    case when not exists (select 1 from public.course_months m where m.course_id = p_course_id and m.is_published)
      then 'At least one published month is required' end,
    case when exists (
      select 1 from public.course_months m where m.course_id = p_course_id and m.is_published
        and not exists (select 1 from public.lessons l join public.modules mo on mo.id = l.module_id where mo.month_id = m.id and l.is_published))
      then 'Every published month needs at least one published lesson' end,
    case when exists (
      select 1 from public.lessons l join public.modules mo on mo.id = l.module_id join public.course_months m on m.id = mo.month_id
      where m.course_id = p_course_id and m.is_published and l.is_published and coalesce(l.video_path, l.video_url) is null)
      then 'Every published lesson needs a video' end,
    case when exists (
      select 1 from public.lessons l join public.modules mo on mo.id = l.module_id join public.course_months m on m.id = mo.month_id
      where m.course_id = p_course_id and l.is_published and (l.video_url like '/demo/%' or l.title like '[DEMO]%'))
      then 'Demo media/lessons cannot be published' end,
    case when (select requires_final_exam from public.courses where id = p_course_id)
          and not exists (select 1 from public.exams x where x.course_id = p_course_id and x.is_final)
      then 'The course requires a final examination but none exists yet' end
  ], null);
$$;

create or replace function public.tg_course_publish_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_problems text[];
begin
  -- direct database sessions (migrations, local dev seed) are trusted; API edits are validated
  if auth.uid() is null then return new; end if;
  if new.is_published and new.is_archived then
    raise exception 'An archived course cannot be published.' using errcode = 'P0001';
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    if tg_op = 'INSERT' then
      raise exception 'Create the course as a draft, add its content, then publish it.' using errcode = 'P0001';
    end if;
    v_problems := public.fn_course_publish_problems(new.id);
    if array_length(v_problems, 1) > 0 then
      raise exception 'The course cannot be published yet: %', array_to_string(v_problems, '; ') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists course_publish_check on public.courses;
create trigger course_publish_check before insert or update on public.courses for each row execute function public.tg_course_publish_check();

create or replace function public.get_course_publish_problems(p_course_id uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return public.fn_course_publish_problems(p_course_id);
end $$;

-- Content with student history is never deleted (the cascade would erase progress/attempts).
create or replace function public.tg_protect_curriculum_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_has boolean := false;
begin
  if tg_table_name = 'course_months' then
    v_has := exists (select 1 from public.assessments where month_id = old.id) or exists (select 1 from public.month_overrides where month_id = old.id)
          or exists (select 1 from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id join public.modules mo on mo.id = l.module_id where mo.month_id = old.id)
          or exists (select 1 from public.quiz_attempts qa join public.quizzes q on q.id = qa.quiz_id where q.month_id = old.id);
  elsif tg_table_name = 'modules' then
    v_has := exists (select 1 from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id where l.module_id = old.id);
  elsif tg_table_name = 'lessons' then
    v_has := exists (select 1 from public.lesson_progress where lesson_id = old.id);
  elsif tg_table_name = 'quizzes' then
    v_has := exists (select 1 from public.quiz_attempts where quiz_id = old.id);
  elsif tg_table_name = 'quiz_questions' then
    v_has := exists (select 1 from public.quiz_attempts where quiz_id = old.quiz_id);
  elsif tg_table_name = 'exams' then
    v_has := exists (select 1 from public.exam_attempts where exam_id = old.id);
  elsif tg_table_name = 'exam_questions' then
    v_has := exists (select 1 from public.exam_attempts where exam_id = old.exam_id);
  end if;
  if v_has and auth.uid() is not null then
    raise exception 'This item has student history and cannot be deleted. Unpublish it instead.' using errcode = 'P0001';
  end if;
  return old;
end $$;
do $$
declare t text;
begin
  foreach t in array array['course_months', 'modules', 'lessons', 'quizzes', 'quiz_questions', 'exams', 'exam_questions'] loop
    execute format('drop trigger if exists protect_curriculum_history on public.%I', t);
    execute format('create trigger protect_curriculum_history before delete on public.%I for each row execute function public.tg_protect_curriculum_history()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. course-media bucket: only video, captions and images (size limit is further capped by plan)
-- ---------------------------------------------------------------------------
update storage.buckets set allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'text/vtt', 'image/jpeg', 'image/png', 'image/webp']
where id = 'course-media';
drop policy if exists mcsli_media_select on storage.objects;
create policy mcsli_media_select on storage.objects for select to authenticated
  using (bucket_id = 'course-media' and (
    public.is_staff()
    or exists (select 1 from public.lessons l where (l.video_path = name or l.captions_path = name or l.thumbnail_path = name) and public.fn_student_can_access_lesson(l.id))
    or exists (select 1 from public.practice_items p where (p.video_path = name or p.thumbnail_path = name) and p.is_published and public.fn_student_can_access_month(p.month_id))
    or exists (select 1 from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id where q.video_path = name and z.is_published and public.fn_student_can_access_month(z.month_id))
    or exists (select 1 from public.exam_questions q join public.exam_attempts ea on ea.exam_id = q.exam_id where q.video_path = name and public.owns_enrollment(ea.enrollment_id))
  ));

-- ---------------------------------------------------------------------------
-- EXECUTE grants for the new functions (whitelist model from 0008)
-- ---------------------------------------------------------------------------
revoke execute on function public.staff_mfa_satisfied() from public;
grant execute on function public.staff_mfa_satisfied() to anon, authenticated, service_role;
revoke execute on function public.fn_hash_token(text) from public, anon, authenticated;
revoke execute on function public.expire_staff_invitations() from public, anon, authenticated;
revoke execute on function public.fn_course_publish_problems(uuid) from public, anon, authenticated;
revoke execute on function public.tg_payment_method_complete() from public, anon, authenticated;
revoke execute on function public.tg_course_publish_check() from public, anon, authenticated;
revoke execute on function public.tg_protect_curriculum_history() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_staff_invitation(text, text, public.user_role, int)',
    'public.cancel_staff_invitation(uuid)',
    'public.list_staff_invitations()',
    'public.accept_staff_invitation(text)',
    'public.get_course_publish_problems(uuid)',
    'public.set_platform_setting(text, jsonb)',
    'public.admin_set_account_status(uuid, public.account_status, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
revoke execute on function public.bootstrap_super_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_super_admin(text) to service_role;

-- The staff area needs to know whether MFA is required (trainers cannot read platform_settings).
create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.platform_settings
  where key in ('registration_open', 'support_email', 'support_phone', 'support_whatsapp', 'certificate', 'require_staff_mfa');
$$;
revoke execute on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated, service_role;
