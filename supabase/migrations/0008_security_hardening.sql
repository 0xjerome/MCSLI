-- MCSLI Learning Platform – 0008: security hardening (RLS audit findings, 2026-09-25)
-- Additive and re-runnable: only CREATE OR REPLACE / DROP POLICY IF EXISTS / REVOKE / GRANT.
-- No data is modified or removed.
--
-- Findings fixed here (see docs/SUPABASE_SETUP.md → "RLS audit"):
--  1. Internal SECURITY DEFINER helpers (fn_audit, fn_notify, fn_month_access, fn_confirmed_totals…)
--     were executable by every authenticated user through PostgREST: anyone could forge
--     notifications/audit rows or read another student's payment totals.
--  2. exam_questions_select_student compared ea.exam_id with itself (unqualified column), so any
--     student with any exam attempt could read every exam's questions.
--  3. Suspended / demoted staff kept their privileges (role helpers ignored account_status,
--     trainer helpers ignored the current role).
--  4. Trainers could read every profile, ticket, report and certificate on the platform.
--  5. Authors could un-hide, unlock, pin or move their own moderated discussion content.
--  6. Admins could create identity-document signed URLs directly from Storage, bypassing the
--     audited Edge Function.
--  7. Students could rewrite the text of their own notifications; audit rows could be altered
--     by SECURITY DEFINER code paths.
--  8. Month N+1 unlocked on an assessment pass alone; the rule also requires Month N's required
--     lessons to be completed and required quizzes passed.
--  9. Quiz results returned the correct answers after every failed attempt, so unlimited
--     retries made any quiz trivially passable.
-- 10. fn_generate_receipt_number used gen_random_bytes without the `extensions` schema on the
--     search_path (hosted Supabase installs pgcrypto in `extensions`).
-- 11. Reissuing a revoked certificate skipped the eligibility check.

-- ---------------------------------------------------------------------------
-- 3. Role helpers honour account_status and the current role
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('ADMIN', 'SUPER_ADMIN') and account_status = 'active' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'SUPER_ADMIN' and account_status = 'active' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN') and account_status = 'active' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'TRAINER' and account_status = 'active' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.trainer_assigned_to_course(p_course_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from public.trainer_assignments ta
    where ta.trainer_id = auth.uid() and ta.course_id = p_course_id
  );
$$;

create or replace function public.trainer_assigned_to_enrollment(p_enrollment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from public.enrollments e
    join public.trainer_assignments ta on ta.course_id = e.course_id and ta.trainer_id = auth.uid()
    where e.id = p_enrollment_id
      and (ta.cohort_id is null or ta.cohort_id = e.cohort_id)
  );
$$;

-- A trainer may see the profile of a student enrolled in a course/cohort they are assigned to.
create or replace function public.trainer_can_view_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from public.enrollments e
    join public.trainer_assignments ta on ta.course_id = e.course_id and ta.trainer_id = auth.uid()
    where e.user_id = p_user_id and (ta.cohort_id is null or ta.cohort_id = e.cohort_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Profiles: trainers only see their own students; everyone sees staff names
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_select_trainer on public.profiles;
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_select_trainer on public.profiles for select using (public.trainer_can_view_user(id));

-- Name/role/avatar directory used by discussions and assessment lists. Previously exposed every
-- account (including to anonymous callers). Now limited to: yourself, staff members, people who
-- share a course with you, and – for staff – the students they manage.
create or replace view public.public_profiles
with (security_invoker = false) as
  select p.id, p.full_name, p.role, p.avatar_path
  from public.profiles p
  where auth.uid() is not null and (
    p.id = auth.uid()
    or p.role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN')
    or public.is_admin()
    or public.trainer_can_view_user(p.id)
    or exists (
      select 1 from public.enrollments mine
      join public.enrollments theirs on theirs.course_id = mine.course_id
      where mine.user_id = auth.uid() and theirs.user_id = p.id
    )
  );
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Exam questions: fix the self-comparison
-- ---------------------------------------------------------------------------
drop policy if exists exam_questions_select_student on public.exam_questions;
create policy exam_questions_select_student on public.exam_questions for select
  using (exists (
    select 1 from public.exam_attempts ea
    where ea.exam_id = exam_questions.exam_id and public.owns_enrollment(ea.enrollment_id)
  ));

-- ---------------------------------------------------------------------------
-- 4. Certificates, reports, tickets: scope staff access
-- ---------------------------------------------------------------------------
drop policy if exists certificates_select_staff on public.certificates;
create policy certificates_select_staff on public.certificates for select using (public.can_manage_enrollment(enrollment_id));

create or replace function public.can_moderate_thread(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.discussion_threads t where t.id = p_thread_id and public.trainer_assigned_to_course(t.course_id)
  );
$$;

drop policy if exists reports_insert on public.discussion_reports;
drop policy if exists reports_select on public.discussion_reports;
drop policy if exists reports_update_staff on public.discussion_reports;
create policy reports_insert on public.discussion_reports for insert
  with check (reporter_id = auth.uid() and status = 'open' and resolved_by is null and resolved_at is null);
create policy reports_select on public.discussion_reports for select
  using (reporter_id = auth.uid()
    or public.can_moderate_thread(coalesce(thread_id, (select p.thread_id from public.discussion_posts p where p.id = post_id))));
create policy reports_update_staff on public.discussion_reports for update
  using (public.can_moderate_thread(coalesce(thread_id, (select p.thread_id from public.discussion_posts p where p.id = post_id))))
  with check (public.can_moderate_thread(coalesce(thread_id, (select p.thread_id from public.discussion_posts p where p.id = post_id))));

-- Support tickets are handled by admins, or by the staff member a ticket is assigned to.
create or replace function public.can_handle_ticket(p_ticket_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_staff() and exists (
    select 1 from public.support_tickets t where t.id = p_ticket_id and t.assigned_to = auth.uid()
  ));
$$;

drop policy if exists tickets_select_staff on public.support_tickets;
drop policy if exists tickets_insert_own on public.support_tickets;
drop policy if exists tickets_update_staff on public.support_tickets;
create policy tickets_select_staff on public.support_tickets for select using (public.can_handle_ticket(id));
create policy tickets_insert_own on public.support_tickets for insert
  with check (user_id = auth.uid() and public.account_is_active() and status = 'open' and assigned_to is null and resolved_at is null);
create policy tickets_update_staff on public.support_tickets for update using (public.can_handle_ticket(id)) with check (public.can_handle_ticket(id));

drop policy if exists support_messages_select on public.support_messages;
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_select on public.support_messages for select
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()) or public.can_handle_ticket(ticket_id));
create policy support_messages_insert on public.support_messages for insert
  with check (author_id = auth.uid() and public.account_is_active() and (
    (is_staff = false and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (is_staff = true and public.can_handle_ticket(ticket_id))
  ));

create or replace function public.update_ticket_status(p_ticket_id uuid, p_status public.ticket_status)
returns void language plpgsql security definer set search_path = public as $$
declare t record; v_handler boolean;
begin
  select * into t from public.support_tickets where id = p_ticket_id;
  if t.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_handler := public.can_handle_ticket(t.id);
  if not (v_handler or (t.user_id = auth.uid() and p_status = 'resolved')) then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.support_tickets set status = p_status, resolved_at = case when p_status = 'resolved' then now() end,
    assigned_to = case when v_handler then coalesce(assigned_to, auth.uid()) else assigned_to end
  where id = t.id;
  if v_handler then
    perform public.fn_audit('support.status_changed', 'support_ticket', t.id::text, t.user_id, jsonb_build_object('status', p_status));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Discussions: authors may edit text, never moderation state or placement
-- ---------------------------------------------------------------------------
create or replace function public.tg_guard_discussion_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or public.trainer_assigned_to_course(old.course_id) then
    return new;
  end if;
  if new.is_hidden is distinct from old.is_hidden or new.hidden_by is distinct from old.hidden_by
     or new.is_locked is distinct from old.is_locked or new.is_pinned is distinct from old.is_pinned
     or new.is_announcement is distinct from old.is_announcement or new.course_id is distinct from old.course_id
     or new.author_id is distinct from old.author_id then
    raise exception 'only moderators can change this discussion''s status' using errcode = '42501';
  end if;
  if old.is_locked then
    raise exception 'this discussion is locked' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_discussion_thread on public.discussion_threads;
create trigger guard_discussion_thread before update on public.discussion_threads for each row execute function public.tg_guard_discussion_thread();

create or replace function public.tg_guard_discussion_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.can_moderate_thread(old.thread_id) then
    return new;
  end if;
  if new.is_hidden is distinct from old.is_hidden or new.hidden_by is distinct from old.hidden_by
     or new.thread_id is distinct from old.thread_id or new.parent_id is distinct from old.parent_id
     or new.author_id is distinct from old.author_id then
    raise exception 'only moderators can change this post''s status' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_discussion_post on public.discussion_posts;
create trigger guard_discussion_post before update on public.discussion_posts for each row execute function public.tg_guard_discussion_post();

-- Moderators (assigned trainers) may delete in their courses too; always audited.
drop policy if exists threads_delete_own on public.discussion_threads;
create policy threads_delete_own on public.discussion_threads for delete
  using (author_id = auth.uid() or public.is_admin() or public.trainer_assigned_to_course(course_id));
drop policy if exists posts_delete_own on public.discussion_posts;
create policy posts_delete_own on public.discussion_posts for delete
  using (author_id = auth.uid() or public.can_moderate_thread(thread_id));

create or replace function public.tg_audit_discussion_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.author_id <> auth.uid() then
    perform public.fn_audit('discussion.' || case when tg_table_name = 'discussion_threads' then 'thread' else 'post' end || '_deleted',
      tg_table_name, old.id::text, old.author_id);
  end if;
  return old;
end $$;
drop trigger if exists audit_thread_delete on public.discussion_threads;
create trigger audit_thread_delete after delete on public.discussion_threads for each row execute function public.tg_audit_discussion_delete();
drop trigger if exists audit_post_delete on public.discussion_posts;
create trigger audit_post_delete after delete on public.discussion_posts for each row execute function public.tg_audit_discussion_delete();

-- ---------------------------------------------------------------------------
-- 6. Storage: identity documents are reachable by their owner only; staff go through the
--    audited Edge Function (service role). Helpers are STABLE, not IMMUTABLE (they read auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.storage_path_owner(p_name text) returns boolean
language sql stable as $$
  select split_part(p_name, '/', 1) = auth.uid()::text;
$$;

drop policy if exists mcsli_identity_select on storage.objects;
create policy mcsli_identity_select on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and public.storage_path_owner(name));

-- Owners may remove their own scans only while the verification is still open.
drop policy if exists mcsli_identity_delete on storage.objects;
create policy mcsli_identity_delete on storage.objects for delete to authenticated
  using (bucket_id = 'identity-documents' and (
    public.is_admin()
    or (public.storage_path_owner(name) and not exists (
      select 1 from public.identity_verifications v where v.user_id = auth.uid() and v.status = 'verified'))
  ));

-- Called by the identity-document-url Edge Function with the caller's JWT. Authorises the caller
-- (owner of a live document, or an active ADMIN/SUPER_ADMIN), writes the audit row FIRST and only
-- then returns the object path to sign. Not-found and not-permitted are indistinguishable.
create or replace function public.authorize_identity_document_access(p_document_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare d record; v_admin boolean := public.is_admin();
begin
  if auth.uid() is null or not public.account_is_active() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select * into d from public.identity_documents where id = p_document_id and deleted_at is null;
  if d.id is null or not (v_admin or d.user_id = auth.uid()) then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if d.storage_path not like 'identity-documents/' || d.user_id::text || '/%' then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  perform public.fn_audit(case when v_admin and d.user_id <> auth.uid() then 'identity.document_viewed' else 'identity.document_viewed_by_owner' end,
    'identity_document', d.id::text, d.user_id, jsonb_build_object('via', 'edge-function'));
  return substr(d.storage_path, length('identity-documents/') + 1);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Notifications: only read_at is writable by the recipient. Audit log is append-only.
-- ---------------------------------------------------------------------------
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.notifications from anon;

create or replace function public.tg_audit_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit log entries cannot be modified' using errcode = '42501';
  end if;
  -- DELETE: only a direct database session (no end-user JWT), e.g. a documented retention purge.
  if auth.uid() is not null then
    raise exception 'audit log entries cannot be deleted' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists audit_append_only on public.audit_logs;
create trigger audit_append_only before update or delete on public.audit_logs for each row execute function public.tg_audit_append_only();

-- ---------------------------------------------------------------------------
-- 8. Progression: the academic gate also requires the previous month's required lessons and
--    quizzes. Mirrors src/domain/progression.ts (reason code previous_month_incomplete).
-- ---------------------------------------------------------------------------
create or replace function public.fn_month_requirements_incomplete(p_enrollment_id uuid, p_month_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lessons_missing', (select count(*) from public.lessons l join public.modules mo on mo.id = l.module_id
                        where mo.month_id = p_month_id and l.is_published and l.is_required
                          and not exists (select 1 from public.lesson_progress lp where lp.lesson_id = l.id and lp.enrollment_id = p_enrollment_id and lp.completed_at is not null)),
    'quizzes_missing', (select count(*) from public.quizzes q
                        where q.month_id = p_month_id and q.is_published and q.is_required
                          and not exists (select 1 from public.quiz_attempts qa where qa.quiz_id = q.id and qa.enrollment_id = p_enrollment_id and qa.passed))
  );
$$;

create or replace function public.fn_month_access(p_enrollment_id uuid, p_month_number int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e record;
  m record;
  pm record;
  t record;
  reasons jsonb := '[]'::jsonb;
  v_required numeric := 0;
  v_missing record;
  v_prev_result public.assessment_result;
  v_override boolean := false;
  v_cum numeric := 0;
  v_incomplete jsonb;
  inst record;
begin
  select * into e from public.enrollments where id = p_enrollment_id;
  if e.id is null then
    return jsonb_build_object('allowed', false, 'reasons', jsonb_build_array(jsonb_build_object('code', 'enrollment_inactive', 'message', 'Enrollment not found.')));
  end if;

  select * into m from public.course_months where course_id = e.course_id and month_number = p_month_number;
  if m.id is null or not m.is_published then
    reasons := reasons || jsonb_build_object('code', 'month_not_published', 'message', 'This month is not yet available. MCSLI will publish it soon.');
  end if;

  if e.status not in ('active', 'completed') then
    reasons := reasons || jsonb_build_object('code', 'enrollment_inactive', 'message', 'Your enrollment is not active. Contact MCSLI support if you think this is a mistake.');
  end if;

  select * into t from public.fn_confirmed_totals(p_enrollment_id);

  -- financial gate
  if t.registration < e.registration_fee then
    reasons := reasons || jsonb_build_object('code', 'registration_fee_unconfirmed', 'message', 'Your registration fee must be confirmed before you can start the course.');
  end if;

  select coalesce(sum((x->>'amount')::numeric), 0) into v_required
  from jsonb_array_elements(e.installments) x where (x->>'due_before_month')::int <= p_month_number;

  if t.tuition < v_required then
    for inst in select (x->>'number')::int as number, (x->>'amount')::numeric as amount, (x->>'due_before_month')::int as due
                from jsonb_array_elements(e.installments) x order by (x->>'number')::int loop
      v_cum := v_cum + inst.amount;
      if t.tuition < v_cum and inst.due <= p_month_number then
        v_missing := inst; exit;
      end if;
    end loop;
    if e.plan_type = 'full' or v_missing.number = 1 then
      reasons := reasons || jsonb_build_object(
        'code', 'tuition_unconfirmed',
        'message', case when e.plan_type = 'full' then 'Your tuition payment must be confirmed before this month becomes available.'
                        else 'Your first tuition installment must be confirmed before you can start the course.' end,
        'meta', jsonb_build_object('installment', coalesce(v_missing.number, 1)));
    else
      reasons := reasons || jsonb_build_object(
        'code', 'installment_unconfirmed',
        'message', format('Your tuition installment %s must be confirmed before Month %s becomes available.', v_missing.number, p_month_number),
        'meta', jsonb_build_object('installment', v_missing.number, 'month', p_month_number));
    end if;
  end if;

  -- academic gate (bypassed only by an active, audited override)
  if m.id is not null then
    select exists (select 1 from public.month_overrides o where o.enrollment_id = p_enrollment_id and o.month_id = m.id and o.revoked_at is null) into v_override;
  end if;

  if p_month_number > 1 and not v_override then
    select * into pm from public.course_months where course_id = e.course_id and month_number = p_month_number - 1;

    if pm.id is not null then
      v_incomplete := public.fn_month_requirements_incomplete(e.id, pm.id);
      if (v_incomplete->>'lessons_missing')::int > 0 or (v_incomplete->>'quizzes_missing')::int > 0 then
        reasons := reasons || jsonb_build_object('code', 'previous_month_incomplete',
          'message', format('Finish the required lessons and quizzes of Month %s to continue.', p_month_number - 1),
          'meta', jsonb_build_object('month', p_month_number - 1, 'lessons_missing', (v_incomplete->>'lessons_missing')::int, 'quizzes_missing', (v_incomplete->>'quizzes_missing')::int));
      end if;

      select aa.result into v_prev_result
      from public.assessment_attempts aa
      where aa.enrollment_id = p_enrollment_id and aa.month_id = pm.id
      order by aa.attempt_number desc limit 1;

      if v_prev_result is null and not pm.requires_assessment then
        v_prev_result := 'pass';
      end if;
    end if;

    if v_prev_result is null then
      reasons := reasons || jsonb_build_object('code', 'previous_month_assessment_pending',
        'message', format('Complete your Month %s assessment to continue. Month %s unlocks after your trainer records a pass.', p_month_number - 1, p_month_number),
        'meta', jsonb_build_object('month', p_month_number - 1));
    elsif v_prev_result = 'not_passed' then
      reasons := reasons || jsonb_build_object('code', 'previous_month_assessment_not_passed',
        'message', format('Your Month %s assessment requires another attempt. Review the material and your trainer will reassess you.', p_month_number - 1),
        'meta', jsonb_build_object('month', p_month_number - 1));
    end if;
  end if;

  return jsonb_build_object('allowed', jsonb_array_length(reasons) = 0, 'reasons', reasons, 'overridden', v_override and jsonb_array_length(reasons) = 0);
end $$;

-- A lesson completion or quiz pass can be the last missing requirement: tell the student.
create or replace function public.save_lesson_progress(p_lesson_id uuid, p_position_seconds int, p_completed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_enrollment uuid; v_was_complete boolean;
begin
  if not public.fn_student_can_access_lesson(p_lesson_id) then
    raise exception 'lesson is locked' using errcode = '42501';
  end if;
  select e.id into v_enrollment
  from public.enrollments e
  join public.course_months m on m.course_id = e.course_id
  join public.modules mo on mo.month_id = m.id
  join public.lessons l on l.module_id = mo.id
  where l.id = p_lesson_id and e.user_id = auth.uid();
  select completed_at is not null into v_was_complete from public.lesson_progress where enrollment_id = v_enrollment and lesson_id = p_lesson_id;
  insert into public.lesson_progress (enrollment_id, lesson_id, last_position_seconds, completed_at)
  values (v_enrollment, p_lesson_id, greatest(0, coalesce(p_position_seconds, 0)), case when p_completed then now() end)
  on conflict (enrollment_id, lesson_id) do update
    set last_position_seconds = excluded.last_position_seconds,
        completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
        updated_at = now();
  if p_completed and not coalesce(v_was_complete, false) then
    perform public.fn_notify_if_month_unlocked(v_enrollment);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Quizzes: correct answers/explanations are revealed only once the quiz is passed or no
--    attempts remain; otherwise the student learns which questions were wrong, not the answers.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q record; c record; v_enrollment uuid; v_attempts int; v_points int := 0; v_earned int := 0;
  qq record; v_ans jsonb; v_ok boolean; v_score int; v_passed boolean; v_detail jsonb := '[]'::jsonb; v_pass_mark int; v_id uuid;
  v_reveal boolean; v_results jsonb := '[]'::jsonb; r jsonb;
begin
  select * into q from public.quizzes where id = p_quiz_id and is_published;
  if q.id is null then raise exception 'quiz not found' using errcode = 'P0002'; end if;
  if not public.fn_student_can_access_month(q.month_id) then raise exception 'quiz is locked' using errcode = '42501'; end if;
  select e.id into v_enrollment from public.enrollments e join public.course_months m on m.course_id = e.course_id where m.id = q.month_id and e.user_id = auth.uid();
  select c2.* into c from public.courses c2 join public.course_months m on m.course_id = c2.id where m.id = q.month_id;
  -- serialise concurrent submissions for the same enrollment/quiz so attempt limits hold
  perform pg_advisory_xact_lock(hashtext(q.id::text || v_enrollment::text));
  select count(*) into v_attempts from public.quiz_attempts where quiz_id = q.id and enrollment_id = v_enrollment;
  if q.max_attempts is not null and v_attempts >= q.max_attempts then
    raise exception 'maximum attempts reached' using errcode = 'P0001';
  end if;
  v_pass_mark := coalesce(q.passing_score, c.quiz_passing_score);

  for qq in select * from public.quiz_questions where quiz_id = q.id order by position loop
    v_points := v_points + qq.points;
    v_ans := p_answers -> qq.id::text;
    v_ok := false;
    if qq.question_type in ('multiple_choice', 'video_multiple_choice') then
      v_ok := v_ans is not null and jsonb_typeof(v_ans) = 'string' and v_ans = qq.correct_answer;
    elsif qq.question_type = 'matching' then
      v_ok := v_ans is not null and jsonb_typeof(v_ans) = 'object' and v_ans = qq.correct_answer;
    end if;
    if v_ok then v_earned := v_earned + qq.points; end if;
    v_detail := v_detail || jsonb_build_object('question_id', qq.id, 'correct', v_ok, 'correct_answer', qq.correct_answer, 'explanation', qq.explanation, 'your_answer', v_ans);
  end loop;

  v_score := case when v_points = 0 then 0 else round(100.0 * v_earned / v_points) end;
  v_passed := v_score >= v_pass_mark;
  insert into public.quiz_attempts (quiz_id, enrollment_id, attempt_number, answers, score, passed)
  values (q.id, v_enrollment, v_attempts + 1, coalesce(p_answers, '{}'::jsonb), v_score, v_passed) returning id into v_id;

  v_reveal := v_passed or (q.max_attempts is not null and v_attempts + 1 >= q.max_attempts);
  if v_reveal then
    v_results := v_detail;
  else
    for r in select * from jsonb_array_elements(v_detail) loop
      v_results := v_results || jsonb_build_object('question_id', r->'question_id', 'correct', r->'correct', 'correct_answer', null, 'explanation', null, 'your_answer', r->'your_answer');
    end loop;
  end if;

  if v_passed then
    perform public.fn_notify_if_month_unlocked(v_enrollment);
  end if;
  return jsonb_build_object('attempt_id', v_id, 'attempt_number', v_attempts + 1, 'score', v_score, 'passed', v_passed, 'passing_score', v_pass_mark,
    'answers_revealed', v_reveal, 'questions', v_results);
end $$;

-- ---------------------------------------------------------------------------
-- Exams: STABLE (reads now()), never IMMUTABLE.
-- ---------------------------------------------------------------------------
create or replace function public.fn_exam_is_open(p_exam public.exams) returns boolean language sql stable as $$
  select p_exam.status = 'open' or (p_exam.status = 'scheduled' and p_exam.opens_at is not null and p_exam.opens_at <= now() and (p_exam.closes_at is null or p_exam.closes_at > now()));
$$;

-- An autosave after the deadline must not roll back the automatic submission (raising an error
-- would undo it). Return a status instead; the client shows "time is up".
drop function if exists public.save_exam_answers(uuid, jsonb);
create or replace function public.save_exam_answers(p_attempt_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if a.id is null or not public.owns_enrollment(a.enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then
    return jsonb_build_object('saved', false, 'status', a.status, 'reason', 'already_submitted');
  end if;
  if a.deadline_at is not null and a.deadline_at < now() then
    perform public.submit_exam_attempt(a.id);
    return jsonb_build_object('saved', false, 'status', 'submitted', 'reason', 'time_limit');
  end if;
  update public.exam_attempts set answers = coalesce(a.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb) where id = a.id;
  return jsonb_build_object('saved', true, 'status', 'in_progress');
end $$;

-- ---------------------------------------------------------------------------
-- 10. Receipt numbers: pgcrypto lives in `extensions` on hosted Supabase.
-- ---------------------------------------------------------------------------
create or replace function public.fn_generate_receipt_number() returns text
language sql set search_path = public, extensions as $$
  select 'RCPT-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8));
$$;

-- ---------------------------------------------------------------------------
-- 11. Certificates: reissue re-checks eligibility and never creates a second valid certificate.
--     Eligibility may be read by the student themself or staff managing the enrollment.
-- ---------------------------------------------------------------------------
create or replace function public.get_certificate_eligibility(p_enrollment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.owns_enrollment(p_enrollment_id) or public.can_manage_enrollment(p_enrollment_id)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return public.fn_certificate_eligibility(p_enrollment_id);
end $$;

create or replace function public.reissue_certificate(p_certificate_id uuid, p_reason text, p_student_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cert record; v_id uuid; v_number text; v_elig jsonb;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'reason required' using errcode = '22023'; end if;
  select * into cert from public.certificates where id = p_certificate_id for update;
  if cert.id is null then raise exception 'certificate not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.certificates where enrollment_id = cert.enrollment_id and status = 'issued' and id <> cert.id) then
    raise exception 'a valid certificate already exists for this enrollment' using errcode = '23505';
  end if;
  v_elig := public.fn_certificate_eligibility(cert.enrollment_id);
  if not (v_elig->>'eligible')::boolean then
    raise exception 'student is not eligible: %', v_elig->'missing' using errcode = 'P0001';
  end if;
  if cert.status = 'issued' then perform public.revoke_certificate(cert.id, 'Reissued: ' || trim(p_reason)); end if;
  v_number := public.fn_generate_certificate_number();
  insert into public.certificates (enrollment_id, user_id, certificate_number, student_name, course_title, certificate_title, completion_date, issued_by, reissued_from)
  values (cert.enrollment_id, cert.user_id, v_number, coalesce(nullif(trim(p_student_name), ''), cert.student_name), cert.course_title, cert.certificate_title, cert.completion_date, auth.uid(), cert.id)
  returning id into v_id;
  perform public.fn_audit('certificate.reissued', 'certificate', v_id::text, cert.user_id, jsonb_build_object('from', cert.id, 'number', v_number, 'reason', trim(p_reason)));
  perform public.fn_notify(cert.user_id, 'certificate_issued', 'Your certificate has been reissued', 'Certificate ' || v_number || ' replaces ' || cert.certificate_number || '.', '/app/certificate');
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Assessments: the assigned trainer must be an active trainer/admin; direct status edits audited.
-- ---------------------------------------------------------------------------
create or replace function public.schedule_assessment(p_enrollment_id uuid, p_month_id uuid, p_scheduled_at timestamptz, p_trainer_id uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; e record; m record; v_trainer uuid;
begin
  if not public.can_manage_enrollment(p_enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into e from public.enrollments where id = p_enrollment_id;
  select * into m from public.course_months where id = p_month_id and course_id = e.course_id;
  if m.id is null then raise exception 'month does not belong to course' using errcode = '22023'; end if;
  v_trainer := coalesce(p_trainer_id, case when public.is_trainer() then auth.uid() end);
  if v_trainer is not null and not exists (
    select 1 from public.profiles where id = v_trainer and role in ('TRAINER', 'ADMIN', 'SUPER_ADMIN') and account_status = 'active'
  ) then
    raise exception 'the assessor must be an active trainer' using errcode = '22023';
  end if;
  insert into public.assessments (enrollment_id, month_id, trainer_id, scheduled_at, notes, created_by, is_reassessment)
  values (e.id, m.id, v_trainer, p_scheduled_at, p_notes, auth.uid(),
    exists (select 1 from public.assessment_attempts where enrollment_id = e.id and month_id = m.id))
  returning id into v_id;
  perform public.fn_notify(e.user_id, 'assessment_scheduled', format('Month %s assessment scheduled', m.month_number),
    case when p_scheduled_at is null then 'Your trainer will contact you with the details.' else 'Scheduled for ' || to_char(p_scheduled_at, 'DD Mon YYYY HH24:MI') end, '/app/assessments');
  perform public.fn_audit('assessment.scheduled', 'assessment', v_id::text, e.user_id, jsonb_build_object('month', m.month_number));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Role management: never remove the last active SUPER_ADMIN.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor public.user_role := public.current_user_role();
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if v_actor = 'ADMIN' and p_role in ('ADMIN', 'SUPER_ADMIN') then raise exception 'only a super admin can grant admin roles' using errcode = '42501'; end if;
  if v_actor = 'ADMIN' and exists (select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')) then
    raise exception 'only a super admin can change an admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then raise exception 'you cannot change your own role' using errcode = '42501'; end if;
  if p_role <> 'SUPER_ADMIN' and exists (select 1 from public.profiles where id = p_user_id and role = 'SUPER_ADMIN')
     and (select count(*) from public.profiles where role = 'SUPER_ADMIN' and account_status = 'active') <= 1 then
    raise exception 'the last super admin cannot be demoted' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end $$;

-- Only a SUPER_ADMIN may suspend/reactivate an ADMIN or SUPER_ADMIN account.
create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'you cannot suspend yourself' using errcode = '42501'; end if;
  if not public.is_super_admin() and exists (select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')) then
    raise exception 'only a super admin can suspend an admin' using errcode = '42501';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  perform public.fn_audit('profile.status_changed', 'profile', p_user_id::text, p_user_id, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.tg_protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.user_role := public.current_user_role();
begin
  -- Direct database / service-role access (no user JWT) is trusted (migrations, bootstrap_super_admin()).
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
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
  if new.account_status is distinct from old.account_status then
    if not public.is_admin() or (old.role in ('ADMIN', 'SUPER_ADMIN') and not public.is_super_admin()) then
      raise exception 'not authorised to change account status' using errcode = '42501';
    end if;
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    -- e-mail changes go through Supabase Auth; the profile copy is not user-editable
    new.email := old.email;
  end if;
  -- Nationality drives pricing; lock it once an enrollment exists unless an admin edits it.
  if new.nationality is distinct from old.nationality and not public.is_admin()
     and exists (select 1 from public.enrollments where user_id = old.id) then
    raise exception 'nationality cannot be changed after enrollment; contact support' using errcode = '42501';
  end if;
  if new.nationality is distinct from old.nationality then
    perform public.fn_audit('profile.nationality_changed', 'profile', new.id::text, new.id, jsonb_build_object('from', old.nationality, 'to', new.nationality));
  end if;
  return new;
end $$;

-- First SUPER_ADMIN bootstrap. Only from a direct database session (SQL editor, `psql`,
-- scripts/bootstrap-super-admin.mjs) – never through the API – and only while no SUPER_ADMIN exists.
create or replace function public.bootstrap_super_admin(p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'bootstrap must be run from a direct database session' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    raise exception 'a super admin already exists; use Admin → Trainers & staff to grant roles' using errcode = 'P0001';
  end if;
  select id into v_id from public.profiles where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'no account with that e-mail; register through the website and confirm the e-mail first' using errcode = 'P0002';
  end if;
  update public.profiles set role = 'SUPER_ADMIN', account_status = 'active' where id = v_id;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, target_user_id, metadata)
  values (null, null, 'profile.super_admin_bootstrapped', 'profile', v_id::text, v_id, jsonb_build_object('via', 'bootstrap_super_admin', 'db_user', current_user));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Audit for admin edits made with direct table writes (RLS-permitted for admins).
-- ---------------------------------------------------------------------------
create or replace function public.tg_audit_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_changed text[]; v_row jsonb; v_old jsonb; v_id text; v_target uuid;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_id := coalesce(v_row->>'id', v_row->>'key');
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(v_row) k
    where k not in ('updated_at', 'updated_by') and (v_row->k) is distinct from (v_old->k);
    if v_changed is null then return new; end if;
  end if;
  if tg_table_name = 'enrollments' then v_target := (v_row->>'user_id')::uuid;
  elsif tg_table_name = 'trainer_assignments' then v_target := (v_row->>'trainer_id')::uuid;
  end if;
  perform public.fn_audit(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_target,
    jsonb_strip_nulls(jsonb_build_object(
      'changed', to_jsonb(v_changed),
      -- only non-sensitive scalar changes are recorded verbatim
      'is_enabled', case when tg_table_name = 'payment_methods' then v_row->'is_enabled' end,
      'status', case when tg_table_name in ('enrollments', 'assessments') then v_row->'status' end,
      'tuition_national', case when tg_table_name = 'courses' then v_row->'tuition_national' end,
      'tuition_international', case when tg_table_name = 'courses' then v_row->'tuition_international' end,
      'registration_fee', case when tg_table_name = 'courses' then v_row->'registration_fee' end,
      'course_id', case when tg_table_name = 'trainer_assignments' then v_row->'course_id' end)));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['payment_methods', 'courses', 'trainer_assignments', 'enrollments', 'assessments', 'cohorts'] loop
    execute format('drop trigger if exists audit_admin_change on public.%I', t);
    execute format('create trigger audit_admin_change after insert or update or delete on public.%I for each row execute function public.tg_audit_admin_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Function EXECUTE privileges: whitelist instead of Supabase's default "everyone".
--    Policy helpers stay executable (they only answer questions about the caller); internal
--    helpers are reachable only from other SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

do $$
declare
  f record;
  -- callable by signed-in users (each re-checks the caller inside)
  v_auth text[] := array[
    -- RLS/storage policy helpers (answer questions about auth.uid() only)
    'current_user_role', 'is_admin', 'is_super_admin', 'is_staff', 'is_trainer', 'account_is_active',
    'trainer_assigned_to_course', 'trainer_assigned_to_enrollment', 'trainer_can_view_user', 'can_manage_enrollment',
    'owns_enrollment', 'fn_student_can_access_month', 'fn_student_can_access_lesson', 'fn_student_enrolled_in_course',
    'storage_path_owner', 'can_moderate_thread', 'can_handle_ticket', 'mask_identifier', 'fn_exam_is_open', 'fn_build_installments',
    -- business RPCs used by the app
    'get_my_course_map', 'enroll_in_course', 'submit_payment', 'review_payment', 'save_lesson_progress', 'submit_quiz_attempt',
    'schedule_assessment', 'record_assessment_result', 'override_month_unlock', 'revoke_month_override',
    'start_exam_attempt', 'save_exam_answers', 'submit_exam_attempt', 'grade_exam_attempt', 'release_exam_results',
    'get_certificate_eligibility', 'approve_enrollment_completion', 'issue_certificate', 'revoke_certificate', 'reissue_certificate',
    'submit_identity', 'register_identity_document', 'review_identity', 'delete_identity_document', 'admin_reveal_identity_number',
    'authorize_identity_document_access', 'moderate_discussion', 'update_ticket_status', 'mark_notifications_read',
    'set_site_content', 'set_platform_setting', 'admin_set_user_role', 'admin_set_account_status', 'admin_set_enrollment_status',
    'admin_dashboard_stats', 'trainer_dashboard_stats', 'staff_quiz_questions', 'staff_exam_questions', 'staff_exam_attempts',
    'verify_certificate', 'get_public_settings'
  ];
  -- also callable anonymously
  v_anon text[] := array[
    'verify_certificate', 'get_public_settings',
    -- evaluated inside RLS policies of publicly readable tables
    'is_admin', 'is_staff', 'is_trainer', 'is_super_admin', 'account_is_active', 'current_user_role',
    'fn_student_can_access_month', 'fn_student_can_access_lesson', 'fn_student_enrolled_in_course', 'owns_enrollment',
    'can_manage_enrollment', 'trainer_assigned_to_course', 'trainer_assigned_to_enrollment', 'trainer_can_view_user',
    'can_moderate_thread', 'can_handle_ticket', 'storage_path_owner'
  ];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    if f.proname = any(v_auth) then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    if f.proname = any(v_anon) then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
