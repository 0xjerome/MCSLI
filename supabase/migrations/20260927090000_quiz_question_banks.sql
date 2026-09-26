-- MCSLI Learning Platform – 20260927090000: randomized quiz question banks
-- Re-runnable. Existing questions/attempts are preserved (existing questions become "approved",
-- existing attempts become "submitted" and keep their answers/score).
--
-- Architecture
--   quiz → approved question bank (quiz_questions.status = 'approved') → server-selected question
--   set per attempt, snapshotted in quiz_attempt_questions (prompt, shuffled options, correct
--   answer, points, version). Grading and review read the snapshot only, so editing or retiring a
--   question later never changes an existing attempt, and a page refresh returns the same questions
--   in the same order.
--
--   Blueprint (quizzes): questions_per_attempt (null = every approved question, the previous
--   behaviour), randomize_questions, randomize_options, avoid_recent_questions,
--   blueprint = {"topics": {"Alphabet": 3, …}, "difficulty": {"easy": 4, …}} – quotas that every
--   attempt satisfies; slots left over are filled at random from the approved pool.
--
--   Question metadata: topic, difficulty, learning_objective, lesson_id, practice_item_id,
--   status (draft | approved | rejected | retired), source (instructor | ai_draft | imported),
--   created_by, reviewed_by/at, version (bumped when grading-critical fields change).
--   Only 'approved' questions can be selected. AI drafts (quiz_generation_runs) and imports are
--   always created as 'draft' and need a human decision (review_quiz_question).
--
--   Students never read quiz_questions directly any more: questions reach them only inside their
--   own attempt (start_quiz_attempt / get_quiz_attempt) or through practice mode
--   (practice_questions), which serves approved questions of unlocked months one batch at a time.

-- ---------------------------------------------------------------------------
-- 1. Question metadata
-- ---------------------------------------------------------------------------
alter table public.quiz_questions
  add column if not exists topic text,
  add column if not exists difficulty text not null default 'medium',
  add column if not exists status text not null default 'approved',
  add column if not exists source text not null default 'instructor',
  add column if not exists learning_objective text,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists practice_item_id uuid references public.practice_items(id) on delete set null,
  add column if not exists allow_practice boolean not null default true,
  add column if not exists version integer not null default 1,
  add column if not exists generation_id uuid,
  add column if not exists review_note text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.quiz_questions add constraint quiz_questions_difficulty_check check (difficulty in ('easy', 'medium', 'hard'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quiz_questions add constraint quiz_questions_status_check check (status in ('draft', 'approved', 'rejected', 'retired'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quiz_questions add constraint quiz_questions_source_check check (source in ('instructor', 'ai_draft', 'imported'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quiz_questions add constraint quiz_questions_topic_len check (topic is null or length(topic) between 1 and 60);
exception when duplicate_object then null; end $$;

create index if not exists quiz_questions_bank_idx on public.quiz_questions (quiz_id, status, topic, difficulty);
create index if not exists quiz_questions_generation_idx on public.quiz_questions (generation_id) where generation_id is not null;

drop trigger if exists set_updated_at on public.quiz_questions;
create trigger set_updated_at before update on public.quiz_questions for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Quiz blueprint
-- ---------------------------------------------------------------------------
alter table public.quizzes
  add column if not exists questions_per_attempt integer check (questions_per_attempt is null or questions_per_attempt between 1 and 100),
  add column if not exists randomize_questions boolean not null default true,
  add column if not exists randomize_options boolean not null default true,
  add column if not exists avoid_recent_questions boolean not null default true,
  add column if not exists blueprint jsonb not null default '{}'::jsonb,
  add column if not exists reveal_policy text not null default 'after_pass_or_final',
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.quizzes add constraint quizzes_reveal_policy_check check (reveal_policy in ('after_pass_or_final', 'always', 'never'));
exception when duplicate_object then null; end $$;
-- New quizzes start unpublished: the publish checklist needs approved questions first.
alter table public.quizzes alter column is_published set default false;
drop trigger if exists set_updated_at on public.quizzes;
create trigger set_updated_at before update on public.quizzes for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Attempts: lifecycle + snapshot
-- ---------------------------------------------------------------------------
alter table public.quiz_attempts
  add column if not exists status text not null default 'submitted',
  add column if not exists quiz_version integer,
  add column if not exists total_points integer,
  add column if not exists earned_points integer,
  add column if not exists bank_snapshot_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.quiz_attempts add constraint quiz_attempts_status_check check (status in ('in_progress', 'submitted'));
exception when duplicate_object then null; end $$;
alter table public.quiz_attempts alter column score drop not null;
alter table public.quiz_attempts alter column passed drop not null;
alter table public.quiz_attempts alter column submitted_at drop not null;
alter table public.quiz_attempts alter column submitted_at drop default;
create index if not exists quiz_attempts_lookup_idx on public.quiz_attempts (enrollment_id, quiz_id, attempt_number desc);
drop trigger if exists set_updated_at on public.quiz_attempts;
create trigger set_updated_at before update on public.quiz_attempts for each row execute function public.tg_set_updated_at();

create table if not exists public.quiz_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  position integer not null,
  question_id uuid references public.quiz_questions(id) on delete set null,
  question_version integer not null default 1,
  question_type public.question_type not null,
  prompt text not null,
  video_path text,
  video_url text,
  options jsonb not null,            -- in the order shown to this student (shuffled when enabled)
  correct_answer jsonb not null,     -- stable option ids, never positions
  explanation text,
  points integer not null,
  topic text,
  difficulty text,
  answer jsonb,
  is_correct boolean,
  unique (attempt_id, position)
);
create index if not exists quiz_attempt_questions_question_idx on public.quiz_attempt_questions (question_id);
alter table public.quiz_attempt_questions enable row level security;
revoke all on public.quiz_attempt_questions from public, anon, authenticated;
grant select on public.quiz_attempt_questions to authenticated;
drop policy if exists quiz_attempt_questions_staff on public.quiz_attempt_questions;
create policy quiz_attempt_questions_staff on public.quiz_attempt_questions for select
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and public.can_manage_enrollment(a.enrollment_id)));
-- students read their snapshot only through get_quiz_attempt() (no correct answers before permitted)

-- ---------------------------------------------------------------------------
-- 4. AI draft generation runs (operational metadata only – never model reasoning)
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_generation_runs (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  requested_count integer not null check (requested_count between 1 and 20),
  difficulty_mix jsonb not null default '{}'::jsonb,
  source_lesson_ids uuid[] not null default '{}',
  source_practice_ids uuid[] not null default '{}',
  provider text,
  model text,
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed', 'not_configured', 'insufficient_material')),
  generated_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists quiz_generation_runs_quiz_idx on public.quiz_generation_runs (quiz_id, created_at desc);
alter table public.quiz_generation_runs enable row level security;
revoke all on public.quiz_generation_runs from public, anon, authenticated;
grant select on public.quiz_generation_runs to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Practice mode events (low stakes; adaptive-learning foundation)
-- ---------------------------------------------------------------------------
create table if not exists public.practice_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  question_id uuid references public.quiz_questions(id) on delete set null,
  topic text,
  difficulty text,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists practice_events_enrollment_idx on public.practice_events (enrollment_id, created_at desc);
alter table public.practice_events enable row level security;
revoke all on public.practice_events from public, anon, authenticated;
grant select on public.practice_events to authenticated;
drop policy if exists practice_events_select on public.practice_events;
create policy practice_events_select on public.practice_events for select
  using (public.owns_enrollment(enrollment_id) or public.can_manage_enrollment(enrollment_id));

-- ---------------------------------------------------------------------------
-- 6. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_edit_quiz(p_quiz_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_trainer() and public.trainer_assigned_to_course(
    (select m.course_id from public.quizzes q join public.course_months m on m.id = q.month_id where q.id = p_quiz_id)));
$$;

create or replace function private.jsonb_shuffle(p jsonb) returns jsonb
language sql volatile set search_path = '' as $$
  select coalesce((select jsonb_agg(e order by random()) from jsonb_array_elements(p) e), '[]'::jsonb);
$$;

-- Validate one question's content (used for drafts, imports and the publish checklist).
create or replace function private.question_problems(p_type public.question_type, p_options jsonb, p_correct jsonb, p_points int, p_video text)
returns text[] language plpgsql immutable set search_path = '' as $$
declare v text[] := '{}'; ids text[]; l text[]; r text[]; k text;
begin
  if p_points is null or p_points < 1 or p_points > 100 then v := array_append(v, 'points must be 1–100'); end if;
  if p_type in ('multiple_choice', 'video_multiple_choice') then
    if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options) > 8 then
      v := array_append(v, 'needs 2–8 answer options');
    else
      select array_agg(o->>'id') into ids from jsonb_array_elements(p_options) o;
      if exists (select 1 from jsonb_array_elements(p_options) o where coalesce(o->>'id', '') = '' or coalesce(trim(o->>'text'), '') = '') then v := array_append(v, 'every option needs an id and text'); end if;
      if (select count(distinct x) from unnest(ids) x) <> array_length(ids, 1) then v := array_append(v, 'option ids must be unique'); end if;
      if jsonb_typeof(p_correct) <> 'string' or not ((p_correct #>> '{}') = any(ids)) then v := array_append(v, 'the correct answer must be one of the option ids'); end if;
    end if;
    if p_type = 'video_multiple_choice' and coalesce(p_video, '') = '' then v := array_append(v, 'a video question needs a video'); end if;
  elsif p_type = 'matching' then
    if jsonb_typeof(p_options) <> 'object' or jsonb_typeof(p_options->'left') <> 'array' or jsonb_typeof(p_options->'right') <> 'array'
       or jsonb_array_length(p_options->'left') < 2 or jsonb_array_length(p_options->'right') < 2 then
      v := array_append(v, 'matching needs at least two items on each side');
    else
      select array_agg(o->>'id') into l from jsonb_array_elements(p_options->'left') o;
      select array_agg(o->>'id') into r from jsonb_array_elements(p_options->'right') o;
      if jsonb_typeof(p_correct) <> 'object' then
        v := array_append(v, 'matching answer must map every left item to a right item');
      else
        for k in select unnest(l) loop
          if not ((p_correct->>k) = any(r)) then v := v || format('no valid match for item "%s"', k); exit; end if;
        end loop;
      end if;
    end if;
  else
    v := array_append(v, 'quizzes are auto-graded: practical questions belong in examinations');
  end if;
  return v;
end $$;

-- Publish checklist for a quiz row (the trigger passes NEW so unsaved changes are validated;
-- returned to staff; enforced by trigger and by start_quiz_attempt).
create or replace function private.quiz_publish_problems(q public.quizzes) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v text[] := '{}'; approved int; r record; s int := 0; k text; need int; have int; pass int;
begin
  select count(*) into approved from public.quiz_questions where quiz_id = q.id and status = 'approved';
  pass := coalesce(q.passing_score, (select c.quiz_passing_score from public.courses c join public.course_months m on m.course_id = c.id where m.id = q.month_id));
  if pass is null or pass < 0 or pass > 100 then v := array_append(v, 'passing score must be 0–100'); end if;
  if approved = 0 then v := array_append(v, 'at least one approved question is required'); end if;
  if q.questions_per_attempt is not null and approved < q.questions_per_attempt then
    v := v || format('%s questions per attempt but only %s approved', q.questions_per_attempt, approved);
  end if;
  if jsonb_typeof(q.blueprint->'topics') = 'object' then
    for k, need in select key, value::int from jsonb_each_text(q.blueprint->'topics') loop
      s := s + need;
      select count(*) into have from public.quiz_questions where quiz_id = q.id and status = 'approved' and topic = k;
      if have < need then v := v || format('requires %s approved "%s" questions but only %s exist', need, k, have); end if;
    end loop;
    if q.questions_per_attempt is not null and s > q.questions_per_attempt then v := v || format('topic quotas add up to %s, more than %s questions per attempt', s, q.questions_per_attempt); end if;
  end if;
  s := 0;
  if jsonb_typeof(q.blueprint->'difficulty') = 'object' then
    for k, need in select key, value::int from jsonb_each_text(q.blueprint->'difficulty') loop
      s := s + need;
      if k not in ('easy', 'medium', 'hard') then v := v || format('unknown difficulty "%s"', k); continue; end if;
      select count(*) into have from public.quiz_questions where quiz_id = q.id and status = 'approved' and difficulty = k;
      if have < need then v := v || format('requires %s approved %s questions but only %s exist', need, k, have); end if;
    end loop;
    if q.questions_per_attempt is not null and s > q.questions_per_attempt then v := v || format('difficulty quotas add up to %s, more than %s questions per attempt', s, q.questions_per_attempt); end if;
  end if;
  for r in select id, position, question_type, options, correct_answer, points, coalesce(video_path, video_url) as video
           from public.quiz_questions where quiz_id = q.id and status = 'approved' loop
    if array_length(private.question_problems(r.question_type, r.options, r.correct_answer, r.points, r.video), 1) > 0 then
      v := v || format('question %s: %s', r.position, array_to_string(private.question_problems(r.question_type, r.options, r.correct_answer, r.points, r.video), ', '));
    end if;
  end loop;
  return v;
end $$;

create or replace function public.fn_quiz_publish_problems(p_quiz_id uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare q public.quizzes;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if q.id is null then return array['quiz not found']; end if;
  return private.quiz_publish_problems(q);
end $$;

create or replace function public.get_quiz_publish_problems(p_quiz_id uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  return public.fn_quiz_publish_problems(p_quiz_id);
end $$;

-- Publishing an invalid quiz is refused (direct sessions/migrations are trusted).
create or replace function public.tg_quiz_publish_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  -- PostgREST bulk inserts send NULL for keys missing from some rows; keep the column defaults
  new.randomize_questions := coalesce(new.randomize_questions, true);
  new.randomize_options := coalesce(new.randomize_options, true);
  new.avoid_recent_questions := coalesce(new.avoid_recent_questions, true);
  new.blueprint := coalesce(new.blueprint, '{}'::jsonb);
  new.reveal_policy := coalesce(new.reveal_policy, 'after_pass_or_final');
  new.version := coalesce(new.version, 1);
  new.is_published := coalesce(new.is_published, false);
  if auth.uid() is null then return new; end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published or new.questions_per_attempt is distinct from old.questions_per_attempt or new.blueprint is distinct from old.blueprint) then
    v := private.quiz_publish_problems(new);
    if tg_op = 'INSERT' then
      -- a brand-new quiz has no questions yet: create it unpublished, add approved questions, then publish
      if new.is_published then raise exception 'Create the quiz first, add approved questions, then publish it.' using errcode = 'P0001'; end if;
    elsif array_length(v, 1) > 0 then
      raise exception 'The quiz cannot be published yet: %', array_to_string(v, '; ') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists quiz_publish_check on public.quizzes;
create trigger quiz_publish_check before insert or update on public.quizzes for each row execute function public.tg_quiz_publish_check();

-- Blueprint history: version bump + audit when selection rules change.
create or replace function public.tg_quiz_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.questions_per_attempt is distinct from old.questions_per_attempt or new.blueprint is distinct from old.blueprint
     or new.randomize_questions is distinct from old.randomize_questions or new.randomize_options is distinct from old.randomize_options
     or new.avoid_recent_questions is distinct from old.avoid_recent_questions or new.reveal_policy is distinct from old.reveal_policy
     or new.passing_score is distinct from old.passing_score or new.max_attempts is distinct from old.max_attempts then
    new.version := old.version + 1;
    if auth.uid() is not null then
      perform public.fn_audit('quiz.blueprint_changed', 'quiz', new.id::text, null, jsonb_build_object(
        'version', new.version, 'questions_per_attempt', new.questions_per_attempt, 'blueprint', new.blueprint,
        'randomize_questions', new.randomize_questions, 'randomize_options', new.randomize_options,
        'avoid_recent_questions', new.avoid_recent_questions, 'reveal_policy', new.reveal_policy,
        'passing_score', new.passing_score, 'max_attempts', new.max_attempts));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists quiz_version on public.quizzes;
create trigger quiz_version before update on public.quizzes for each row execute function public.tg_quiz_version();

-- Question versioning + review bookkeeping + audit of status changes.
create or replace function public.tg_quiz_question_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- PostgREST bulk inserts send NULL for keys missing from some rows; keep the column defaults
    new.status := coalesce(new.status, 'approved');
    new.source := coalesce(new.source, 'instructor');
    new.difficulty := coalesce(new.difficulty, 'medium');
    new.allow_practice := coalesce(new.allow_practice, true);
    new.version := coalesce(new.version, 1);
    new.points := coalesce(new.points, 1);
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.status = 'approved' and new.reviewed_by is null then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
    return new;
  end if;
  if new.prompt is distinct from old.prompt or new.options is distinct from old.options or new.correct_answer is distinct from old.correct_answer
     or new.points is distinct from old.points or new.question_type is distinct from old.question_type
     or new.video_path is distinct from old.video_path or new.video_url is distinct from old.video_url then
    new.version := old.version + 1;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'approved' then new.reviewed_by := coalesce(auth.uid(), new.reviewed_by); new.reviewed_at := now(); end if;
    if auth.uid() is not null then
      perform public.fn_audit('quiz_question.' || new.status, 'quiz_question', new.id::text, null,
        jsonb_build_object('from', old.status, 'to', new.status, 'source', new.source, 'quiz_id', new.quiz_id, 'version', new.version, 'note', left(new.review_note, 200)));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists quiz_question_version on public.quiz_questions;
create trigger quiz_question_version before insert or update on public.quiz_questions for each row execute function public.tg_quiz_question_version();

-- Questions that appear in any attempt snapshot are retired, never deleted.
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
    v_has := exists (select 1 from public.quiz_attempt_questions where question_id = old.id);
  elsif tg_table_name = 'exams' then
    v_has := exists (select 1 from public.exam_attempts where exam_id = old.id);
  elsif tg_table_name = 'exam_questions' then
    v_has := exists (select 1 from public.exam_attempts where exam_id = old.exam_id);
  end if;
  if v_has and auth.uid() is not null then
    raise exception 'This item has student history and cannot be deleted. Retire or unpublish it instead.' using errcode = 'P0001';
  end if;
  return old;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Server-side selection (deterministic for a seed; testable)
-- ---------------------------------------------------------------------------
-- Returns the ids of the questions for one attempt, in presentation order.
create or replace function private.select_quiz_questions(p_quiz_id uuid, p_enrollment_id uuid, p_seed double precision)
returns uuid[] language plpgsql volatile security definer set search_path = public as $$
declare
  q record; n int; approved int; v_prev uuid[] := '{}'; v_sel uuid[] := '{}'; v_pick uuid;
  v_topics text[] := '{}'; v_diffs text[] := '{}'; i int; t text; d text;
begin
  perform setseed(greatest(-1, least(1, p_seed)));
  select * into q from public.quizzes where id = p_quiz_id;
  select count(*) into approved from public.quiz_questions where quiz_id = q.id and status = 'approved';
  if q.avoid_recent_questions and p_enrollment_id is not null then
    select coalesce(array_agg(aq.question_id), '{}') into v_prev
    from public.quiz_attempt_questions aq
    join public.quiz_attempts a on a.id = aq.attempt_id
    where a.enrollment_id = p_enrollment_id and a.quiz_id = q.id
      and a.attempt_number = (select max(attempt_number) from public.quiz_attempts where enrollment_id = p_enrollment_id and quiz_id = q.id);
  end if;

  if q.questions_per_attempt is null then
    -- every approved question (legacy fixed quiz), optionally in random order
    if q.randomize_questions then
      select coalesce(array_agg(id order by random()), '{}') into v_sel from public.quiz_questions where quiz_id = q.id and status = 'approved';
    else
      select coalesce(array_agg(id order by position, created_at), '{}') into v_sel from public.quiz_questions where quiz_id = q.id and status = 'approved';
    end if;
    return v_sel;
  end if;

  n := least(q.questions_per_attempt, approved);
  -- slots from the blueprint: topic quotas, then difficulty quotas paired index-wise after a shuffle
  if jsonb_typeof(q.blueprint->'topics') = 'object' then
    select coalesce(array_agg(key), '{}') into v_topics from jsonb_each_text(q.blueprint->'topics') e, generate_series(1, greatest(0, e.value::int));
  end if;
  if jsonb_typeof(q.blueprint->'difficulty') = 'object' then
    select coalesce(array_agg(key), '{}') into v_diffs from jsonb_each_text(q.blueprint->'difficulty') e, generate_series(1, greatest(0, e.value::int));
  end if;
  while coalesce(array_length(v_topics, 1), 0) < n loop v_topics := v_topics || null::text; end loop;
  while coalesce(array_length(v_diffs, 1), 0) < n loop v_diffs := v_diffs || null::text; end loop;
  select array_agg(x order by random()) into v_topics from unnest(v_topics[1:n]) x;
  select array_agg(x order by random()) into v_diffs from unnest(v_diffs[1:n]) x;

  for i in 1..n loop
    t := v_topics[i]; d := v_diffs[i];
    -- exact slot → relax difficulty → relax topic → anything approved and unused
    select id into v_pick from public.quiz_questions qq where qq.quiz_id = q.id and qq.status = 'approved' and not (qq.id = any(v_sel))
      and (t is null or qq.topic = t) and (d is null or qq.difficulty = d) order by (qq.id = any(v_prev)), random() limit 1;
    if v_pick is null and d is not null then
      select id into v_pick from public.quiz_questions qq where qq.quiz_id = q.id and qq.status = 'approved' and not (qq.id = any(v_sel))
        and (t is null or qq.topic = t) order by (qq.id = any(v_prev)), random() limit 1;
    end if;
    if v_pick is null and t is not null then
      select id into v_pick from public.quiz_questions qq where qq.quiz_id = q.id and qq.status = 'approved' and not (qq.id = any(v_sel))
        and (d is null or qq.difficulty = d) order by (qq.id = any(v_prev)), random() limit 1;
    end if;
    if v_pick is null then
      select id into v_pick from public.quiz_questions qq where qq.quiz_id = q.id and qq.status = 'approved' and not (qq.id = any(v_sel))
        order by (qq.id = any(v_prev)), random() limit 1;
    end if;
    if v_pick is not null then v_sel := v_sel || v_pick; end if;
  end loop;
  if not q.randomize_questions then
    select array_agg(id order by position, created_at) into v_sel from public.quiz_questions where id = any(v_sel);
  end if;
  return v_sel;
end $$;

-- Snapshot one attempt's questions (options shuffled when enabled; correct answers by stable id).
create or replace function private.snapshot_quiz_attempt(p_attempt_id uuid, p_question_ids uuid[], p_randomize_options boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare i int; r record; v_options jsonb;
begin
  for i in 1..coalesce(array_length(p_question_ids, 1), 0) loop
    select * into r from public.quiz_questions where id = p_question_ids[i];
    v_options := r.options;
    if p_randomize_options then
      if r.question_type in ('multiple_choice', 'video_multiple_choice') then
        v_options := private.jsonb_shuffle(r.options);
      elsif r.question_type = 'matching' then
        v_options := jsonb_build_object('left', r.options->'left', 'right', private.jsonb_shuffle(r.options->'right'));
      end if;
    end if;
    insert into public.quiz_attempt_questions (attempt_id, position, question_id, question_version, question_type, prompt, video_path, video_url, options, correct_answer, explanation, points, topic, difficulty)
    values (p_attempt_id, i, r.id, r.version, r.question_type, r.prompt, r.video_path, r.video_url, v_options, r.correct_answer, r.explanation, r.points, r.topic, r.difficulty);
  end loop;
end $$;

-- What a student may see of a snapshot row (never the correct answer or explanation here).
create or replace function private.student_question_json(r public.quiz_attempt_questions) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'position', r.position, 'question_type', r.question_type, 'prompt', r.prompt,
    'video_path', r.video_path, 'video_url', r.video_url, 'options', r.options, 'points', r.points, 'topic', r.topic);
$$;

-- ---------------------------------------------------------------------------
-- 8. Student attempt lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record; e record; a record; v_attempts int; v_id uuid; v_ids uuid[]; v_problems text[]; v_seed double precision; v_questions jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.account_is_active() then raise exception 'account suspended' using errcode = '42501'; end if;
  select * into q from public.quizzes where id = p_quiz_id and is_published;
  if q.id is null then raise exception 'quiz not found' using errcode = 'P0002'; end if;
  if not public.fn_student_can_access_month(q.month_id) then raise exception 'quiz is locked' using errcode = '42501'; end if;
  select e2.* into e from public.enrollments e2 join public.course_months m on m.course_id = e2.course_id where m.id = q.month_id and e2.user_id = auth.uid();
  if e.id is null then raise exception 'not enrolled' using errcode = '42501'; end if;
  -- one attempt per (quiz, enrollment) at a time: concurrent/retried starts return the same attempt
  perform pg_advisory_xact_lock(hashtext(q.id::text || e.id::text));
  select * into a from public.quiz_attempts where quiz_id = q.id and enrollment_id = e.id and status = 'in_progress' order by attempt_number desc limit 1;
  if a.id is null then
    select count(*) into v_attempts from public.quiz_attempts where quiz_id = q.id and enrollment_id = e.id;
    if q.max_attempts is not null and v_attempts >= q.max_attempts then raise exception 'maximum attempts reached' using errcode = 'P0001'; end if;
    v_problems := public.fn_quiz_publish_problems(q.id);
    if array_length(v_problems, 1) > 0 then
      raise exception 'This quiz is not ready yet. Please tell your trainer.' using errcode = 'P0001';
    end if;
    v_id := gen_random_uuid();
    v_seed := (('x' || substr(md5(v_id::text), 1, 8))::bit(32)::int)::double precision / 2147483647.0;
    v_ids := private.select_quiz_questions(q.id, e.id, v_seed);
    if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'This quiz has no questions yet. Please tell your trainer.' using errcode = 'P0001'; end if;
    insert into public.quiz_attempts (id, quiz_id, enrollment_id, attempt_number, answers, score, passed, started_at, submitted_at, status, quiz_version, bank_snapshot_at)
    values (v_id, q.id, e.id, v_attempts + 1, '{}'::jsonb, null, null, now(), null, 'in_progress', q.version, now());
    perform private.snapshot_quiz_attempt(v_id, v_ids, q.randomize_options);
    update public.quiz_attempts set total_points = (select sum(points) from public.quiz_attempt_questions where attempt_id = v_id) where id = v_id;
    perform public.fn_audit('quiz.attempt_started', 'quiz_attempt', v_id::text, auth.uid(), jsonb_build_object('quiz_id', q.id, 'attempt', v_attempts + 1, 'questions', array_length(v_ids, 1), 'quiz_version', q.version));
    select * into a from public.quiz_attempts where id = v_id;
  end if;
  select coalesce(jsonb_agg(private.student_question_json(aq) order by aq.position), '[]'::jsonb) into v_questions from public.quiz_attempt_questions aq where aq.attempt_id = a.id;
  return jsonb_build_object('attempt_id', a.id, 'attempt_number', a.attempt_number, 'status', a.status, 'resumed', a.id <> coalesce(v_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'started_at', a.started_at, 'questions', v_questions, 'answers', coalesce(a.answers, '{}'::jsonb), 'total_points', a.total_points);
end $$;

-- Autosave. Only keys that belong to this attempt's snapshot are kept.
create or replace function public.save_quiz_answers(p_attempt_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; v_clean jsonb;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id for update;
  if a.id is null or not public.owns_enrollment(a.enrollment_id) or not public.account_is_active() then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then return jsonb_build_object('saved', false, 'status', a.status); end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean
  from jsonb_each(coalesce(a.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb)) x(k, v)
  where exists (select 1 from public.quiz_attempt_questions aq where aq.attempt_id = a.id and aq.id::text = x.k);
  update public.quiz_attempts set answers = v_clean where id = a.id;
  return jsonb_build_object('saved', true, 'status', 'in_progress');
end $$;

-- Result shape shared by submit and get (reveal policy applied).
create or replace function private.quiz_attempt_result(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record; q record; v_reveal boolean := false; v_count int; v_pass int; v_questions jsonb;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id;
  select * into q from public.quizzes where id = a.quiz_id;
  v_pass := coalesce(q.passing_score, (select c.quiz_passing_score from public.courses c join public.course_months m on m.course_id = c.id where m.id = q.month_id), 70);
  select count(*) into v_count from public.quiz_attempts where quiz_id = a.quiz_id and enrollment_id = a.enrollment_id;
  if a.status = 'submitted' then
    v_reveal := q.reveal_policy = 'always'
      or (q.reveal_policy = 'after_pass_or_final' and (coalesce(a.passed, false) or (q.max_attempts is not null and v_count >= q.max_attempts)));
  end if;
  select coalesce(jsonb_agg(
    private.student_question_json(aq) || jsonb_build_object(
      'your_answer', a.answers -> aq.id::text,
      'correct', case when a.status = 'submitted' then aq.is_correct end,
      'correct_answer', case when v_reveal then aq.correct_answer end,
      'explanation', case when v_reveal then aq.explanation end)
    order by aq.position), '[]'::jsonb) into v_questions
  from public.quiz_attempt_questions aq where aq.attempt_id = a.id;
  return jsonb_build_object('attempt_id', a.id, 'quiz_id', a.quiz_id, 'attempt_number', a.attempt_number, 'status', a.status, 'started_at', a.started_at, 'submitted_at', a.submitted_at,
    'score', a.score, 'passed', a.passed, 'passing_score', v_pass, 'total_points', a.total_points, 'earned_points', a.earned_points,
    'answers_revealed', v_reveal, 'attempts_used', v_count, 'max_attempts', q.max_attempts, 'answers', coalesce(a.answers, '{}'::jsonb), 'questions', v_questions);
end $$;

-- Resume/refresh/review: the student's own attempt, same questions in the same order.
create or replace function public.get_quiz_attempt(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id;
  if a.id is null or not public.owns_enrollment(a.enrollment_id) then raise exception 'not found' using errcode = 'P0002'; end if;
  return private.quiz_attempt_result(a.id);
end $$;

drop function if exists public.submit_quiz_attempt(uuid, jsonb);
create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; q record; r record; v_points int := 0; v_earned int := 0; v_ans jsonb; v_ok boolean; v_score int; v_pass int; v_answers jsonb;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id for update;
  if a.id is null or not public.owns_enrollment(a.enrollment_id) or not public.account_is_active() then raise exception 'not authorised' using errcode = '42501'; end if;
  if a.status = 'submitted' then
    -- idempotent: a retried/replayed submission never re-grades or changes the stored score
    return private.quiz_attempt_result(a.id);
  end if;
  select * into q from public.quizzes where id = a.quiz_id;
  v_pass := coalesce(q.passing_score, (select c.quiz_passing_score from public.courses c join public.course_months m on m.course_id = c.id where m.id = q.month_id), 70);
  -- merge the final payload over the autosaved answers; unknown keys are ignored
  v_answers := coalesce(a.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb);
  for r in select * from public.quiz_attempt_questions where attempt_id = a.id order by position loop
    v_points := v_points + r.points;
    v_ans := v_answers -> r.id::text;
    v_ok := false;
    if r.question_type in ('multiple_choice', 'video_multiple_choice') then
      v_ok := v_ans is not null and jsonb_typeof(v_ans) = 'string' and v_ans = r.correct_answer;
    elsif r.question_type = 'matching' then
      v_ok := v_ans is not null and jsonb_typeof(v_ans) = 'object' and v_ans = r.correct_answer;
    end if;
    if v_ok then v_earned := v_earned + r.points; end if;
    update public.quiz_attempt_questions set answer = v_ans, is_correct = v_ok where id = r.id;
  end loop;
  v_score := case when v_points = 0 then 0 else round(100.0 * v_earned / v_points) end;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_answers from jsonb_each(v_answers) x(k, v)
    where exists (select 1 from public.quiz_attempt_questions aq where aq.attempt_id = a.id and aq.id::text = x.k);
  update public.quiz_attempts set status = 'submitted', submitted_at = now(), answers = v_answers, score = v_score, passed = v_score >= v_pass,
    earned_points = v_earned, total_points = v_points where id = a.id;
  perform public.fn_audit('quiz.attempt_submitted', 'quiz_attempt', a.id::text, auth.uid(), jsonb_build_object('quiz_id', a.quiz_id, 'attempt', a.attempt_number, 'score', v_score, 'passed', v_score >= v_pass));
  if v_score >= v_pass then
    perform public.fn_notify_if_month_unlocked(a.enrollment_id);
  end if;
  return private.quiz_attempt_result(a.id);
end $$;

-- ---------------------------------------------------------------------------
-- 9. Practice mode (low stakes: never touches quiz_attempts, progression or certificates)
-- ---------------------------------------------------------------------------
create or replace function public.practice_questions(p_month_id uuid, p_count int default 5, p_topic text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.account_is_active() then raise exception 'not authorised' using errcode = '42501'; end if;
  if not public.fn_student_can_access_month(p_month_id) then raise exception 'month is locked' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'question_type', qq.question_type, 'prompt', qq.prompt, 'video_path', qq.video_path, 'video_url', qq.video_url,
      'options', case when qq.question_type = 'matching' then jsonb_build_object('left', qq.options->'left', 'right', private.jsonb_shuffle(qq.options->'right')) else private.jsonb_shuffle(qq.options) end,
      'points', qq.points, 'topic', qq.topic, 'difficulty', qq.difficulty)), '[]'::jsonb) into v
  from (
    select qq.* from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where q.month_id = p_month_id and q.is_published and qq.status = 'approved' and qq.allow_practice
      and qq.question_type in ('multiple_choice', 'video_multiple_choice', 'matching')
      and (p_topic is null or qq.topic = p_topic)
    order by random() limit greatest(1, least(coalesce(p_count, 5), 20))
  ) qq;
  return v;
end $$;

create or replace function public.check_practice_answer(p_question_id uuid, p_answer jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare qq record; q record; e record; v_ok boolean := false;
begin
  if auth.uid() is null or not public.account_is_active() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into qq from public.quiz_questions where id = p_question_id and status = 'approved' and allow_practice;
  if qq.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into q from public.quizzes where id = qq.quiz_id and is_published;
  if q.id is null or not public.fn_student_can_access_month(q.month_id) then raise exception 'not found' using errcode = 'P0002'; end if;
  select e2.* into e from public.enrollments e2 join public.course_months m on m.course_id = e2.course_id where m.id = q.month_id and e2.user_id = auth.uid();
  if qq.question_type in ('multiple_choice', 'video_multiple_choice') then v_ok := p_answer is not null and jsonb_typeof(p_answer) = 'string' and p_answer = qq.correct_answer;
  elsif qq.question_type = 'matching' then v_ok := p_answer is not null and jsonb_typeof(p_answer) = 'object' and p_answer = qq.correct_answer; end if;
  insert into public.practice_events (enrollment_id, question_id, topic, difficulty, is_correct) values (e.id, qq.id, qq.topic, qq.difficulty, v_ok);
  return jsonb_build_object('correct', v_ok, 'correct_answer', qq.correct_answer, 'explanation', qq.explanation);
end $$;

-- Weak-area summary for the student (recommendation only; changes nothing).
create or replace function public.my_topic_progress(p_enrollment_id uuid)
returns table (topic text, quiz_answered bigint, quiz_correct bigint, practice_answered bigint, practice_correct bigint, accuracy numeric)
language sql stable security definer set search_path = public as $$
  with quiz as (
    select coalesce(aq.topic, 'General') as topic, count(*) as answered, count(*) filter (where aq.is_correct) as correct
    from public.quiz_attempt_questions aq join public.quiz_attempts a on a.id = aq.attempt_id
    where a.enrollment_id = p_enrollment_id and a.status = 'submitted' group by 1),
  practice as (
    select coalesce(topic, 'General') as topic, count(*) as answered, count(*) filter (where is_correct) as correct
    from public.practice_events where enrollment_id = p_enrollment_id group by 1)
  select coalesce(q.topic, p.topic), coalesce(q.answered, 0), coalesce(q.correct, 0), coalesce(p.answered, 0), coalesce(p.correct, 0),
    round(100.0 * (coalesce(q.correct, 0) + coalesce(p.correct, 0)) / greatest(1, coalesce(q.answered, 0) + coalesce(p.answered, 0)), 0)
  from quiz q full outer join practice p on p.topic = q.topic
  where public.owns_enrollment(p_enrollment_id) or public.can_manage_enrollment(p_enrollment_id)
  order by 6 asc, 2 desc;
$$;

-- ---------------------------------------------------------------------------
-- 10. Staff: review, preview, analytics, import, AI runs
-- ---------------------------------------------------------------------------
create or replace function public.review_quiz_question(p_question_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare qq record; v_problems text[];
begin
  select * into qq from public.quiz_questions where id = p_question_id for update;
  if qq.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quiz(qq.quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_decision = 'approve' then
    v_problems := private.question_problems(qq.question_type, qq.options, qq.correct_answer, qq.points, coalesce(qq.video_path, qq.video_url));
    if array_length(v_problems, 1) > 0 then raise exception 'Fix the question before approving it: %', array_to_string(v_problems, '; ') using errcode = 'P0001'; end if;
    update public.quiz_questions set status = 'approved', review_note = p_note where id = qq.id;
  elsif p_decision = 'reject' then
    if qq.status not in ('draft') then raise exception 'only drafts can be rejected; retire approved questions instead' using errcode = 'P0001'; end if;
    update public.quiz_questions set status = 'rejected', review_note = p_note where id = qq.id;
  elsif p_decision = 'retire' then
    update public.quiz_questions set status = 'retired', review_note = p_note where id = qq.id;
  elsif p_decision = 'draft' then
    update public.quiz_questions set status = 'draft', review_note = p_note where id = qq.id;
  else
    raise exception 'unknown decision' using errcode = '22023';
  end if;
end $$;

-- Instructor preview: run the selection without creating an attempt (answers included for staff).
create or replace function public.preview_quiz_selection(p_quiz_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_ids uuid[]; v jsonb;
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  v_ids := private.select_quiz_questions(p_quiz_id, null, random() * 2 - 1);
  select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'position', o.ord, 'question_type', qq.question_type, 'prompt', qq.prompt, 'topic', qq.topic, 'difficulty', qq.difficulty,
      'points', qq.points, 'options', qq.options, 'correct_answer', qq.correct_answer) order by o.ord), '[]'::jsonb) into v
  from unnest(v_ids) with ordinality o(id, ord) join public.quiz_questions qq on qq.id = o.id;
  return jsonb_build_object('questions', v, 'problems', public.fn_quiz_publish_problems(p_quiz_id));
end $$;

-- Per-question analytics from submitted attempts (flags are for instructor review – nothing is deleted).
create or replace function public.staff_question_stats(p_quiz_id uuid)
returns table (question_id uuid, times_used bigint, answered bigint, correct_count bigint, correct_pct numeric, last_used timestamptz, flag text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  return query
    select aq.question_id, count(*)::bigint, count(*) filter (where aq.answer is not null)::bigint, count(*) filter (where aq.is_correct)::bigint,
      round(100.0 * count(*) filter (where aq.is_correct) / greatest(1, count(*)), 0), max(a.submitted_at),
      case when count(*) >= 10 and 100.0 * count(*) filter (where aq.is_correct) / count(*) >= 95 then 'too_easy'
           when count(*) >= 10 and 100.0 * count(*) filter (where aq.is_correct) / count(*) <= 30 then 'too_hard' end
    from public.quiz_attempt_questions aq join public.quiz_attempts a on a.id = aq.attempt_id
    where a.quiz_id = p_quiz_id and a.status = 'submitted' and aq.question_id is not null
    group by aq.question_id;
end $$;

create or replace function public.staff_quiz_stats(p_quiz_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  select jsonb_build_object(
    'attempts', (select count(*) from public.quiz_attempts where quiz_id = p_quiz_id and status = 'submitted'),
    'in_progress', (select count(*) from public.quiz_attempts where quiz_id = p_quiz_id and status = 'in_progress'),
    'students', (select count(distinct enrollment_id) from public.quiz_attempts where quiz_id = p_quiz_id),
    'pass_rate', (select round(100.0 * count(*) filter (where passed) / greatest(1, count(*)), 0) from public.quiz_attempts where quiz_id = p_quiz_id and status = 'submitted'),
    'students_passed', (select count(distinct enrollment_id) from public.quiz_attempts where quiz_id = p_quiz_id and passed),
    'avg_score', (select round(avg(score), 0) from public.quiz_attempts where quiz_id = p_quiz_id and status = 'submitted'),
    'avg_attempts_per_student', (select round(avg(n), 1) from (select count(*) n from public.quiz_attempts where quiz_id = p_quiz_id group by enrollment_id) x),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('topic', t.topic, 'answered', t.answered, 'correct_pct', t.pct) order by t.pct), '[]'::jsonb) from (
        select coalesce(aq.topic, 'General') as topic, count(*) as answered, round(100.0 * count(*) filter (where aq.is_correct) / greatest(1, count(*)), 0) as pct
        from public.quiz_attempt_questions aq join public.quiz_attempts a on a.id = aq.attempt_id where a.quiz_id = p_quiz_id and a.status = 'submitted' group by 1) t),
    'bank', (select jsonb_build_object('approved', count(*) filter (where status = 'approved'), 'draft', count(*) filter (where status = 'draft'),
        'retired', count(*) filter (where status = 'retired'), 'rejected', count(*) filter (where status = 'rejected'), 'ai_draft', count(*) filter (where source = 'ai_draft'))
        from public.quiz_questions where quiz_id = p_quiz_id)
  ) into v;
  return v;
end $$;

-- Staff view of one attempt's snapshot (answers, correctness, correct answers).
create or replace function public.staff_quiz_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id;
  if a.id is null or not public.can_manage_enrollment(a.enrollment_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  return jsonb_build_object('attempt', to_jsonb(a) - 'answers', 'questions', (
    select coalesce(jsonb_agg(to_jsonb(aq) order by aq.position), '[]'::jsonb) from public.quiz_attempt_questions aq where aq.attempt_id = a.id));
end $$;

-- Import (CSV/JSON already parsed by the client) → drafts only; every row validated server-side.
create or replace function public.import_quiz_questions(p_quiz_id uuid, p_questions jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb; n int := 0; skipped jsonb := '[]'::jsonb; v_problems text[]; v_type public.question_type; v_pos int;
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 200 then raise exception 'send an array of at most 200 questions' using errcode = '22023'; end if;
  select coalesce(max(position), 0) into v_pos from public.quiz_questions where quiz_id = p_quiz_id;
  for d in select * from jsonb_array_elements(p_questions) loop
    begin
      v_type := coalesce(d->>'question_type', 'multiple_choice')::public.question_type;
    exception when others then
      skipped := skipped || jsonb_build_object('prompt', left(d->>'prompt', 80), 'reason', 'unknown question type'); continue;
    end;
    v_problems := private.question_problems(v_type, coalesce(d->'options', '[]'::jsonb), coalesce(d->'correct_answer', 'null'::jsonb), coalesce((d->>'points')::int, 1), coalesce(d->>'video_path', d->>'video_url'));
    if length(coalesce(trim(d->>'prompt'), '')) < 3 then v_problems := array_append(v_problems, 'prompt is required'); end if;
    if coalesce(d->>'difficulty', 'medium') not in ('easy', 'medium', 'hard') then v_problems := array_append(v_problems, 'difficulty must be easy, medium or hard'); end if;
    if array_length(v_problems, 1) > 0 then
      skipped := skipped || jsonb_build_object('prompt', left(d->>'prompt', 80), 'reason', array_to_string(v_problems, '; ')); continue;
    end if;
    v_pos := v_pos + 1;
    insert into public.quiz_questions (quiz_id, position, question_type, prompt, video_path, video_url, options, correct_answer, explanation, points, topic, difficulty, learning_objective, status, source)
    values (p_quiz_id, v_pos, v_type, trim(d->>'prompt'), nullif(d->>'video_path', ''), nullif(d->>'video_url', ''), d->'options', d->'correct_answer', nullif(d->>'explanation', ''),
      coalesce((d->>'points')::int, 1), nullif(left(d->>'topic', 60), ''), coalesce(d->>'difficulty', 'medium'), nullif(left(d->>'learning_objective', 200), ''), 'draft', 'imported');
    n := n + 1;
  end loop;
  perform public.fn_audit('quiz.questions_imported', 'quiz', p_quiz_id::text, null, jsonb_build_object('imported', n, 'skipped', jsonb_array_length(skipped)));
  return jsonb_build_object('imported', n, 'skipped', skipped);
end $$;

-- AI drafts, step 1: record the request and hand back ONLY approved curriculum material for the
-- quiz's month (published lessons + published practice signs). Called by the Edge Function as the
-- requesting staff member.
create or replace function public.create_quiz_generation_run(p_quiz_id uuid, p_requested_count int, p_difficulty_mix jsonb default '{}'::jsonb, p_lesson_ids uuid[] default null, p_include_practice boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record; m record; v_id uuid; v_lessons jsonb; v_practice jsonb; v_lesson_ids uuid[]; v_practice_ids uuid[]; v_topics jsonb;
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into q from public.quizzes where id = p_quiz_id;
  select * into m from public.course_months where id = q.month_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'description', l.description, 'objectives', l.objectives, 'transcript', left(l.transcript, 6000), 'module', mo.title, 'module_description', mo.description) order by mo.position, l.position), '[]'::jsonb),
         coalesce(array_agg(l.id), '{}')
    into v_lessons, v_lesson_ids
  from public.lessons l join public.modules mo on mo.id = l.module_id
  where mo.month_id = m.id and l.is_published and (p_lesson_ids is null or l.id = any(p_lesson_ids)) and (q.module_id is null or mo.id = q.module_id or p_lesson_ids is not null);
  if p_include_practice then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'movement_notes', p.movement_notes, 'has_video', coalesce(p.video_path, p.video_url) is not null) order by p.position), '[]'::jsonb),
           coalesce(array_agg(p.id), '{}')
      into v_practice, v_practice_ids
    from public.practice_items p where p.month_id = m.id and p.is_published;
  else
    v_practice := '[]'::jsonb; v_practice_ids := '{}';
  end if;
  select coalesce(jsonb_agg(distinct topic), '[]'::jsonb) into v_topics from public.quiz_questions where quiz_id = q.id and topic is not null;
  insert into public.quiz_generation_runs (quiz_id, requested_by, requested_count, difficulty_mix, source_lesson_ids, source_practice_ids)
  values (q.id, auth.uid(), greatest(1, least(coalesce(p_requested_count, 10), 20)), coalesce(p_difficulty_mix, '{}'::jsonb), v_lesson_ids, v_practice_ids) returning id into v_id;
  perform public.fn_audit('quiz.generation_requested', 'quiz_generation_run', v_id::text, null, jsonb_build_object('quiz_id', q.id, 'requested', greatest(1, least(coalesce(p_requested_count, 10), 20)), 'lessons', coalesce(array_length(v_lesson_ids, 1), 0), 'practice_items', coalesce(array_length(v_practice_ids, 1), 0)));
  return jsonb_build_object('run_id', v_id, 'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'description', q.description, 'existing_topics', v_topics),
    'month', jsonb_build_object('id', m.id, 'number', m.month_number, 'title', m.title, 'description', m.description),
    'course_title', (select c.title from public.courses c where c.id = m.course_id),
    'lessons', v_lessons, 'practice_items', v_practice);
end $$;

-- AI drafts, step 2: store validated drafts (status 'draft', source 'ai_draft'). Anything that fails
-- validation or references material outside the run is dropped and counted. Never approves.
create or replace function public.complete_quiz_generation_run(p_run_id uuid, p_status text, p_drafts jsonb default '[]'::jsonb, p_provider text default null, p_model text default null, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare run record; d jsonb; n int := 0; dropped int := 0; v_problems text[]; v_type public.question_type; v_pos int; v_lesson uuid; v_practice uuid; v_status text;
begin
  select * into run from public.quiz_generation_runs where id = p_run_id for update;
  if run.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if run.requested_by <> auth.uid() or not public.can_edit_quiz(run.quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  if run.status <> 'requested' then raise exception 'run already completed' using errcode = 'P0001'; end if;
  if p_status not in ('completed', 'failed', 'not_configured', 'insufficient_material') then raise exception 'invalid status' using errcode = '22023'; end if;
  v_status := p_status;
  if p_status = 'completed' then
    if jsonb_typeof(p_drafts) <> 'array' then raise exception 'drafts must be an array' using errcode = '22023'; end if;
    select coalesce(max(position), 0) into v_pos from public.quiz_questions where quiz_id = run.quiz_id;
    for d in select * from jsonb_array_elements(p_drafts) loop
      exit when n >= run.requested_count;
      begin
        v_type := coalesce(d->>'question_type', 'multiple_choice')::public.question_type;
      exception when others then
        dropped := dropped + 1; continue;
      end;
      if v_type not in ('multiple_choice', 'matching') then dropped := dropped + 1; continue; end if;
      v_lesson := null; v_practice := null;
      begin
        v_lesson := nullif(d->>'source_lesson_id', '')::uuid;
        v_practice := nullif(d->>'source_practice_item_id', '')::uuid;
      exception when others then
        dropped := dropped + 1; continue;
      end;
      -- grounding: every draft must cite material that was handed to the model in this run
      if not ((v_lesson is not null and v_lesson = any(run.source_lesson_ids)) or (v_practice is not null and v_practice = any(run.source_practice_ids))) then
        dropped := dropped + 1; continue;
      end if;
      v_problems := private.question_problems(v_type, coalesce(d->'options', '[]'::jsonb), coalesce(d->'correct_answer', 'null'::jsonb), 1, null);
      if length(coalesce(trim(d->>'prompt'), '')) < 5 or length(d->>'prompt') > 500 then v_problems := array_append(v_problems, 'prompt length'); end if;
      if coalesce(d->>'difficulty', 'medium') not in ('easy', 'medium', 'hard') then v_problems := array_append(v_problems, 'difficulty'); end if;
      if array_length(v_problems, 1) > 0 then dropped := dropped + 1; continue; end if;
      v_pos := v_pos + 1;
      insert into public.quiz_questions (quiz_id, position, question_type, prompt, options, correct_answer, explanation, points, topic, difficulty, learning_objective, lesson_id, practice_item_id, status, source, generation_id)
      values (run.quiz_id, v_pos, v_type, trim(d->>'prompt'), d->'options', d->'correct_answer', nullif(left(d->>'explanation', 500), ''), 1,
        nullif(left(d->>'topic', 60), ''), coalesce(d->>'difficulty', 'medium'), nullif(left(d->>'learning_objective', 200), ''), v_lesson, v_practice, 'draft', 'ai_draft', run.id);
      n := n + 1;
    end loop;
    if n = 0 then v_status := 'insufficient_material'; end if;
  end if;
  update public.quiz_generation_runs set status = v_status, generated_count = n, provider = left(p_provider, 60), model = left(p_model, 120), error = left(p_error, 300), completed_at = now() where id = run.id;
  perform public.fn_audit('quiz.generation_completed', 'quiz_generation_run', run.id::text, null, jsonb_build_object('quiz_id', run.quiz_id, 'status', v_status, 'generated', n, 'dropped', dropped, 'provider', left(p_provider, 60), 'model', left(p_model, 120)));
  return jsonb_build_object('run_id', run.id, 'status', v_status, 'generated', n, 'dropped', dropped);
end $$;

create or replace function public.list_quiz_generation_runs(p_quiz_id uuid)
returns setof public.quiz_generation_runs language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_quiz(p_quiz_id) then raise exception 'not authorised' using errcode = '42501'; end if;
  return query select r.* from public.quiz_generation_runs r where r.quiz_id = p_quiz_id order by r.created_at desc limit 50;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Students no longer read the question bank directly
-- ---------------------------------------------------------------------------
drop policy if exists quiz_questions_select_student on public.quiz_questions;
drop view if exists public.quiz_questions_student;

-- Course publish checklist includes quiz blueprints
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
  ] || coalesce((
    select array_agg(format('Quiz "%s": %s', q.title, array_to_string(public.fn_quiz_publish_problems(q.id), '; ')))
    from public.quizzes q join public.course_months m on m.id = q.month_id
    where m.course_id = p_course_id and m.is_published and q.is_published and array_length(public.fn_quiz_publish_problems(q.id), 1) > 0), '{}'), null);
$$;

-- ---------------------------------------------------------------------------
-- 12. EXECUTE grants (whitelist model)
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'private.jsonb_shuffle(jsonb)', 'private.question_problems(public.question_type, jsonb, jsonb, int, text)',
    'private.select_quiz_questions(uuid, uuid, double precision)', 'private.snapshot_quiz_attempt(uuid, uuid[], boolean)',
    'private.student_question_json(public.quiz_attempt_questions)', 'private.quiz_attempt_result(uuid)', 'private.quiz_publish_problems(public.quizzes)',
    'public.fn_quiz_publish_problems(uuid)', 'public.tg_quiz_publish_check()', 'public.tg_quiz_version()', 'public.tg_quiz_question_version()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.can_edit_quiz(uuid)', 'public.get_quiz_publish_problems(uuid)', 'public.start_quiz_attempt(uuid)', 'public.save_quiz_answers(uuid, jsonb)',
    'public.get_quiz_attempt(uuid)', 'public.submit_quiz_attempt(uuid, jsonb)', 'public.practice_questions(uuid, int, text)', 'public.check_practice_answer(uuid, jsonb)',
    'public.my_topic_progress(uuid)', 'public.review_quiz_question(uuid, text, text)', 'public.preview_quiz_selection(uuid)', 'public.staff_question_stats(uuid)',
    'public.staff_quiz_stats(uuid)', 'public.staff_quiz_attempt_detail(uuid)', 'public.import_quiz_questions(uuid, jsonb)',
    'public.create_quiz_generation_run(uuid, int, jsonb, uuid[], boolean)', 'public.complete_quiz_generation_run(uuid, text, jsonb, text, text, text)',
    'public.list_quiz_generation_runs(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
