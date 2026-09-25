-- MCSLI Learning Platform – 0001: extensions and enumerated types
-- Applies to Supabase Postgres 15+. Safe to re-run (idempotent guards).

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('STUDENT', 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nationality_class as enum ('ugandan', 'international');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_status as enum ('not_submitted', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_doc_type as enum ('national_id', 'passport', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('pending_payment', 'active', 'completed', 'withdrawn', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_plan_type as enum ('full', 'installments');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_purpose as enum ('registration', 'tuition');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method_type as enum ('bank', 'mtn', 'airtel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'under_review', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_status as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_result as enum ('pass', 'not_passed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exam_status as enum ('draft', 'scheduled', 'open', 'closed', 'results_released');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exam_attempt_status as enum ('in_progress', 'submitted', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum ('multiple_choice', 'video_multiple_choice', 'matching', 'practical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.certificate_status as enum ('issued', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_category as enum ('payment', 'course', 'technical', 'identity', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'payment_confirmed', 'payment_rejected', 'identity_verified', 'identity_rejected',
    'assessment_scheduled', 'assessment_passed', 'reassessment_required', 'month_unlocked',
    'trainer_announcement', 'exam_available', 'exam_graded', 'certificate_issued',
    'support_response', 'discussion_reply', 'system'
  );
exception when duplicate_object then null; end $$;
