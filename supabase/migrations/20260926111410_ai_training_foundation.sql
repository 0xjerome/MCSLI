-- MCSLI AI training foundation
-- Applied to production as Supabase migration 20260926111410.
-- Media uploads are only queued as candidates. No automatic training occurs.
-- A training asset cannot be approved until consent, rights and quality are explicitly confirmed.

create table if not exists public.ai_training_assets (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('lesson','practice')),
  lesson_id uuid references public.lessons(id) on delete cascade,
  practice_item_id uuid references public.practice_items(id) on delete cascade,
  label text not null,
  sign_language text not null default 'Ugandan Sign Language',
  media_ref text not null,
  active boolean not null default true,
  signer_consent_confirmed boolean not null default false,
  training_rights_confirmed boolean not null default false,
  quality_status text not null default 'pending' check (quality_status in ('pending','approved','rejected')),
  training_approved boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lesson_id is not null)::int + (practice_item_id is not null)::int = 1),
  check (
    not training_approved
    or (active and signer_consent_confirmed and training_rights_confirmed and quality_status = 'approved')
  )
);

create unique index if not exists ai_training_assets_lesson_uq
  on public.ai_training_assets(lesson_id) where lesson_id is not null;
create unique index if not exists ai_training_assets_practice_uq
  on public.ai_training_assets(practice_item_id) where practice_item_id is not null;
create index if not exists ai_training_assets_review_idx
  on public.ai_training_assets(training_approved, quality_status, active);

alter table public.ai_training_assets enable row level security;
revoke all on public.ai_training_assets from public, anon, authenticated;
grant select, insert, update, delete on public.ai_training_assets to authenticated;

drop policy if exists ai_training_assets_admin_select on public.ai_training_assets;
create policy ai_training_assets_admin_select on public.ai_training_assets
for select to authenticated using (public.is_admin());

drop policy if exists ai_training_assets_admin_insert on public.ai_training_assets;
create policy ai_training_assets_admin_insert on public.ai_training_assets
for insert to authenticated with check (public.is_admin());

drop policy if exists ai_training_assets_admin_update on public.ai_training_assets;
create policy ai_training_assets_admin_update on public.ai_training_assets
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists ai_training_assets_admin_delete on public.ai_training_assets;
create policy ai_training_assets_admin_delete on public.ai_training_assets
for delete to authenticated using (public.is_admin());

create table if not exists public.ai_training_annotations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.ai_training_assets(id) on delete cascade,
  annotation_type text not null,
  value text not null,
  start_ms integer,
  end_ms integer,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_ms is null or start_ms >= 0),
  check (end_ms is null or end_ms >= 0),
  check (start_ms is null or end_ms is null or end_ms >= start_ms)
);

create index if not exists ai_training_annotations_asset_idx
  on public.ai_training_annotations(asset_id, status);

alter table public.ai_training_annotations enable row level security;
revoke all on public.ai_training_annotations from public, anon, authenticated;
grant select, insert, update, delete on public.ai_training_annotations to authenticated;

drop policy if exists ai_training_annotations_admin_all on public.ai_training_annotations;
create policy ai_training_annotations_admin_all on public.ai_training_annotations
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.ai_model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  task text not null check (task in ('isolated_sign_recognition','continuous_sign_recognition','sign_retrieval','sign_generation','content_assistant')),
  status text not null default 'draft' check (status in ('draft','evaluating','approved','retired')),
  dataset_snapshot_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  artifact_uri text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, version)
);

alter table public.ai_model_versions enable row level security;
revoke all on public.ai_model_versions from public, anon, authenticated;
grant select on public.ai_model_versions to authenticated;
grant insert, update, delete on public.ai_model_versions to authenticated;

drop policy if exists ai_model_versions_admin_select on public.ai_model_versions;
create policy ai_model_versions_admin_select on public.ai_model_versions
for select to authenticated using (public.is_admin());

drop policy if exists ai_model_versions_super_write on public.ai_model_versions;
create policy ai_model_versions_super_write on public.ai_model_versions
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create or replace function private.sync_ai_training_asset()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_media text;
  v_kind text;
begin
  v_kind := case when TG_TABLE_NAME = 'lessons' then 'lesson' else 'practice' end;
  v_media := coalesce(nullif(NEW.video_path,''), nullif(NEW.video_url,''));

  if v_kind = 'lesson' then
    if v_media is null then
      update public.ai_training_assets
      set active = false, training_approved = false, updated_at = now()
      where lesson_id = NEW.id;
      return NEW;
    end if;

    insert into public.ai_training_assets
      (source_kind, lesson_id, label, media_ref, active, created_by)
    values
      ('lesson', NEW.id, NEW.title, v_media, true, auth.uid())
    on conflict (lesson_id) where lesson_id is not null
    do update set
      label = excluded.label,
      media_ref = excluded.media_ref,
      active = true,
      signer_consent_confirmed = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.signer_consent_confirmed end,
      training_rights_confirmed = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.training_rights_confirmed end,
      quality_status = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then 'pending' else public.ai_training_assets.quality_status end,
      training_approved = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.training_approved end,
      reviewed_by = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then null else public.ai_training_assets.reviewed_by end,
      updated_at = now();
  else
    if v_media is null then
      update public.ai_training_assets
      set active = false, training_approved = false, updated_at = now()
      where practice_item_id = NEW.id;
      return NEW;
    end if;

    insert into public.ai_training_assets
      (source_kind, practice_item_id, label, media_ref, active, created_by)
    values
      ('practice', NEW.id, NEW.title, v_media, true, auth.uid())
    on conflict (practice_item_id) where practice_item_id is not null
    do update set
      label = excluded.label,
      media_ref = excluded.media_ref,
      active = true,
      signer_consent_confirmed = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.signer_consent_confirmed end,
      training_rights_confirmed = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.training_rights_confirmed end,
      quality_status = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then 'pending' else public.ai_training_assets.quality_status end,
      training_approved = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then false else public.ai_training_assets.training_approved end,
      reviewed_by = case when public.ai_training_assets.media_ref is distinct from excluded.media_ref then null else public.ai_training_assets.reviewed_by end,
      updated_at = now();
  end if;
  return NEW;
end
$$;

revoke all on function private.sync_ai_training_asset() from public, anon, authenticated;

drop trigger if exists lessons_ai_training_sync on public.lessons;
create trigger lessons_ai_training_sync
after insert or update of title, video_path, video_url on public.lessons
for each row execute function private.sync_ai_training_asset();

drop trigger if exists practice_ai_training_sync on public.practice_items;
create trigger practice_ai_training_sync
after insert or update of title, video_path, video_url on public.practice_items
for each row execute function private.sync_ai_training_asset();

insert into public.ai_training_assets (source_kind, lesson_id, label, media_ref, active)
select 'lesson', l.id, l.title, coalesce(nullif(l.video_path,''), nullif(l.video_url,'')), true
from public.lessons l
where coalesce(nullif(l.video_path,''), nullif(l.video_url,'')) is not null
on conflict (lesson_id) where lesson_id is not null
do update set label=excluded.label, media_ref=excluded.media_ref, active=true, updated_at=now();

insert into public.ai_training_assets (source_kind, practice_item_id, label, media_ref, active)
select 'practice', p.id, p.title, coalesce(nullif(p.video_path,''), nullif(p.video_url,'')), true
from public.practice_items p
where coalesce(nullif(p.video_path,''), nullif(p.video_url,'')) is not null
on conflict (practice_item_id) where practice_item_id is not null
do update set label=excluded.label, media_ref=excluded.media_ref, active=true, updated_at=now();

comment on table public.ai_training_assets is
  'Candidate MCSLI-owned media for future AI training. Uploading media only queues it; training_approved requires explicit consent, rights confirmation and quality approval.';
comment on table public.ai_training_annotations is
  'Human-reviewed annotations for AI training assets. No automatic self-training is performed from these rows.';
comment on table public.ai_model_versions is
  'Registry of evaluated AI model versions. A model must be explicitly approved before production use.';
