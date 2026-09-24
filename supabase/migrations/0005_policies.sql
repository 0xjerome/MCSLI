-- MCSLI Learning Platform – 0005: Row Level Security policies
-- Default deny. Policies are additive; each table lists who may read and write.
-- Business mutations mostly happen through SECURITY DEFINER RPCs (0004); direct
-- writes are only allowed where the table is simple and ownership is clear.

-- helper macro: drop all policies of a table so this file is re-runnable
create or replace function public.__drop_policies(p_table text) returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', r.policyname, p_table);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
select public.__drop_policies('profiles');
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_select_staff on public.profiles for select using (public.is_staff());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());
-- inserts happen through the auth trigger (security definer); no direct insert policy.

-- ---------------------------------------------------------------------------
-- identity (no SELECT on the raw table for anyone – see identity_summary view and reveal function)
-- ---------------------------------------------------------------------------
select public.__drop_policies('identity_verifications');
-- writes only via submit_identity()/review_identity() (security definer). No policies → deny.

select public.__drop_policies('identity_documents');
create policy identity_documents_select_own on public.identity_documents for select using (user_id = auth.uid() and deleted_at is null);
create policy identity_documents_select_admin on public.identity_documents for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses / curriculum
-- ---------------------------------------------------------------------------
select public.__drop_policies('courses');
create policy courses_select_public on public.courses for select using (is_published and not is_archived);
create policy courses_select_staff on public.courses for select using (public.is_staff());
create policy courses_write_admin on public.courses for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('cohorts');
create policy cohorts_select_auth on public.cohorts for select using (auth.uid() is not null);
create policy cohorts_write_admin on public.cohorts for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('trainer_assignments');
create policy trainer_assignments_select on public.trainer_assignments for select using (trainer_id = auth.uid() or public.is_admin());
create policy trainer_assignments_write_admin on public.trainer_assignments for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('course_months');
create policy course_months_select_public on public.course_months for select
  using (is_published and exists (select 1 from public.courses c where c.id = course_id and c.is_published and not c.is_archived));
create policy course_months_select_staff on public.course_months for select using (public.is_staff());
create policy course_months_write_admin on public.course_months for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('modules');
-- Students only see modules of months they can access; the public catalogue shows month titles only.
create policy modules_select_student on public.modules for select using (public.fn_student_can_access_month(month_id));
create policy modules_select_staff on public.modules for select using (public.is_staff());
create policy modules_write_admin on public.modules for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('lessons');
create policy lessons_select_student on public.lessons for select
  using (is_published and public.fn_student_can_access_month((select month_id from public.modules where id = module_id)));
create policy lessons_select_staff on public.lessons for select using (public.is_staff());
create policy lessons_write_admin on public.lessons for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('lesson_resources');
create policy lesson_resources_select_student on public.lesson_resources for select using (public.fn_student_can_access_lesson(lesson_id));
create policy lesson_resources_select_staff on public.lesson_resources for select using (public.is_staff());
create policy lesson_resources_write_admin on public.lesson_resources for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('practice_items');
create policy practice_items_select_student on public.practice_items for select using (is_published and public.fn_student_can_access_month(month_id));
create policy practice_items_select_staff on public.practice_items for select using (public.is_staff());
create policy practice_items_write_admin on public.practice_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- enrollments / payments
-- ---------------------------------------------------------------------------
select public.__drop_policies('enrollments');
create policy enrollments_select_own on public.enrollments for select using (user_id = auth.uid());
create policy enrollments_select_staff on public.enrollments for select using (public.is_admin() or public.trainer_assigned_to_enrollment(id));
create policy enrollments_update_admin on public.enrollments for update using (public.is_admin()) with check (public.is_admin());
-- inserts only through enroll_in_course()

select public.__drop_policies('payment_methods');
create policy payment_methods_select_enabled on public.payment_methods for select using (is_enabled and auth.uid() is not null);
create policy payment_methods_select_admin on public.payment_methods for select using (public.is_admin());
create policy payment_methods_write_admin on public.payment_methods for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('payments');
create policy payments_select_own on public.payments for select using (user_id = auth.uid());
create policy payments_select_admin on public.payments for select using (public.is_admin());
-- inserts only through submit_payment(); status changes only through review_payment()

-- ---------------------------------------------------------------------------
-- progress / quizzes
-- ---------------------------------------------------------------------------
select public.__drop_policies('lesson_progress');
create policy lesson_progress_select_own on public.lesson_progress for select using (public.owns_enrollment(enrollment_id));
create policy lesson_progress_select_staff on public.lesson_progress for select using (public.can_manage_enrollment(enrollment_id));
-- writes through save_lesson_progress()

select public.__drop_policies('quizzes');
create policy quizzes_select_student on public.quizzes for select using (is_published and public.fn_student_can_access_month(month_id));
create policy quizzes_select_staff on public.quizzes for select using (public.is_staff());
create policy quizzes_write_admin on public.quizzes for all using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('quiz_questions');
-- Students read questions ONLY through the quiz_questions_student view (security invoker) – this policy
-- lets the view work but the view omits correct_answer/explanation. Direct table reads by students would
-- expose answers, so the client must always use the view; defence in depth: column privileges below.
create policy quiz_questions_select_student on public.quiz_questions for select
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published and public.fn_student_can_access_month(q.month_id)));
create policy quiz_questions_select_staff on public.quiz_questions for select using (public.is_staff());
create policy quiz_questions_write_staff on public.quiz_questions for all
  using (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select m.course_id from public.quizzes q join public.course_months m on m.id = q.month_id where q.id = quiz_id))))
  with check (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select m.course_id from public.quizzes q join public.course_months m on m.id = q.month_id where q.id = quiz_id))));
-- Column-level protection: the shared `authenticated` role can only read non-answer columns
-- directly; staff read full rows through staff_quiz_questions() (security definer, role-checked).
revoke select on public.quiz_questions from authenticated, anon;
grant select (id, quiz_id, position, question_type, prompt, video_path, video_url, options, points, created_at) on public.quiz_questions to authenticated;
grant insert, update, delete on public.quiz_questions to authenticated;   -- still gated by RLS above

select public.__drop_policies('quiz_attempts');
create policy quiz_attempts_select_own on public.quiz_attempts for select using (public.owns_enrollment(enrollment_id));
create policy quiz_attempts_select_staff on public.quiz_attempts for select using (public.can_manage_enrollment(enrollment_id));

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
select public.__drop_policies('assessments');
create policy assessments_select_own on public.assessments for select using (public.owns_enrollment(enrollment_id));
create policy assessments_select_staff on public.assessments for select using (public.can_manage_enrollment(enrollment_id));
create policy assessments_update_staff on public.assessments for update using (public.can_manage_enrollment(enrollment_id)) with check (public.can_manage_enrollment(enrollment_id));

select public.__drop_policies('assessment_attempts');
create policy assessment_attempts_select_own on public.assessment_attempts for select using (public.owns_enrollment(enrollment_id));
create policy assessment_attempts_select_staff on public.assessment_attempts for select using (public.can_manage_enrollment(enrollment_id));

select public.__drop_policies('month_overrides');
create policy month_overrides_select_own on public.month_overrides for select using (public.owns_enrollment(enrollment_id));
create policy month_overrides_select_staff on public.month_overrides for select using (public.can_manage_enrollment(enrollment_id));

-- ---------------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------------
select public.__drop_policies('exams');
create policy exams_select_student on public.exams for select
  using (status <> 'draft' and public.fn_student_enrolled_in_course(course_id) and (month_id is null or public.fn_student_can_access_month(month_id)));
create policy exams_select_staff on public.exams for select using (public.is_staff());
create policy exams_write_staff on public.exams for all
  using (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course(course_id)))
  with check (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course(course_id)));

select public.__drop_policies('exam_questions');
create policy exam_questions_select_student on public.exam_questions for select
  using (exists (select 1 from public.exam_attempts ea where ea.exam_id = exam_id and public.owns_enrollment(ea.enrollment_id)));
create policy exam_questions_select_staff on public.exam_questions for select using (public.is_staff());
create policy exam_questions_write_staff on public.exam_questions for all
  using (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select course_id from public.exams where id = exam_id))))
  with check (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select course_id from public.exams where id = exam_id))));
revoke select on public.exam_questions from authenticated, anon;
grant select (id, exam_id, position, question_type, prompt, video_path, video_url, options, points, requires_manual_grading, created_at) on public.exam_questions to authenticated;
grant insert, update, delete on public.exam_questions to authenticated;   -- still gated by RLS above

select public.__drop_policies('exam_attempts');
create policy exam_attempts_select_own on public.exam_attempts for select using (public.owns_enrollment(enrollment_id));
create policy exam_attempts_select_staff on public.exam_attempts for select using (public.can_manage_enrollment(enrollment_id));
-- Students must never read total_score/passed before release: the shared role only gets the
-- non-score columns; staff use staff_exam_attempts(). The exam_attempts_student view below
-- reveals scores only once results_released_at is set.
revoke select on public.exam_attempts from authenticated, anon;
grant select (id, exam_id, enrollment_id, attempt_number, question_order, answers, status, started_at, deadline_at, submitted_at, results_released_at) on public.exam_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- discussions
-- ---------------------------------------------------------------------------
select public.__drop_policies('discussion_threads');
create policy threads_select on public.discussion_threads for select
  using ((not is_hidden or author_id = auth.uid() or public.is_staff()) and (public.fn_student_enrolled_in_course(course_id) or public.is_staff()));
create policy threads_insert on public.discussion_threads for insert
  with check (author_id = auth.uid() and public.account_is_active()
    and (public.fn_student_enrolled_in_course(course_id) or public.is_admin() or public.trainer_assigned_to_course(course_id))
    and (not is_announcement or public.is_admin() or public.trainer_assigned_to_course(course_id))
    and (not is_pinned or public.is_admin() or public.trainer_assigned_to_course(course_id)));
create policy threads_update_own on public.discussion_threads for update
  using (author_id = auth.uid()) with check (author_id = auth.uid() and (not is_announcement or public.is_staff()) and (not is_pinned or public.is_staff()));
create policy threads_delete_own on public.discussion_threads for delete using (author_id = auth.uid() or public.is_admin());

select public.__drop_policies('discussion_posts');
create policy posts_select on public.discussion_posts for select
  using ((not is_hidden or author_id = auth.uid() or public.is_staff())
    and exists (select 1 from public.discussion_threads t where t.id = thread_id));
create policy posts_insert on public.discussion_posts for insert
  with check (author_id = auth.uid() and public.account_is_active()
    and exists (select 1 from public.discussion_threads t where t.id = thread_id and not t.is_locked and (public.fn_student_enrolled_in_course(t.course_id) or public.is_admin() or public.trainer_assigned_to_course(t.course_id))));
create policy posts_update_own on public.discussion_posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_own on public.discussion_posts for delete using (author_id = auth.uid() or public.is_admin());

select public.__drop_policies('discussion_reports');
create policy reports_insert on public.discussion_reports for insert with check (reporter_id = auth.uid());
create policy reports_select on public.discussion_reports for select using (reporter_id = auth.uid() or public.is_staff());
create policy reports_update_staff on public.discussion_reports for update using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- certificates / support / notifications / audit / content
-- ---------------------------------------------------------------------------
select public.__drop_policies('certificates');
create policy certificates_select_own on public.certificates for select using (user_id = auth.uid());
create policy certificates_select_staff on public.certificates for select using (public.is_staff());
-- public verification via verify_certificate(); writes via issue/revoke/reissue

select public.__drop_policies('support_tickets');
create policy tickets_select_own on public.support_tickets for select using (user_id = auth.uid());
create policy tickets_select_staff on public.support_tickets for select using (public.is_staff());
create policy tickets_insert_own on public.support_tickets for insert with check (user_id = auth.uid() and public.account_is_active());
create policy tickets_update_staff on public.support_tickets for update using (public.is_staff()) with check (public.is_staff());

select public.__drop_policies('support_messages');
create policy support_messages_select on public.support_messages for select
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff())));
create policy support_messages_insert on public.support_messages for insert
  with check (author_id = auth.uid() and is_staff = public.is_staff()
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_staff())));

select public.__drop_policies('notifications');
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete using (user_id = auth.uid());

select public.__drop_policies('audit_logs');
create policy audit_select_admin on public.audit_logs for select using (public.is_admin());
-- inserts only via fn_audit()

select public.__drop_policies('site_content');
create policy site_content_select_public on public.site_content for select using (is_public);
create policy site_content_select_admin on public.site_content for select using (public.is_admin());
-- writes via set_site_content()

select public.__drop_policies('platform_settings');
create policy platform_settings_select_admin on public.platform_settings for select using (public.is_admin());
-- some settings are safe for students (e.g. registration_open); expose via fn below.

select public.__drop_policies('contact_messages');
create policy contact_messages_insert_anyone on public.contact_messages for insert with check (true);
create policy contact_messages_select_admin on public.contact_messages for select using (public.is_admin());
create policy contact_messages_update_admin on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());

select public.__drop_policies('events');
create policy events_select_public on public.events for select using (is_published);
create policy events_select_admin on public.events for select using (public.is_admin());
create policy events_write_admin on public.events for all using (public.is_admin()) with check (public.is_admin());

drop function public.__drop_policies(text);

-- ---------------------------------------------------------------------------
-- Student-safe exam attempt view (hides scores until results are released)
-- ---------------------------------------------------------------------------
create or replace view public.exam_attempts_student
with (security_invoker = false) as   -- owner view: applies its own row filter, masks scores until release
  select id, exam_id, enrollment_id, attempt_number, question_order, answers, status, started_at, deadline_at, submitted_at,
    case when results_released_at is not null then total_score end as total_score,
    case when results_released_at is not null then passed end as passed,
    case when results_released_at is not null then grader_feedback end as grader_feedback,
    results_released_at
  from public.exam_attempts
  where public.owns_enrollment(enrollment_id);

-- Staff accessors for columns hidden from the shared authenticated role.
create or replace function public.staff_quiz_questions(p_quiz_id uuid)
returns setof public.quiz_questions language sql stable security definer set search_path = public as $$
  select * from public.quiz_questions
  where quiz_id = p_quiz_id
    and (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select m.course_id from public.quizzes q join public.course_months m on m.id = q.month_id where q.id = p_quiz_id))))
  order by position;
$$;

create or replace function public.staff_exam_questions(p_exam_id uuid)
returns setof public.exam_questions language sql stable security definer set search_path = public as $$
  select * from public.exam_questions
  where exam_id = p_exam_id
    and (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select course_id from public.exams where id = p_exam_id))))
  order by position;
$$;

create or replace function public.staff_exam_attempts(p_exam_id uuid default null, p_enrollment_id uuid default null)
returns setof public.exam_attempts language sql stable security definer set search_path = public as $$
  select ea.* from public.exam_attempts ea
  where (p_exam_id is null or ea.exam_id = p_exam_id)
    and (p_enrollment_id is null or ea.enrollment_id = p_enrollment_id)
    and public.can_manage_enrollment(ea.enrollment_id)
  order by ea.submitted_at desc nulls last;
$$;

-- Public, read-only platform settings subset (e.g. whether registration is open).
create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.platform_settings where key in ('registration_open', 'support_email', 'support_phone', 'support_whatsapp');
$$;

-- ---------------------------------------------------------------------------
-- Grants: the anon/authenticated roles use RLS; functions are executable by authenticated
-- (and a few by anon). Supabase grants table privileges by default; we restrict the
-- sensitive ones explicitly.
-- ---------------------------------------------------------------------------
revoke all on public.identity_verifications from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;          -- RLS limits to admins
grant select on public.identity_summary to authenticated;
grant select on public.public_profiles to authenticated;
grant select on public.quiz_questions_student to authenticated;
grant select on public.exam_questions_student to authenticated;
grant select on public.exam_attempts_student to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;
revoke execute on function public.admin_reveal_identity_number(uuid) from anon;
revoke execute on function public.fn_audit(text, text, text, uuid, jsonb) from anon, authenticated;
revoke execute on function public.fn_notify(uuid, public.notification_type, text, text, text) from anon, authenticated;
revoke execute on function public.fn_notify_if_month_unlocked(uuid) from anon, authenticated;
