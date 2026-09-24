-- MCSLI Learning Platform – 0002: tables
-- Conventions: uuid primary keys, timestamptz, snake_case, explicit FKs, RLS enabled on every table (policies in 0004).

-- ---------------------------------------------------------------------------
-- Identity & accounts
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null default 'STUDENT',
  account_status public.account_status not null default 'active',
  nationality public.nationality_class not null default 'ugandan',
  country text,
  city text,
  date_of_birth date,
  avatar_path text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  doc_type public.identity_doc_type not null,
  -- The raw identification number. NO direct SELECT policy exists for this table:
  -- students see a masked value through the identity_summary view and staff
  -- reveal it only through admin_reveal_identity_number(), which is audited.
  id_number text not null,
  id_number_last4 text generated always as (right(id_number, 4)) stored,
  full_name_on_document text not null,
  issuing_country text not null,
  status public.identity_status not null default 'pending',
  consent_given_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,          -- identity-documents/<user_id>/<uuid>.<ext>
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists identity_documents_user_idx on public.identity_documents(user_id);

-- ---------------------------------------------------------------------------
-- Courses & curriculum
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  duration_months integer not null check (duration_months between 1 and 24),
  currency text not null default 'UGX',
  tuition_national numeric(12,0) not null check (tuition_national >= 0),
  tuition_international numeric(12,0) not null check (tuition_international >= 0),
  registration_fee numeric(12,0) not null default 0 check (registration_fee >= 0),
  installments_enabled boolean not null default true,
  installment_count integer not null default 2 check (installment_count between 2 and 12),
  -- Optional explicit installment amounts per nationality, e.g. {"national":[175000,175000],"international":[200000,200000]}
  installment_amounts jsonb,
  -- Which month requires installment N to be confirmed first, e.g. {"2": 2}. Defaults to N.
  installment_due_before_month jsonb not null default '{"2": 2}'::jsonb,
  quiz_passing_score integer not null default 70 check (quiz_passing_score between 0 and 100),
  requires_final_exam boolean not null default true,
  certificate_title text not null default 'Certificate of Completion',
  cover_image_path text,
  is_published boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);

create table if not exists public.trainer_assignments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  can_grade_exams boolean not null default true,
  can_moderate boolean not null default true,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (trainer_id, course_id, cohort_id)
);

create table if not exists public.course_months (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  month_number integer not null check (month_number >= 1),
  title text not null,
  description text,
  requires_assessment boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, month_number)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.course_months(id) on delete cascade,
  position integer not null default 1,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists modules_month_idx on public.modules(month_id, position);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  position integer not null default 1,
  title text not null,
  description text,
  objectives text[] not null default '{}',
  -- Private storage object path in bucket course-media (signed URLs only) OR an external https URL.
  video_path text,
  video_url text,
  captions_path text,           -- WebVTT in course-media
  transcript text,
  duration_seconds integer,
  is_published boolean not null default true,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_module_idx on public.lessons(module_id, position);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  storage_path text,            -- bucket lesson-resources
  external_url text,
  is_downloadable boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_items (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.course_months(id) on delete cascade,
  position integer not null default 1,
  title text not null,
  description text,
  movement_notes text,
  video_path text,
  video_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enrollment & payments
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  cohort_id uuid references public.cohorts(id),
  status public.enrollment_status not null default 'pending_payment',
  plan_type public.payment_plan_type not null,
  nationality public.nationality_class not null,
  -- Price snapshot taken at enrollment so later fee changes never alter an existing agreement.
  currency text not null,
  registration_fee numeric(12,0) not null,
  tuition_amount numeric(12,0) not null,
  -- [{"number":1,"amount":175000,"due_before_month":1},{"number":2,"amount":175000,"due_before_month":2}]
  installments jsonb not null,
  final_approved_by uuid references public.profiles(id),
  final_approved_at timestamptz,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists enrollments_user_idx on public.enrollments(user_id);
create index if not exists enrollments_course_idx on public.enrollments(course_id, status);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  method_type public.payment_method_type not null,
  display_name text not null,
  bank_name text,
  account_name text,
  account_number text,
  branch text,
  swift_code text,
  merchant_code text,
  currency text not null default 'UGX',
  instructions text,
  is_enabled boolean not null default false,
  position integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose public.payment_purpose not null,
  installment_number integer,
  method_id uuid references public.payment_methods(id),
  method_type public.payment_method_type not null,
  amount numeric(12,0) not null check (amount > 0),
  currency text not null default 'UGX',
  payer_name text not null,
  reference text not null,
  paid_at date not null,
  proof_path text,              -- bucket payment-proofs/<user_id>/...
  status public.payment_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  receipt_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_enrollment_idx on public.payments(enrollment_id, status);
create index if not exists payments_status_idx on public.payments(status, submitted_at);

-- ---------------------------------------------------------------------------
-- Progress, quizzes, assessments, exams
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  last_position_seconds integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, lesson_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.course_months(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  title text not null,
  description text,
  passing_score integer check (passing_score between 0 and 100),   -- null → course default
  max_attempts integer check (max_attempts is null or max_attempts >= 1),
  is_required boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null default 1,
  question_type public.question_type not null default 'multiple_choice',
  prompt text not null,
  video_path text,
  video_url text,
  -- multiple choice: [{"id":"a","text":"..."}]; matching: {"left":[{"id":"l1","text":".."}],"right":[{"id":"r1","text":".."}]}
  options jsonb not null default '[]'::jsonb,
  -- multiple choice: "a"; matching: {"l1":"r2", ...}
  correct_answer jsonb not null,
  explanation text,
  points integer not null default 1 check (points > 0),
  created_at timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  attempt_number integer not null,
  answers jsonb not null,
  score integer not null,
  passed boolean not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  unique (quiz_id, enrollment_id, attempt_number)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  month_id uuid not null references public.course_months(id) on delete cascade,
  trainer_id uuid references public.profiles(id),
  scheduled_at timestamptz,
  status public.assessment_status not null default 'scheduled',
  is_reassessment boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assessments_enrollment_idx on public.assessments(enrollment_id, month_id);
create index if not exists assessments_trainer_idx on public.assessments(trainer_id, status);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  month_id uuid not null references public.course_months(id) on delete cascade,
  attempt_number integer not null,
  score integer check (score between 0 and 100),
  result public.assessment_result not null,
  trainer_feedback text,
  notes text,
  assessed_by uuid not null references public.profiles(id),
  assessed_at timestamptz not null default now(),
  unique (enrollment_id, month_id, attempt_number)
);

create table if not exists public.month_overrides (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  month_id uuid not null references public.course_months(id) on delete cascade,
  reason text not null check (length(reason) >= 10),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id),
  revoked_at timestamptz,
  revoke_reason text
);
create index if not exists month_overrides_enrollment_idx on public.month_overrides(enrollment_id, month_id) where revoked_at is null;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  month_id uuid references public.course_months(id) on delete set null,
  title text not null,
  instructions text,
  is_final boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts integer not null default 1 check (max_attempts >= 1),
  randomize_questions boolean not null default false,
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  status public.exam_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  position integer not null default 1,
  question_type public.question_type not null default 'multiple_choice',
  prompt text not null,
  video_path text,
  video_url text,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,                        -- null for practical/manual questions
  points integer not null default 1 check (points > 0),
  requires_manual_grading boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists exam_questions_exam_idx on public.exam_questions(exam_id, position);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  attempt_number integer not null,
  question_order uuid[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,      -- {"<question_id>": <answer>}; practical answers may be storage paths
  status public.exam_attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  auto_score numeric(6,2),
  manual_scores jsonb,                              -- {"<question_id>": points}
  total_score numeric(5,2),                         -- percentage 0..100
  passed boolean,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  grader_feedback text,
  results_released_at timestamptz,
  unique (exam_id, enrollment_id, attempt_number)
);
create index if not exists exam_attempts_enrollment_idx on public.exam_attempts(enrollment_id);

-- ---------------------------------------------------------------------------
-- Discussions, certificates, support, notifications, audit, content
-- ---------------------------------------------------------------------------
create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  month_id uuid references public.course_months(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 3 and 200),
  body text not null check (length(body) between 1 and 10000),
  is_announcement boolean not null default false,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_hidden boolean not null default false,
  hidden_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discussion_threads_course_idx on public.discussion_threads(course_id, is_pinned desc, created_at desc);

create table if not exists public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.discussion_posts(id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  is_hidden boolean not null default false,
  hidden_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discussion_posts_thread_idx on public.discussion_posts(thread_id, created_at);

create table if not exists public.discussion_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  post_id uuid references public.discussion_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (thread_id is not null or post_id is not null)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  certificate_number text not null unique,
  student_name text not null,
  course_title text not null,
  certificate_title text not null,
  completion_date date not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  status public.certificate_status not null default 'issued',
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoke_reason text,
  reissued_from uuid references public.certificates(id),
  pdf_path text
);
create index if not exists certificates_user_idx on public.certificates(user_id);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.ticket_category not null default 'other',
  subject text not null check (length(subject) between 3 and 200),
  status public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_tickets_user_idx on public.support_tickets(user_id, status);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  target_user_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs(target_user_id);

-- Public website content managed by admins. Key examples: contact, impact_stats, programs,
-- stories, team, announcements, hero, events, gallery_overrides.
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Platform settings (not public). Key examples: certificate, support_email, registration_open.
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Contact-form and volunteer submissions from the public website.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact' check (kind in ('contact', 'volunteer', 'partner', 'shop')),
  full_name text not null check (length(full_name) between 2 and 120),
  email text not null check (position('@' in email) > 1),
  phone text,
  subject text,
  body text not null check (length(body) between 5 and 5000),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

-- Public events managed by admins.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  is_online boolean not null default false,
  registration_url text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (policies defined in 0004_policies.sql)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- updated_at maintenance
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;
