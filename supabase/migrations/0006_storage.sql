-- MCSLI Learning Platform – 0006: storage buckets and object policies
-- ALL buckets are private. Files are reached through short-lived signed URLs only.
--   identity-documents/<user_id>/<file>   – ID/passport scans (10 MB, images/pdf)
--   payment-proofs/<user_id>/<file>       – receipts (10 MB, images/pdf)
--   course-media/**                        – lesson & practice videos, captions (admin upload)
--   lesson-resources/**                    – downloadable handouts (admin upload)
--   certificates/<user_id>/<file>          – generated PDFs (optional cache)
--   avatars/<user_id>/<file>               – profile pictures (2 MB, images)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('identity-documents', 'identity-documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('course-media', 'course-media', false, 2147483648, null),
  ('lesson-resources', 'lesson-resources', false, 52428800, null),
  ('certificates', 'certificates', false, 5242880, array['application/pdf']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- helper: first path segment must equal the caller's uid
create or replace function public.storage_path_owner(p_name text) returns boolean
language sql immutable as $$
  select split_part(p_name, '/', 1) = auth.uid()::text;
$$;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'mcsli_%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- identity-documents: owner may upload/read/delete own files; admins may read (audited via Edge Function) and delete
create policy mcsli_identity_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'identity-documents' and public.storage_path_owner(name));
create policy mcsli_identity_select on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and (public.storage_path_owner(name) or public.is_admin()));
create policy mcsli_identity_delete on storage.objects for delete to authenticated
  using (bucket_id = 'identity-documents' and (public.storage_path_owner(name) or public.is_admin()));

-- payment-proofs
create policy mcsli_proof_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and public.storage_path_owner(name));
create policy mcsli_proof_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (public.storage_path_owner(name) or public.is_admin()));

-- course-media: students may read objects referenced by a lesson/practice item they can access; staff read all; admins write
create policy mcsli_media_select on storage.objects for select to authenticated
  using (bucket_id = 'course-media' and (
    public.is_staff()
    or exists (select 1 from public.lessons l where (l.video_path = name or l.captions_path = name) and public.fn_student_can_access_lesson(l.id))
    or exists (select 1 from public.practice_items p where p.video_path = name and p.is_published and public.fn_student_can_access_month(p.month_id))
    or exists (select 1 from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id where q.video_path = name and z.is_published and public.fn_student_can_access_month(z.month_id))
    or exists (select 1 from public.exam_questions q join public.exam_attempts ea on ea.exam_id = q.exam_id where q.video_path = name and public.owns_enrollment(ea.enrollment_id))
  ));
create policy mcsli_media_write on storage.objects for all to authenticated
  using (bucket_id = 'course-media' and public.is_admin()) with check (bucket_id = 'course-media' and public.is_admin());

-- lesson-resources
create policy mcsli_resources_select on storage.objects for select to authenticated
  using (bucket_id = 'lesson-resources' and (
    public.is_staff()
    or exists (select 1 from public.lesson_resources r where r.storage_path = name and r.is_downloadable and public.fn_student_can_access_lesson(r.lesson_id))
  ));
create policy mcsli_resources_write on storage.objects for all to authenticated
  using (bucket_id = 'lesson-resources' and public.is_admin()) with check (bucket_id = 'lesson-resources' and public.is_admin());

-- certificates (optional cached PDFs)
create policy mcsli_cert_select on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and (public.storage_path_owner(name) or public.is_staff()));
create policy mcsli_cert_write on storage.objects for all to authenticated
  using (bucket_id = 'certificates' and public.is_admin()) with check (bucket_id = 'certificates' and public.is_admin());

-- avatars
create policy mcsli_avatar_all on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (public.storage_path_owner(name) or public.is_admin()))
  with check (bucket_id = 'avatars' and public.storage_path_owner(name));
create policy mcsli_avatar_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
