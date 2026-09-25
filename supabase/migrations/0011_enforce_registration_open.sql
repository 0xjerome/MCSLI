-- MCSLI Learning Platform – 0011: enforce the "Registration open" platform setting server-side.
-- Admin → Settings promises "When off, new accounts cannot enroll"; previously only a hint.
-- Existing enrollments are unaffected. Re-runnable.

create or replace function public.enroll_in_course(p_course_id uuid, p_plan public.payment_plan_type, p_cohort_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; c record; v_id uuid; v_tuition numeric;
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
  if p_cohort_id is not null and not exists (select 1 from public.cohorts where id = p_cohort_id and course_id = c.id and is_open) then
    raise exception 'cohort not open' using errcode = 'P0001';
  end if;
  -- price comes from the course and the student's nationality – never from the client
  v_tuition := case when p.nationality = 'ugandan' then c.tuition_national else c.tuition_international end;
  insert into public.enrollments (user_id, course_id, cohort_id, plan_type, nationality, currency, registration_fee, tuition_amount, installments)
  values (p.id, c.id, p_cohort_id, p_plan, p.nationality, c.currency, c.registration_fee, v_tuition, public.fn_build_installments(c.id, p.nationality, p_plan))
  returning id into v_id;
  perform public.fn_audit('enrollment.created', 'enrollment', v_id::text, p.id, jsonb_build_object('course_id', c.id, 'plan', p_plan, 'tuition', v_tuition));
  return v_id;
end $$;

revoke execute on function public.enroll_in_course(uuid, public.payment_plan_type, uuid) from public, anon;
grant execute on function public.enroll_in_course(uuid, public.payment_plan_type, uuid) to authenticated, service_role;
