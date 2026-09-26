-- MCSLI Learning Platform – 0016: security-advisor follow-ups (2026-09-26)
-- Re-runnable. No data is modified.
--
--  1. The four SECURITY DEFINER views (advisor ERROR "security_definer_view") are replaced by
--     SECURITY DEFINER functions that check auth.uid()/role explicitly. Flipping them to
--     security_invoker would break legitimate access (the base tables deliberately deny direct
--     reads, or hide columns), so the intent of each view is re-expressed as a function:
--       site_content_public   → get_site_content_public()            anon + authenticated
--       identity_summary      → get_my_identity(), admin_list_identities(status)
--       exam_attempts_student → my_exam_attempts(enrollment_id)
--       public_profiles       → public_profiles_lookup(ids[])
--  2. The two remaining (invoker) views were readable AND writable by anon/authenticated through
--     Supabase's default grants; they are now SELECT-only for authenticated.
--  3. Anonymous surface: `anon` loses all table privileges except SELECT on the public catalogue
--     (courses, course_months, events) and INSERT on contact_messages. Policies of tables anon
--     cannot touch are never evaluated, so only is_admin()/is_staff() (used by those public
--     tables' policies) stay executable by anon, together with the intentionally public RPCs.
--     New tables no longer receive anon grants by default (fail closed).
--  4. identity_verifications: no API-role privileges at all (RLS on, no policies) – access only
--     through submit_identity / review_identity / admin_reveal_identity_number / get_my_identity /
--     admin_list_identities / admin_find_identity_by_number, all audited where sensitive.
--  5. Staff invitations default to 24-hour validity (matches the Auth link expiry and the UI).

-- ---------------------------------------------------------------------------
-- 1. Views → functions
-- ---------------------------------------------------------------------------
drop view if exists public.site_content_public;
drop view if exists public.identity_summary;
drop view if exists public.exam_attempts_student;
drop view if exists public.public_profiles;

-- Public website content. Unverified impact statistics never leave the database.
create or replace function public.get_site_content_public()
returns table (key text, value jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select sc.key,
    case when sc.key = 'impact_stats' then
      jsonb_set(sc.value, '{stats}', coalesce((
        select jsonb_agg(s) from jsonb_array_elements(coalesce(sc.value->'stats', '[]'::jsonb)) s
        where (s->>'verified')::boolean is true), '[]'::jsonb))
    else sc.value end,
    sc.updated_at
  from public.site_content sc
  where sc.is_public;
$$;

-- The caller's own identity record, number masked to the last four characters.
create or replace function public.get_my_identity()
returns table (
  id uuid, user_id uuid, doc_type public.identity_doc_type, id_number_masked text, full_name_on_document text,
  issuing_country text, status public.identity_status, submitted_at timestamptz, reviewed_at timestamptz,
  reviewed_by uuid, rejection_reason text, consent_given_at timestamptz
) language sql stable security definer set search_path = public as $$
  select v.id, v.user_id, v.doc_type,
    case when v.id_number_last4 is null then null else '••••••••••' || v.id_number_last4 end,
    v.full_name_on_document, v.issuing_country, v.status, v.submitted_at, v.reviewed_at, v.reviewed_by,
    v.rejection_reason, v.consent_given_at
  from public.identity_verifications v
  where auth.uid() is not null and v.user_id = auth.uid();
$$;

-- Admin review queue (masked). Full numbers only via admin_reveal_identity_number() (audited).
create or replace function public.admin_list_identities(p_status public.identity_status default null)
returns table (
  id uuid, user_id uuid, doc_type public.identity_doc_type, id_number_masked text, full_name_on_document text,
  issuing_country text, status public.identity_status, submitted_at timestamptz, reviewed_at timestamptz,
  reviewed_by uuid, rejection_reason text, consent_given_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return query
    select v.id, v.user_id, v.doc_type,
      case when v.id_number_last4 is null then null else '••••••••••' || v.id_number_last4 end,
      v.full_name_on_document, v.issuing_country, v.status, v.submitted_at, v.reviewed_at, v.reviewed_by,
      v.rejection_reason, v.consent_given_at
    from public.identity_verifications v
    where p_status is null or v.status = p_status
    order by v.submitted_at;
end $$;

-- A student's own exam attempts; scores/feedback are hidden until results are released.
create or replace function public.my_exam_attempts(p_enrollment_id uuid)
returns table (
  id uuid, exam_id uuid, enrollment_id uuid, attempt_number integer, question_order uuid[], answers jsonb,
  status public.exam_attempt_status, started_at timestamptz, deadline_at timestamptz, submitted_at timestamptz,
  total_score numeric, passed boolean, grader_feedback text, results_released_at timestamptz
) language sql stable security definer set search_path = public as $$
  select ea.id, ea.exam_id, ea.enrollment_id, ea.attempt_number, ea.question_order, ea.answers, ea.status,
    ea.started_at, ea.deadline_at, ea.submitted_at,
    case when ea.results_released_at is not null then ea.total_score end,
    case when ea.results_released_at is not null then ea.passed end,
    case when ea.results_released_at is not null then ea.grader_feedback end,
    ea.results_released_at
  from public.exam_attempts ea
  where auth.uid() is not null and ea.enrollment_id = p_enrollment_id and public.owns_enrollment(p_enrollment_id)
  order by ea.started_at desc;
$$;

-- Name/role/avatar directory for discussions and support: yourself, staff, classmates, and (for
-- staff) the students you manage. Never e-mail, phone or other profile columns.
create or replace function public.public_profiles_lookup(p_ids uuid[])
returns table (id uuid, full_name text, role public.user_role, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.role, p.avatar_path
  from public.profiles p
  where auth.uid() is not null
    and p.id = any (p_ids[1:200])
    and (
      p.id = auth.uid()
      or p.role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN')
      or public.is_admin()
      or public.trainer_can_view_user(p.id)
      or exists (
        select 1 from public.enrollments mine
        join public.enrollments theirs on theirs.course_id = mine.course_id
        where mine.user_id = auth.uid() and theirs.user_id = p.id)
    );
$$;

revoke all on function public.get_site_content_public() from public, anon, authenticated;
grant execute on function public.get_site_content_public() to anon, authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array[
    'public.get_my_identity()',
    'public.admin_list_identities(public.identity_status)',
    'public.my_exam_attempts(uuid)',
    'public.public_profiles_lookup(uuid[])'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Remaining (invoker) views are read-only surfaces for signed-in users
-- ---------------------------------------------------------------------------
revoke all on public.quiz_questions_student, public.exam_questions_student from public, anon, authenticated;
grant select on public.quiz_questions_student, public.exam_questions_student to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Anonymous surface
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon', t);
  end loop;
  for t in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('revoke all on sequence public.%I from anon', t);
  end loop;
end $$;
grant select on public.courses, public.course_months, public.events to anon;   -- public catalogue (RLS: published rows)
grant insert on public.contact_messages to anon;                                  -- contact form (rate limited)
-- future tables/sequences created by migrations are not exposed to anon by default
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- Helper predicates: only the two evaluated by the public catalogue's policies stay anon-callable.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'account_is_active', 'can_handle_ticket', 'can_manage_enrollment', 'can_moderate_thread', 'current_user_role',
      'fn_student_can_access_lesson', 'fn_student_can_access_month', 'fn_student_enrolled_in_course', 'is_super_admin',
      'is_trainer', 'owns_enrollment', 'staff_mfa_satisfied', 'trainer_assigned_to_course', 'trainer_assigned_to_enrollment',
      'trainer_can_view_user', 'storage_path_owner', 'mask_identifier', 'fn_exam_is_open', 'fn_build_installments')
  loop
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
  -- purely internal (called from other SECURITY DEFINER code): not an RPC for anyone
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('current_user_role', 'staff_mfa_satisfied', 'mask_identifier', 'fn_build_installments')
  loop
    execute format('revoke execute on function %s from authenticated', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. identity_verifications: API roles have no direct access (intentional; documented)
-- ---------------------------------------------------------------------------
revoke all on public.identity_verifications from public, anon, authenticated;
comment on table public.identity_verifications is
  'RLS enabled with NO policies and NO grants to API roles, by design: identification numbers are encrypted and reachable only through SECURITY DEFINER functions (submit_identity, review_identity, get_my_identity, admin_list_identities, admin_find_identity_by_number, admin_reveal_identity_number – the last two audited).';

-- ---------------------------------------------------------------------------
-- 5. Invitations: 24-hour default validity (Auth link expiry is 24 h as well) and a 60-second
--    per-address throttle. Supabase Auth refuses a second e-mail to the same address within its
--    "minimum interval per user" (60 s); without this check a quick "Resend" would cancel the
--    working link and then fail to send a new one.
-- ---------------------------------------------------------------------------
create or replace function public.create_staff_invitation(p_email text, p_full_name text, p_role public.user_role, p_valid_days int default 1)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_token text; v_id uuid; v_existing record; v_days int := coalesce(p_valid_days, 1);
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_role not in ('ADMIN', 'TRAINER') then raise exception 'invitations are for ADMIN or TRAINER roles only' using errcode = '22023'; end if;
  if p_role = 'ADMIN' and not public.is_super_admin() then raise exception 'only a super admin can invite administrators' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid e-mail address' using errcode = '22023'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then raise exception 'name is required' using errcode = '22023'; end if;
  if v_days not between 1 and 14 then raise exception 'validity must be 1–14 days' using errcode = '22023'; end if;
  select id, role into v_existing from public.profiles where lower(email) = v_email;
  if v_existing.id is not null and v_existing.role in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'this person already has an administrator account' using errcode = '23505';
  end if;
  if v_existing.id is not null and v_existing.role = p_role then
    raise exception 'this person already has that role' using errcode = '23505';
  end if;
  if exists (select 1 from public.staff_invitations where lower(email) = v_email and created_at > now() - interval '60 seconds') then
    raise exception 'An invitation was sent to this address less than a minute ago. Wait a minute, then try again.' using errcode = 'P0001';
  end if;
  -- one open invitation per address: a new one replaces the previous (audited as cancelled)
  update public.staff_invitations set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now()
  where lower(email) = v_email and status = 'pending';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.staff_invitations (email, full_name, role, token_hash, invited_by, expires_at)
  values (v_email, trim(p_full_name), p_role, public.fn_hash_token(v_token), auth.uid(), now() + make_interval(days => v_days))
  returning id into v_id;
  perform public.fn_audit('staff_invitation.created', 'staff_invitation', v_id::text, v_existing.id,
    jsonb_build_object('role', p_role, 'email_domain', split_part(v_email, '@', 2), 'expires_days', v_days));
  return jsonb_build_object('invitation_id', v_id, 'token', v_token, 'email', v_email, 'role', p_role, 'existing_account', v_existing.id is not null);
end $$;
revoke execute on function public.create_staff_invitation(text, text, public.user_role, int) from public, anon;
grant execute on function public.create_staff_invitation(text, text, public.user_role, int) to authenticated, service_role;
