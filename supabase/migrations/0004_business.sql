-- MCSLI Learning Platform – 0004: business rules (server-side enforcement)
-- Every function re-checks the caller's role. Nothing here trusts the client.

-- ---------------------------------------------------------------------------
-- Fee schedule helpers
-- ---------------------------------------------------------------------------
-- Build the installments snapshot for an enrollment from course configuration.
create or replace function public.fn_build_installments(p_course_id uuid, p_nationality public.nationality_class, p_plan public.payment_plan_type)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  c record;
  v_tuition numeric;
  v_count int;
  v_explicit jsonb;
  v_amounts numeric[];
  v_base numeric;
  v_sum numeric := 0;
  v_out jsonb := '[]'::jsonb;
  i int;
  v_due int;
begin
  select * into c from public.courses where id = p_course_id;
  if c.id is null then raise exception 'course not found' using errcode = 'P0002'; end if;
  v_tuition := case when p_nationality = 'ugandan' then c.tuition_national else c.tuition_international end;
  if p_plan = 'full' then
    return jsonb_build_array(jsonb_build_object('number', 1, 'amount', v_tuition, 'due_before_month', 1));
  end if;
  if not c.installments_enabled then
    raise exception 'installment plan is not enabled for this course' using errcode = 'P0001';
  end if;
  v_count := greatest(2, c.installment_count);
  v_explicit := case when p_nationality = 'ugandan' then c.installment_amounts->'national' else c.installment_amounts->'international' end;
  if v_explicit is not null and jsonb_typeof(v_explicit) = 'array' and jsonb_array_length(v_explicit) = v_count then
    select array_agg((x)::numeric), sum((x)::numeric) into v_amounts, v_sum from jsonb_array_elements_text(v_explicit) x;
  end if;
  if v_amounts is null or v_sum <> v_tuition or exists (select 1 from unnest(v_amounts) a where a <= 0) then
    v_base := floor(v_tuition / v_count);
    v_amounts := array_fill(v_base, array[v_count]);
    v_amounts[v_count] := v_tuition - v_base * (v_count - 1);
  end if;
  for i in 1..v_count loop
    v_due := case when i = 1 then 1 else coalesce((c.installment_due_before_month->>(i::text))::int, i) end;
    v_out := v_out || jsonb_build_object('number', i, 'amount', v_amounts[i], 'due_before_month', v_due);
  end loop;
  return v_out;
end $$;

-- Confirmed sums per purpose for an enrollment.
create or replace function public.fn_confirmed_totals(p_enrollment_id uuid)
returns table (registration numeric, tuition numeric) language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(amount) filter (where purpose = 'registration'), 0),
    coalesce(sum(amount) filter (where purpose = 'tuition'), 0)
  from public.payments where enrollment_id = p_enrollment_id and status = 'confirmed';
$$;

-- ---------------------------------------------------------------------------
-- THE core rule: month access = active enrollment ∧ financial gate ∧ academic gate (or override)
-- Returns {"allowed": bool, "reasons": [{"code","message","meta"}], "overridden": bool}
-- ---------------------------------------------------------------------------
create or replace function public.fn_month_access(p_enrollment_id uuid, p_month_number int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e record;
  m record;
  t record;
  reasons jsonb := '[]'::jsonb;
  v_required numeric := 0;
  v_missing record;
  v_prev_result public.assessment_result;
  v_override boolean := false;
  v_cum numeric := 0;
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
    -- first uncovered installment that is due for this month
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

  -- academic gate (bypassed only by an active override)
  if m.id is not null then
    select exists (select 1 from public.month_overrides o where o.enrollment_id = p_enrollment_id and o.month_id = m.id and o.revoked_at is null) into v_override;
  end if;

  if p_month_number > 1 and not v_override then
    select aa.result into v_prev_result
    from public.assessment_attempts aa
    join public.course_months pm on pm.id = aa.month_id
    where aa.enrollment_id = p_enrollment_id and pm.course_id = e.course_id and pm.month_number = p_month_number - 1
    order by aa.attempt_number desc limit 1;

    -- if the previous month does not require an assessment, treat as passed
    if v_prev_result is null and exists (
      select 1 from public.course_months pm where pm.course_id = e.course_id and pm.month_number = p_month_number - 1 and not pm.requires_assessment
    ) then
      v_prev_result := 'pass';
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

-- Convenience: can the CURRENT user (student) access a month row?
create or replace function public.fn_student_can_access_month(p_month_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_months m
    join public.enrollments e on e.course_id = m.course_id and e.user_id = auth.uid()
    where m.id = p_month_id
      and (public.fn_month_access(e.id, m.month_number)->>'allowed')::boolean
  );
$$;

create or replace function public.fn_student_can_access_lesson(p_lesson_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lessons l
    join public.modules mo on mo.id = l.module_id
    where l.id = p_lesson_id and l.is_published and public.fn_student_can_access_month(mo.month_id)
  );
$$;

-- Student can read a course if enrolled or if it is published (catalogue).
create or replace function public.fn_student_enrolled_in_course(p_course_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where course_id = p_course_id and user_id = auth.uid());
$$;

-- Full course map for a student (months with lock state) – one round-trip for the UI.
create or replace function public.get_my_course_map(p_enrollment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; v_out jsonb;
begin
  select * into e from public.enrollments where id = p_enrollment_id;
  if e.id is null or (e.user_id <> auth.uid() and not public.can_manage_enrollment(p_enrollment_id)) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object(
      'id', m.id, 'month_number', m.month_number, 'title', m.title, 'description', m.description,
      'requires_assessment', m.requires_assessment,
      'access', public.fn_month_access(e.id, m.month_number),
      'lessons_total', (select count(*) from public.lessons l join public.modules mo on mo.id = l.module_id where mo.month_id = m.id and l.is_published),
      'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id join public.modules mo on mo.id = l.module_id where mo.month_id = m.id and lp.enrollment_id = e.id and lp.completed_at is not null),
      'quizzes_total', (select count(*) from public.quizzes q where q.month_id = m.id and q.is_published),
      'quizzes_passed', (select count(distinct qa.quiz_id) from public.quiz_attempts qa join public.quizzes q on q.id = qa.quiz_id where q.month_id = m.id and qa.enrollment_id = e.id and qa.passed),
      'assessment_result', (select aa.result from public.assessment_attempts aa where aa.enrollment_id = e.id and aa.month_id = m.id order by aa.attempt_number desc limit 1),
      'assessment_attempts', (select count(*) from public.assessment_attempts aa where aa.enrollment_id = e.id and aa.month_id = m.id)
    ) order by m.month_number)
  into v_out
  from public.course_months m where m.course_id = e.course_id and m.is_published;
  return coalesce(v_out, '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Enrollment
-- ---------------------------------------------------------------------------
create or replace function public.enroll_in_course(p_course_id uuid, p_plan public.payment_plan_type, p_cohort_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; c record; v_id uuid; v_tuition numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.account_status <> 'active' then raise exception 'account suspended' using errcode = '42501'; end if;
  select * into c from public.courses where id = p_course_id and is_published and not is_archived;
  if c.id is null then raise exception 'course not available' using errcode = 'P0002'; end if;
  if exists (select 1 from public.enrollments where user_id = p.id and course_id = c.id) then
    raise exception 'already enrolled' using errcode = '23505';
  end if;
  if p_cohort_id is not null and not exists (select 1 from public.cohorts where id = p_cohort_id and course_id = c.id and is_open) then
    raise exception 'cohort not open' using errcode = 'P0001';
  end if;
  v_tuition := case when p.nationality = 'ugandan' then c.tuition_national else c.tuition_international end;
  insert into public.enrollments (user_id, course_id, cohort_id, plan_type, nationality, currency, registration_fee, tuition_amount, installments)
  values (p.id, c.id, p_cohort_id, p_plan, p.nationality, c.currency, c.registration_fee, v_tuition, public.fn_build_installments(c.id, p.nationality, p_plan))
  returning id into v_id;
  perform public.fn_audit('enrollment.created', 'enrollment', v_id::text, p.id, jsonb_build_object('course_id', c.id, 'plan', p_plan));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Payments (manual confirmation workflow)
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment(
  p_enrollment_id uuid, p_purpose public.payment_purpose, p_installment_number int, p_method_id uuid,
  p_amount numeric, p_payer_name text, p_reference text, p_paid_at date, p_proof_path text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare e record; pm record; v_id uuid;
begin
  select * into e from public.enrollments where id = p_enrollment_id and user_id = auth.uid();
  if e.id is null then raise exception 'not authorised' using errcode = '42501'; end if;
  if e.status in ('withdrawn', 'suspended') then raise exception 'enrollment is not open for payments' using errcode = 'P0001'; end if;
  select * into pm from public.payment_methods where id = p_method_id and is_enabled;
  if pm.id is null then raise exception 'payment method not available' using errcode = 'P0002'; end if;
  if p_amount <= 0 or p_amount > 100000000 then raise exception 'invalid amount' using errcode = '22023'; end if;
  if length(trim(p_reference)) < 3 or length(p_reference) > 100 then raise exception 'invalid reference' using errcode = '22023'; end if;
  if length(trim(p_payer_name)) < 2 or length(p_payer_name) > 120 then raise exception 'invalid payer name' using errcode = '22023'; end if;
  if p_paid_at > current_date then raise exception 'payment date cannot be in the future' using errcode = '22023'; end if;
  if p_proof_path is not null and p_proof_path not like 'payment-proofs/' || auth.uid()::text || '/%' then
    raise exception 'invalid proof path' using errcode = '22023';
  end if;
  if p_purpose = 'tuition' and e.plan_type = 'installments' and (p_installment_number is null or p_installment_number < 1 or p_installment_number > jsonb_array_length(e.installments)) then
    raise exception 'installment number required' using errcode = '22023';
  end if;
  insert into public.payments (enrollment_id, user_id, purpose, installment_number, method_id, method_type, amount, currency, payer_name, reference, paid_at, proof_path)
  values (e.id, e.user_id, p_purpose, case when p_purpose = 'tuition' then coalesce(p_installment_number, 1) end, pm.id, pm.method_type, p_amount, e.currency, trim(p_payer_name), trim(p_reference), p_paid_at, p_proof_path)
  returning id into v_id;
  perform public.fn_audit('payment.submitted', 'payment', v_id::text, e.user_id, jsonb_build_object('amount', p_amount, 'purpose', p_purpose));
  return v_id;
end $$;

-- Admin review. Activates the enrollment once month 1 becomes financially accessible.
create or replace function public.review_payment(p_payment_id uuid, p_decision public.payment_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p record; e record; v_access jsonb; v_receipt text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_decision not in ('confirmed', 'rejected', 'under_review') then raise exception 'invalid decision' using errcode = '22023'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if p.status = 'confirmed' and p_decision <> 'confirmed' then
    raise exception 'confirmed payments cannot be changed; record an adjustment instead' using errcode = 'P0001';
  end if;
  v_receipt := case when p_decision = 'confirmed' then coalesce(p.receipt_number, public.fn_generate_receipt_number()) else p.receipt_number end;
  update public.payments set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note, receipt_number = v_receipt where id = p.id;
  perform public.fn_audit('payment.' || p_decision::text, 'payment', p.id::text, p.user_id, jsonb_build_object('amount', p.amount, 'note', p_note));

  if p_decision = 'confirmed' then
    perform public.fn_notify(p.user_id, 'payment_confirmed', 'Payment confirmed',
      format('Your %s payment of %s %s has been confirmed. Receipt %s.', p.purpose, p.currency, to_char(p.amount, 'FM999,999,999'), v_receipt), '/app/payments');
    select * into e from public.enrollments where id = p.enrollment_id for update;
    if e.status = 'pending_payment' then
      v_access := public.fn_month_access(e.id, 1);
      -- month 1 only needs the financial gate; enrollment_inactive is expected here, so test the financial reasons only
      if not exists (
        select 1 from jsonb_array_elements(v_access->'reasons') r
        where r->>'code' in ('registration_fee_unconfirmed', 'tuition_unconfirmed', 'installment_unconfirmed')
      ) then
        update public.enrollments set status = 'active', activated_at = now() where id = e.id;
        perform public.fn_notify(e.user_id, 'month_unlocked', 'Month 1 is now open', 'Your enrollment is active. Start learning from your dashboard.', '/app');
        perform public.fn_audit('enrollment.activated', 'enrollment', e.id::text, e.user_id);
      end if;
    else
      -- a later installment may have unlocked the next month
      perform public.fn_notify_if_month_unlocked(e.id);
    end if;
  elsif p_decision = 'rejected' then
    perform public.fn_notify(p.user_id, 'payment_rejected', 'Payment could not be confirmed',
      coalesce(p_note, 'Please check the reference and amount, then submit again.'), '/app/payments');
  end if;
end $$;

-- Notify the student when the next month has just become accessible.
create or replace function public.fn_notify_if_month_unlocked(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e record; v_next int; v_access jsonb; v_already boolean;
begin
  select * into e from public.enrollments where id = p_enrollment_id;
  -- next month after the highest passed assessment
  select coalesce(max(m.month_number), 0) + 1 into v_next
  from public.assessment_attempts aa join public.course_months m on m.id = aa.month_id
  where aa.enrollment_id = e.id and aa.result = 'pass';
  if v_next > (select duration_months from public.courses where id = e.course_id) then return; end if;
  v_access := public.fn_month_access(e.id, v_next);
  if (v_access->>'allowed')::boolean and v_next > 1 then
    select exists (select 1 from public.notifications where user_id = e.user_id and type = 'month_unlocked' and body like format('Month %s%%', v_next)) into v_already;
    if not v_already then
      perform public.fn_notify(e.user_id, 'month_unlocked', format('Month %s unlocked', v_next), format('Month %s is now available. Keep going!', v_next), '/app/course/' || e.course_id);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lessons: progress
-- ---------------------------------------------------------------------------
create or replace function public.save_lesson_progress(p_lesson_id uuid, p_position_seconds int, p_completed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_enrollment uuid;
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
  insert into public.lesson_progress (enrollment_id, lesson_id, last_position_seconds, completed_at)
  values (v_enrollment, p_lesson_id, greatest(0, coalesce(p_position_seconds, 0)), case when p_completed then now() end)
  on conflict (enrollment_id, lesson_id) do update
    set last_position_seconds = excluded.last_position_seconds,
        completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
        updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- Quizzes: server-side scoring; correct answers never leave the database before an attempt.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q record; c record; v_enrollment uuid; v_attempts int; v_points int := 0; v_earned int := 0;
  qq record; v_ans jsonb; v_ok boolean; v_score int; v_passed boolean; v_detail jsonb := '[]'::jsonb; v_pass_mark int; v_id uuid;
begin
  select * into q from public.quizzes where id = p_quiz_id and is_published;
  if q.id is null then raise exception 'quiz not found' using errcode = 'P0002'; end if;
  if not public.fn_student_can_access_month(q.month_id) then raise exception 'quiz is locked' using errcode = '42501'; end if;
  select e.id into v_enrollment from public.enrollments e join public.course_months m on m.course_id = e.course_id where m.id = q.month_id and e.user_id = auth.uid();
  select c2.* into c from public.courses c2 join public.course_months m on m.course_id = c2.id where m.id = q.month_id;
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
  return jsonb_build_object('attempt_id', v_id, 'attempt_number', v_attempts + 1, 'score', v_score, 'passed', v_passed, 'passing_score', v_pass_mark, 'questions', v_detail);
end $$;

-- ---------------------------------------------------------------------------
-- Assessments (trainer workflow)
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
  insert into public.assessments (enrollment_id, month_id, trainer_id, scheduled_at, notes, created_by,
    is_reassessment)
  values (e.id, m.id, v_trainer, p_scheduled_at, p_notes, auth.uid(),
    exists (select 1 from public.assessment_attempts where enrollment_id = e.id and month_id = m.id))
  returning id into v_id;
  perform public.fn_notify(e.user_id, 'assessment_scheduled', format('Month %s assessment scheduled', m.month_number),
    case when p_scheduled_at is null then 'Your trainer will contact you with the details.' else 'Scheduled for ' || to_char(p_scheduled_at, 'DD Mon YYYY HH24:MI') end, '/app/assessments');
  perform public.fn_audit('assessment.scheduled', 'assessment', v_id::text, e.user_id, jsonb_build_object('month', m.month_number));
  return v_id;
end $$;

-- Record the outcome of an assessment. Pass → progression evaluates automatically; Not passed → reassessment workflow.
create or replace function public.record_assessment_result(
  p_assessment_id uuid, p_score int, p_result public.assessment_result, p_feedback text default null, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare a record; e record; m record; v_attempt int; v_id uuid;
begin
  select * into a from public.assessments where id = p_assessment_id for update;
  if a.id is null then raise exception 'assessment not found' using errcode = 'P0002'; end if;
  if not public.can_manage_enrollment(a.enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status = 'completed' then raise exception 'assessment already completed' using errcode = 'P0001'; end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then raise exception 'score must be 0-100' using errcode = '22023'; end if;
  select * into e from public.enrollments where id = a.enrollment_id;
  select * into m from public.course_months where id = a.month_id;
  select coalesce(max(attempt_number), 0) + 1 into v_attempt from public.assessment_attempts where enrollment_id = e.id and month_id = m.id;

  insert into public.assessment_attempts (assessment_id, enrollment_id, month_id, attempt_number, score, result, trainer_feedback, notes, assessed_by)
  values (a.id, e.id, m.id, v_attempt, p_score, p_result, p_feedback, p_notes, auth.uid()) returning id into v_id;
  update public.assessments set status = 'completed' where id = a.id;
  perform public.fn_audit('assessment.recorded', 'assessment_attempt', v_id::text, e.user_id,
    jsonb_build_object('month', m.month_number, 'attempt', v_attempt, 'score', p_score, 'result', p_result));

  if p_result = 'pass' then
    perform public.fn_notify(e.user_id, 'assessment_passed', format('Month %s assessment passed', m.month_number),
      coalesce(p_feedback, 'Congratulations! Your trainer has recorded a pass.'), '/app/assessments');
    perform public.fn_notify_if_month_unlocked(e.id);
    -- course completed when the last month is passed
    if m.month_number = (select duration_months from public.courses where id = e.course_id) then
      update public.enrollments set status = 'completed', completed_at = now() where id = e.id and status = 'active';
    end if;
  else
    -- reassessment workflow: a new scheduled assessment awaiting the trainer
    insert into public.assessments (enrollment_id, month_id, trainer_id, status, is_reassessment, created_by, notes)
    values (e.id, m.id, a.trainer_id, 'scheduled', true, auth.uid(), 'Reassessment after attempt ' || v_attempt);
    perform public.fn_notify(e.user_id, 'reassessment_required', format('Month %s: assessment requires another attempt', m.month_number),
      coalesce(p_feedback, 'Review the month material. Your trainer will schedule a reassessment.'), '/app/assessments');
  end if;
  return v_id;
end $$;

-- Admin override of a month lock (academic gate only) – always audited.
create or replace function public.override_month_unlock(p_enrollment_id uuid, p_month_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; e record; m record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 10 then raise exception 'a reason of at least 10 characters is required' using errcode = '22023'; end if;
  select * into e from public.enrollments where id = p_enrollment_id;
  select * into m from public.course_months where id = p_month_id and course_id = e.course_id;
  if e.id is null or m.id is null then raise exception 'enrollment/month not found' using errcode = 'P0002'; end if;
  insert into public.month_overrides (enrollment_id, month_id, reason, created_by) values (e.id, m.id, trim(p_reason), auth.uid()) returning id into v_id;
  perform public.fn_audit('month.override_unlock', 'month_override', v_id::text, e.user_id,
    jsonb_build_object('course_id', e.course_id, 'month', m.month_number, 'reason', trim(p_reason)));
  if (public.fn_month_access(e.id, m.month_number)->>'allowed')::boolean then
    perform public.fn_notify(e.user_id, 'month_unlocked', format('Month %s unlocked', m.month_number), 'MCSLI has unlocked this month for you.', '/app/course/' || e.course_id);
  end if;
  return v_id;
end $$;

create or replace function public.revoke_month_override(p_override_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into o from public.month_overrides where id = p_override_id;
  if o.id is null then raise exception 'override not found' using errcode = 'P0002'; end if;
  update public.month_overrides set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason where id = o.id;
  perform public.fn_audit('month.override_revoked', 'month_override', o.id::text, (select user_id from public.enrollments where id = o.enrollment_id), jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Examinations
-- ---------------------------------------------------------------------------
create or replace function public.fn_exam_is_open(p_exam public.exams) returns boolean language sql immutable as $$
  select p_exam.status = 'open' or (p_exam.status = 'scheduled' and p_exam.opens_at is not null and p_exam.opens_at <= now() and (p_exam.closes_at is null or p_exam.closes_at > now()));
$$;

create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare x public.exams%rowtype; v_enrollment uuid; v_attempts int; v_existing record; v_order uuid[]; v_id uuid; v_deadline timestamptz;
begin
  select * into x from public.exams where id = p_exam_id;
  if x.id is null then raise exception 'exam not found' using errcode = 'P0002'; end if;
  if not public.fn_exam_is_open(x) then raise exception 'exam is not open' using errcode = 'P0001'; end if;
  select e.id into v_enrollment from public.enrollments e where e.course_id = x.course_id and e.user_id = auth.uid() and e.status in ('active', 'completed');
  if v_enrollment is null then raise exception 'not enrolled' using errcode = '42501'; end if;
  if x.month_id is not null and not public.fn_student_can_access_month(x.month_id) then raise exception 'exam is locked' using errcode = '42501'; end if;
  -- resume an in-progress attempt
  select * into v_existing from public.exam_attempts where exam_id = x.id and enrollment_id = v_enrollment and status = 'in_progress';
  if v_existing.id is not null then
    if v_existing.deadline_at is not null and v_existing.deadline_at < now() then
      perform public.submit_exam_attempt(v_existing.id);
    else
      return jsonb_build_object('attempt_id', v_existing.id, 'deadline_at', v_existing.deadline_at, 'question_order', to_jsonb(v_existing.question_order), 'answers', v_existing.answers, 'resumed', true);
    end if;
  end if;
  select count(*) into v_attempts from public.exam_attempts where exam_id = x.id and enrollment_id = v_enrollment;
  if v_attempts >= x.max_attempts then raise exception 'maximum attempts reached' using errcode = 'P0001'; end if;
  if x.randomize_questions then
    select array_agg(id order by random()) into v_order from public.exam_questions where exam_id = x.id;
  else
    select array_agg(id order by position) into v_order from public.exam_questions where exam_id = x.id;
  end if;
  v_deadline := case when x.time_limit_minutes is not null then least(now() + make_interval(mins => x.time_limit_minutes), coalesce(x.closes_at, 'infinity'::timestamptz)) else x.closes_at end;
  insert into public.exam_attempts (exam_id, enrollment_id, attempt_number, question_order, deadline_at)
  values (x.id, v_enrollment, v_attempts + 1, coalesce(v_order, '{}'), v_deadline) returning id into v_id;
  perform public.fn_audit('exam.attempt_started', 'exam_attempt', v_id::text, auth.uid(), jsonb_build_object('exam_id', x.id));
  return jsonb_build_object('attempt_id', v_id, 'deadline_at', v_deadline, 'question_order', to_jsonb(coalesce(v_order, '{}'::uuid[])), 'answers', '{}'::jsonb, 'resumed', false);
end $$;

create or replace function public.save_exam_answers(p_attempt_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if a.id is null or not public.owns_enrollment(a.enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt already submitted' using errcode = 'P0001'; end if;
  if a.deadline_at is not null and a.deadline_at < now() then
    perform public.submit_exam_attempt(a.id);
    raise exception 'time limit reached; attempt submitted automatically' using errcode = 'P0001';
  end if;
  update public.exam_attempts set answers = coalesce(a.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb) where id = a.id;
end $$;

-- Auto-grade what can be auto-graded; leave practical/manual questions for the trainer.
create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; x record; qq record; v_auto numeric := 0; v_auto_points numeric := 0; v_manual_points numeric := 0; v_ans jsonb; v_needs_manual boolean := false; v_total numeric;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if a.id is null then raise exception 'attempt not found' using errcode = 'P0002'; end if;
  if not (public.owns_enrollment(a.enrollment_id) or public.can_manage_enrollment(a.enrollment_id)) then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return jsonb_build_object('status', a.status); end if;
  select * into x from public.exams where id = a.exam_id;
  for qq in select * from public.exam_questions where exam_id = a.exam_id loop
    v_ans := a.answers -> qq.id::text;
    if qq.requires_manual_grading or qq.question_type = 'practical' or qq.correct_answer is null then
      v_manual_points := v_manual_points + qq.points; v_needs_manual := true;
    else
      v_auto_points := v_auto_points + qq.points;
      if v_ans is not null and v_ans = qq.correct_answer then v_auto := v_auto + qq.points; end if;
    end if;
  end loop;
  v_total := case when v_needs_manual then null when v_auto_points = 0 then 0 else round(100.0 * v_auto / v_auto_points, 2) end;
  update public.exam_attempts set
    status = (case when v_needs_manual then 'submitted' else 'graded' end)::public.exam_attempt_status,
    submitted_at = now(), auto_score = v_auto, total_score = v_total,
    passed = case when v_needs_manual then null else v_total >= x.passing_score end,
    graded_at = case when v_needs_manual then null else now() end
  where id = a.id;
  perform public.fn_audit('exam.attempt_submitted', 'exam_attempt', a.id::text, (select user_id from public.enrollments where id = a.enrollment_id), jsonb_build_object('needs_manual', v_needs_manual, 'auto_score', v_auto));
  return jsonb_build_object('status', case when v_needs_manual then 'submitted' else 'graded' end, 'needs_manual_grading', v_needs_manual, 'auto_points', v_auto, 'auto_points_available', v_auto_points, 'manual_points_available', v_manual_points);
end $$;

create or replace function public.grade_exam_attempt(p_attempt_id uuid, p_manual_scores jsonb, p_feedback text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; x record; qq record; v_manual numeric := 0; v_points numeric := 0; v_earned numeric := 0; v_s numeric; v_total numeric;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if a.id is null then raise exception 'attempt not found' using errcode = 'P0002'; end if;
  if not public.can_manage_enrollment(a.enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status = 'in_progress' then raise exception 'attempt not yet submitted' using errcode = 'P0001'; end if;
  select * into x from public.exams where id = a.exam_id;
  for qq in select * from public.exam_questions where exam_id = a.exam_id loop
    v_points := v_points + qq.points;
    if qq.requires_manual_grading or qq.question_type = 'practical' or qq.correct_answer is null then
      v_s := least(qq.points, greatest(0, coalesce((p_manual_scores->>qq.id::text)::numeric, 0)));
      v_earned := v_earned + v_s; v_manual := v_manual + v_s;
    else
      if (a.answers -> qq.id::text) = qq.correct_answer then v_earned := v_earned + qq.points; end if;
    end if;
  end loop;
  v_total := case when v_points = 0 then 0 else round(100.0 * v_earned / v_points, 2) end;
  update public.exam_attempts set status = 'graded', manual_scores = p_manual_scores, total_score = v_total, passed = v_total >= x.passing_score,
    graded_by = auth.uid(), graded_at = now(), grader_feedback = p_feedback where id = a.id;
  perform public.fn_audit('exam.attempt_graded', 'exam_attempt', a.id::text, (select user_id from public.enrollments where id = a.enrollment_id), jsonb_build_object('total', v_total));
  return jsonb_build_object('total_score', v_total, 'passed', v_total >= x.passing_score);
end $$;

create or replace function public.release_exam_results(p_exam_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int; r record;
begin
  if not (public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course((select course_id from public.exams where id = p_exam_id)))) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.exam_attempts set results_released_at = now() where exam_id = p_exam_id and status = 'graded' and results_released_at is null;
  get diagnostics v_count = row_count;
  update public.exams set status = 'results_released' where id = p_exam_id;
  for r in select ea.total_score, ea.passed, e.user_id, x.title from public.exam_attempts ea join public.enrollments e on e.id = ea.enrollment_id join public.exams x on x.id = ea.exam_id
           where ea.exam_id = p_exam_id and ea.results_released_at >= now() - interval '1 minute' loop
    perform public.fn_notify(r.user_id, 'exam_graded', 'Exam results released: ' || r.title, format('You scored %s%% – %s.', r.total_score, case when r.passed then 'passed' else 'not passed' end), '/app/exams');
  end loop;
  perform public.fn_audit('exam.results_released', 'exam', p_exam_id::text, null, jsonb_build_object('attempts', v_count));
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create or replace function public.fn_certificate_eligibility(p_enrollment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e record; c record; m record; missing jsonb := '[]'::jsonb; t record; v_final record;
begin
  select * into e from public.enrollments where id = p_enrollment_id;
  if e.id is null then return jsonb_build_object('eligible', false, 'missing', jsonb_build_array('Enrollment not found')); end if;
  select * into c from public.courses where id = e.course_id;
  if e.status not in ('active', 'completed') then missing := missing || to_jsonb('Enrollment is not active'::text); end if;
  for m in select * from public.course_months where course_id = c.id and is_published order by month_number loop
    if exists (select 1 from public.lessons l join public.modules mo on mo.id = l.module_id where mo.month_id = m.id and l.is_published and l.is_required
               and not exists (select 1 from public.lesson_progress lp where lp.lesson_id = l.id and lp.enrollment_id = e.id and lp.completed_at is not null)) then
      missing := missing || to_jsonb(format('Month %s: lessons not completed', m.month_number));
    end if;
    if exists (select 1 from public.quizzes q where q.month_id = m.id and q.is_published and q.is_required
               and not exists (select 1 from public.quiz_attempts qa where qa.quiz_id = q.id and qa.enrollment_id = e.id and qa.passed)) then
      missing := missing || to_jsonb(format('Month %s: quizzes not passed', m.month_number));
    end if;
    if m.requires_assessment and coalesce((select aa.result from public.assessment_attempts aa where aa.enrollment_id = e.id and aa.month_id = m.id order by aa.attempt_number desc limit 1), 'not_passed') <> 'pass' then
      missing := missing || to_jsonb(format('Month %s: assessment not passed', m.month_number));
    end if;
  end loop;
  if c.requires_final_exam then
    select ea.* into v_final from public.exam_attempts ea join public.exams x on x.id = ea.exam_id
    where x.course_id = c.id and x.is_final and ea.enrollment_id = e.id and ea.status = 'graded' and ea.passed order by ea.graded_at desc limit 1;
    if v_final.id is null then missing := missing || to_jsonb('Final examination not passed'::text); end if;
  end if;
  select * into t from public.fn_confirmed_totals(e.id);
  if t.registration < e.registration_fee or t.tuition < e.tuition_amount then
    missing := missing || to_jsonb('Tuition and registration fee not fully confirmed'::text);
  end if;
  if e.final_approved_at is null then missing := missing || to_jsonb('Final approval pending'::text); end if;
  return jsonb_build_object('eligible', jsonb_array_length(missing) = 0, 'missing', missing);
end $$;

create or replace function public.approve_enrollment_completion(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_enrollment(p_enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.enrollments set final_approved_by = auth.uid(), final_approved_at = now() where id = p_enrollment_id;
  perform public.fn_audit('enrollment.final_approved', 'enrollment', p_enrollment_id::text, (select user_id from public.enrollments where id = p_enrollment_id));
end $$;

create or replace function public.issue_certificate(p_enrollment_id uuid, p_completion_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; c record; p record; v_elig jsonb; v_id uuid; v_number text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  v_elig := public.fn_certificate_eligibility(p_enrollment_id);
  if not (v_elig->>'eligible')::boolean then
    raise exception 'student is not eligible: %', v_elig->'missing' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.certificates where enrollment_id = p_enrollment_id and status = 'issued') then
    raise exception 'a valid certificate already exists for this enrollment' using errcode = '23505';
  end if;
  select * into e from public.enrollments where id = p_enrollment_id;
  select * into c from public.courses where id = e.course_id;
  select * into p from public.profiles where id = e.user_id;
  v_number := public.fn_generate_certificate_number();
  insert into public.certificates (enrollment_id, user_id, certificate_number, student_name, course_title, certificate_title, completion_date, issued_by)
  values (e.id, e.user_id, v_number, p.full_name, c.title, c.certificate_title, p_completion_date, auth.uid()) returning id into v_id;
  update public.enrollments set status = 'completed', completed_at = coalesce(completed_at, now()) where id = e.id;
  perform public.fn_audit('certificate.issued', 'certificate', v_id::text, e.user_id, jsonb_build_object('number', v_number));
  perform public.fn_notify(e.user_id, 'certificate_issued', 'Your certificate has been issued', 'Certificate ' || v_number || ' is ready to download.', '/app/certificate');
  return v_id;
end $$;

create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare cert record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'reason required' using errcode = '22023'; end if;
  select * into cert from public.certificates where id = p_certificate_id;
  if cert.id is null then raise exception 'certificate not found' using errcode = 'P0002'; end if;
  update public.certificates set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = trim(p_reason) where id = cert.id;
  perform public.fn_audit('certificate.revoked', 'certificate', cert.id::text, cert.user_id, jsonb_build_object('reason', p_reason));
end $$;

-- Reissue: revokes the old certificate (e.g. name correction) and issues a new number.
create or replace function public.reissue_certificate(p_certificate_id uuid, p_reason text, p_student_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cert record; v_id uuid; v_number text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into cert from public.certificates where id = p_certificate_id;
  if cert.id is null then raise exception 'certificate not found' using errcode = 'P0002'; end if;
  if cert.status = 'issued' then perform public.revoke_certificate(cert.id, 'Reissued: ' || coalesce(p_reason, '')); end if;
  v_number := public.fn_generate_certificate_number();
  insert into public.certificates (enrollment_id, user_id, certificate_number, student_name, course_title, certificate_title, completion_date, issued_by, reissued_from)
  values (cert.enrollment_id, cert.user_id, v_number, coalesce(nullif(trim(p_student_name), ''), cert.student_name), cert.course_title, cert.certificate_title, cert.completion_date, auth.uid(), cert.id)
  returning id into v_id;
  perform public.fn_audit('certificate.reissued', 'certificate', v_id::text, cert.user_id, jsonb_build_object('from', cert.id, 'reason', p_reason));
  perform public.fn_notify(cert.user_id, 'certificate_issued', 'Your certificate has been reissued', 'Certificate ' || v_number || ' replaces ' || cert.certificate_number || '.', '/app/certificate');
  return v_id;
end $$;

-- PUBLIC verification: reveals only what a verifier needs. Callable anonymously.
create or replace function public.verify_certificate(p_number text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when c.id is null then jsonb_build_object('found', false)
    else jsonb_build_object(
      'found', true,
      'certificate_number', c.certificate_number,
      'student_name', c.student_name,
      'course_title', c.course_title,
      'certificate_title', c.certificate_title,
      'completion_date', c.completion_date,
      'issued_at', c.issued_at,
      'status', c.status,
      'revoked_at', c.revoked_at
    ) end
  from (select 1) s left join public.certificates c on upper(trim(c.certificate_number)) = upper(trim(p_number));
$$;

-- ---------------------------------------------------------------------------
-- Identity verification
-- ---------------------------------------------------------------------------
create or replace function public.submit_identity(
  p_doc_type public.identity_doc_type, p_id_number text, p_full_name text, p_issuing_country text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; p record;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not p_consent then raise exception 'consent is required' using errcode = '22023'; end if;
  select * into p from public.profiles where id = auth.uid();
  if p.nationality = 'ugandan' and p_doc_type <> 'national_id' then raise exception 'Ugandan students must provide a National ID (NIN)' using errcode = '22023'; end if;
  if p.nationality = 'international' and p_doc_type = 'national_id' then raise exception 'Non-Ugandan students must provide a passport or other approved identification' using errcode = '22023'; end if;
  if length(regexp_replace(p_id_number, '\s', '', 'g')) < 5 or length(p_id_number) > 40 then raise exception 'invalid identification number' using errcode = '22023'; end if;
  if p_doc_type = 'national_id' and upper(regexp_replace(p_id_number, '\s', '', 'g')) !~ '^[A-Z0-9]{14}$' then raise exception 'A Ugandan NIN has 14 characters' using errcode = '22023'; end if;
  if exists (select 1 from public.identity_verifications where user_id = auth.uid() and status in ('pending', 'verified')) then
    raise exception 'identity already submitted' using errcode = '23505';
  end if;
  insert into public.identity_verifications (user_id, doc_type, id_number, full_name_on_document, issuing_country, status)
  values (auth.uid(), p_doc_type, upper(regexp_replace(p_id_number, '\s', '', 'g')), trim(p_full_name), trim(p_issuing_country), 'pending')
  on conflict (user_id) do update set doc_type = excluded.doc_type, id_number = excluded.id_number, full_name_on_document = excluded.full_name_on_document,
    issuing_country = excluded.issuing_country, status = 'pending', submitted_at = now(), reviewed_by = null, reviewed_at = null, rejection_reason = null, consent_given_at = now()
  returning id into v_id;
  perform public.fn_audit('identity.submitted', 'identity_verification', v_id::text, auth.uid(), jsonb_build_object('doc_type', p_doc_type));
  return v_id;
end $$;

create or replace function public.register_identity_document(p_storage_path text, p_file_name text, p_mime text, p_size int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ver uuid; v_id uuid;
begin
  select id into v_ver from public.identity_verifications where user_id = auth.uid();
  if v_ver is null then raise exception 'submit identification details first' using errcode = 'P0001'; end if;
  if p_storage_path not like 'identity-documents/' || auth.uid()::text || '/%' then raise exception 'invalid path' using errcode = '22023'; end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then raise exception 'file type not allowed' using errcode = '22023'; end if;
  if p_size <= 0 or p_size > 10 * 1024 * 1024 then raise exception 'file too large (max 10 MB)' using errcode = '22023'; end if;
  insert into public.identity_documents (verification_id, user_id, storage_path, file_name, mime_type, size_bytes)
  values (v_ver, auth.uid(), p_storage_path, p_file_name, p_mime, p_size) returning id into v_id;
  perform public.fn_audit('identity.document_uploaded', 'identity_document', v_id::text, auth.uid());
  return v_id;
end $$;

create or replace function public.review_identity(p_verification_id uuid, p_decision public.identity_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'invalid decision' using errcode = '22023'; end if;
  select * into v from public.identity_verifications where id = p_verification_id;
  if v.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.identity_verifications set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = case when p_decision = 'rejected' then p_reason end where id = v.id;
  perform public.fn_audit('identity.' || p_decision::text, 'identity_verification', v.id::text, v.user_id, jsonb_build_object('reason', p_reason));
  if p_decision = 'verified' then
    perform public.fn_notify(v.user_id, 'identity_verified', 'Identity verified', 'Your identification has been verified.', '/app/profile');
  else
    perform public.fn_notify(v.user_id, 'identity_rejected', 'Identification needs resubmission', coalesce(p_reason, 'Please resubmit your identification.'), '/app/profile');
  end if;
end $$;

-- Retention: admins may purge identity documents (e.g. after verification or on request).
create or replace function public.delete_identity_document(p_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from public.identity_documents where id = p_document_id;
  if d.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if not (public.is_admin() or (d.user_id = auth.uid() and exists (select 1 from public.identity_verifications where id = d.verification_id and status in ('pending', 'rejected')))) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  update public.identity_documents set deleted_at = now() where id = d.id;
  perform public.fn_audit('identity.document_deleted', 'identity_document', d.id::text, d.user_id);
end $$;

-- ---------------------------------------------------------------------------
-- Discussions moderation + reports
-- ---------------------------------------------------------------------------
create or replace function public.moderate_discussion(p_thread_id uuid default null, p_post_id uuid default null, p_hidden boolean default true, p_pinned boolean default null, p_locked boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  if p_thread_id is not null then
    select course_id into v_course from public.discussion_threads where id = p_thread_id;
  else
    select t.course_id into v_course from public.discussion_posts p join public.discussion_threads t on t.id = p.thread_id where p.id = p_post_id;
  end if;
  if not (public.is_admin() or public.trainer_assigned_to_course(v_course)) then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_thread_id is not null then
    update public.discussion_threads set is_hidden = coalesce(p_hidden, is_hidden), hidden_by = case when p_hidden then auth.uid() end,
      is_pinned = coalesce(p_pinned, is_pinned), is_locked = coalesce(p_locked, is_locked) where id = p_thread_id;
    perform public.fn_audit('discussion.thread_moderated', 'discussion_thread', p_thread_id::text, null, jsonb_build_object('hidden', p_hidden, 'pinned', p_pinned, 'locked', p_locked));
  else
    update public.discussion_posts set is_hidden = coalesce(p_hidden, is_hidden), hidden_by = case when p_hidden then auth.uid() end where id = p_post_id;
    perform public.fn_audit('discussion.post_moderated', 'discussion_post', p_post_id::text, null, jsonb_build_object('hidden', p_hidden));
  end if;
  update public.discussion_reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now()
  where status = 'open' and ((p_thread_id is not null and thread_id = p_thread_id) or (p_post_id is not null and post_id = p_post_id));
end $$;

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create or replace function public.update_ticket_status(p_ticket_id uuid, p_status public.ticket_status)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.support_tickets where id = p_ticket_id;
  if t.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if not (public.is_staff() or (t.user_id = auth.uid() and p_status = 'resolved')) then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.support_tickets set status = p_status, resolved_at = case when p_status = 'resolved' then now() end, assigned_to = case when public.is_staff() then coalesce(assigned_to, auth.uid()) else assigned_to end where id = t.id;
end $$;

-- Staff reply trigger → notify student
create or replace function public.tg_support_message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if new.is_staff and new.author_id <> t.user_id then
    perform public.fn_notify(t.user_id, 'support_response', 'MCSLI replied to your support request', left(new.body, 140), '/app/help');
    update public.support_tickets set status = case when status = 'open' then 'in_progress' else status end, updated_at = now() where id = t.id;
  else
    update public.support_tickets set updated_at = now() where id = t.id;
  end if;
  return new;
end $$;
drop trigger if exists support_message_notify on public.support_messages;
create trigger support_message_notify after insert on public.support_messages for each row execute function public.tg_support_message_notify();

-- Discussion reply trigger → notify thread author
create or replace function public.tg_discussion_reply_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.discussion_threads where id = new.thread_id;
  if t.author_id <> new.author_id then
    perform public.fn_notify(t.author_id, 'discussion_reply', 'New reply: ' || left(t.title, 80), left(new.body, 140), '/app/discussions/' || t.id);
  end if;
  return new;
end $$;
drop trigger if exists discussion_reply_notify on public.discussion_posts;
create trigger discussion_reply_notify after insert on public.discussion_posts for each row execute function public.tg_discussion_reply_notify();

-- Announcement trigger → notify enrolled students
create or replace function public.tg_announcement_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.is_announcement then
    for r in select user_id from public.enrollments where course_id = new.course_id and status in ('active', 'completed') loop
      perform public.fn_notify(r.user_id, 'trainer_announcement', 'Announcement: ' || left(new.title, 80), left(new.body, 140), '/app/discussions/' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists announcement_notify on public.discussion_threads;
create trigger announcement_notify after insert on public.discussion_threads for each row execute function public.tg_announcement_notify();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v = row_count; return v;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: site content + settings with audit
-- ---------------------------------------------------------------------------
create or replace function public.set_site_content(p_key text, p_value jsonb, p_public boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.site_content (key, value, is_public, updated_by) values (p_key, p_value, p_public, auth.uid())
  on conflict (key) do update set value = excluded.value, is_public = excluded.is_public, updated_by = auth.uid(), updated_at = now();
  perform public.fn_audit('site_content.updated', 'site_content', p_key);
end $$;

create or replace function public.set_platform_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.fn_audit('platform_setting.updated', 'platform_setting', p_key);
end $$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor public.user_role := public.current_user_role();
begin
  if v_actor is null or v_actor not in ('ADMIN', 'SUPER_ADMIN') then raise exception 'not authorised' using errcode = '42501'; end if;
  if v_actor = 'ADMIN' and p_role in ('ADMIN', 'SUPER_ADMIN') then raise exception 'only a super admin can grant admin roles' using errcode = '42501'; end if;
  if v_actor = 'ADMIN' and exists (select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')) then
    raise exception 'only a super admin can change an admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then raise exception 'you cannot change your own role' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = p_user_id;
end $$;

create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'you cannot suspend yourself' using errcode = '42501'; end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  perform public.fn_audit('profile.status_changed', 'profile', p_user_id::text, p_user_id, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_set_enrollment_status(p_enrollment_id uuid, p_status public.enrollment_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  update public.enrollments set status = p_status, activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end where id = p_enrollment_id;
  perform public.fn_audit('enrollment.status_changed', 'enrollment', p_enrollment_id::text, (select user_id from public.enrollments where id = p_enrollment_id), jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Dashboards
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_students', (select count(*) from public.profiles where role = 'STUDENT'),
    'active_students', (select count(distinct user_id) from public.enrollments where status = 'active'),
    'pending_identity', (select count(*) from public.identity_verifications where status = 'pending'),
    'pending_payments', (select count(*) from public.payments where status in ('pending', 'under_review')),
    'upcoming_assessments', (select count(*) from public.assessments where status = 'scheduled' and (scheduled_at is null or scheduled_at >= now())),
    'assessments_awaiting_results', (select count(*) from public.assessments where status = 'scheduled'),
    'students_blocked_by_payment', (
      select count(*) from public.enrollments e where e.status in ('active', 'pending_payment') and exists (
        select 1 from jsonb_array_elements(public.fn_month_access(e.id, greatest(1, coalesce((select max(m.month_number) + 1 from public.assessment_attempts aa join public.course_months m on m.id = aa.month_id where aa.enrollment_id = e.id and aa.result = 'pass'), 1)))->'reasons') r
        where r->>'code' in ('registration_fee_unconfirmed', 'tuition_unconfirmed', 'installment_unconfirmed'))),
    'students_blocked_by_assessment', (
      select count(*) from public.enrollments e where e.status = 'active' and exists (
        select 1 from public.assessment_attempts aa where aa.enrollment_id = e.id and aa.result = 'not_passed'
          and aa.attempt_number = (select max(attempt_number) from public.assessment_attempts where enrollment_id = e.id and month_id = aa.month_id))),
    'certificates_issued', (select count(*) from public.certificates where status = 'issued'),
    'open_tickets', (select count(*) from public.support_tickets where status <> 'resolved'),
    'open_reports', (select count(*) from public.discussion_reports where status = 'open'),
    'new_messages', (select count(*) from public.contact_messages where status = 'new')
  );
end $$;

create or replace function public.trainer_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'not authorised' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students', (select count(distinct e.id) from public.enrollments e where e.status = 'active' and public.can_manage_enrollment(e.id)),
    'pending_assessments', (select count(*) from public.assessments a where a.status = 'scheduled' and not a.is_reassessment and public.can_manage_enrollment(a.enrollment_id)),
    'reassessments', (select count(*) from public.assessments a where a.status = 'scheduled' and a.is_reassessment and public.can_manage_enrollment(a.enrollment_id)),
    'pending_grading', (select count(*) from public.exam_attempts ea where ea.status = 'submitted' and public.can_manage_enrollment(ea.enrollment_id)),
    'open_reports', (select count(*) from public.discussion_reports r join public.discussion_threads t on t.id = coalesce(r.thread_id, (select thread_id from public.discussion_posts where id = r.post_id)) where r.status = 'open' and (public.is_admin() or public.trainer_assigned_to_course(t.course_id)))
  );
end $$;
