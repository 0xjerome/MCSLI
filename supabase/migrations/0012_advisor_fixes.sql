-- MCSLI Learning Platform – 0012: Supabase security-advisor follow-ups (hosted project, 2026-09-25)
-- Re-runnable; no data changes.

-- function_search_path_mutable: pin search_path on the remaining helpers
alter function public.storage_path_owner(text) set search_path = public;
alter function public.tg_set_updated_at() set search_path = public;
alter function public.mask_identifier(text) set search_path = public;
alter function public.fn_generate_certificate_number() set search_path = public;
alter function public.tg_audit_append_only() set search_path = public;
alter function public.fn_exam_is_open(public.exams) set search_path = public;

-- Trigger functions created after the 0008 EXECUTE whitelist kept Supabase's default grants.
-- They cannot be invoked directly anyway, but nothing outside the whitelist should be exposed.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Intentional SECURITY DEFINER views (advisor lint 0010), documented so reviewers do not "fix" them:
comment on view public.identity_summary is 'SECURITY DEFINER by design: identity_verifications has no SELECT for API roles; this view returns only the masked number, filtered to auth.uid() or admins.';
comment on view public.public_profiles is 'SECURITY DEFINER by design: name/role/avatar only, filtered to self, staff, classmates and managed students; profiles itself stays private.';
comment on view public.exam_attempts_student is 'SECURITY DEFINER by design: own attempts only; scores and feedback masked until results_released_at.';
comment on view public.site_content_public is 'SECURITY DEFINER by design: public website content with unverified impact statistics removed.';
