/**
 * Row types for the tables/views used by the app. Mirrors supabase/migrations/0002_tables.sql.
 * (Generate with `supabase gen types typescript` once a project exists; kept hand-written so the
 * app compiles without the CLI.)
 */
import type {
  AccountStatus, AssessmentResult, AssessmentStatus, CertificateStatus, EnrollmentStatus, ExamAttemptStatus, ExamStatus,
  IdentityDocType, IdentityStatus, NationalityClass, NotificationType, PaymentMethodType, PaymentPlanType, PaymentPurpose,
  PaymentStatus, QuestionType, TicketCategory, TicketStatus, UserRole,
} from '@/domain/types';

export type { QuestionType, AssessmentResult, PaymentStatus } from '@/domain/types';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  account_status: AccountStatus;
  nationality: NationalityClass;
  country: string | null;
  city: string | null;
  date_of_birth: string | null;
  avatar_path: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_path: string | null;
}

export interface IdentitySummary {
  id: string;
  user_id: string;
  doc_type: IdentityDocType;
  id_number_masked: string;
  full_name_on_document: string;
  issuing_country: string;
  status: IdentityStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  consent_given_at: string;
}

export interface IdentityDocument {
  id: string;
  verification_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  duration_months: number;
  currency: string;
  tuition_national: number;
  tuition_international: number;
  registration_fee: number;
  installments_enabled: boolean;
  installment_count: number;
  installment_amounts: { national?: number[]; international?: number[] } | null;
  installment_due_before_month: Record<string, number>;
  quiz_passing_score: number;
  requires_final_exam: boolean;
  certificate_title: string;
  cover_image_path: string | null;
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cohort {
  id: string;
  course_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
}

export interface TrainerAssignment {
  id: string;
  trainer_id: string;
  course_id: string;
  cohort_id: string | null;
  can_grade_exams: boolean;
  can_moderate: boolean;
  created_at: string;
}

export interface CourseMonth {
  id: string;
  course_id: string;
  month_number: number;
  title: string;
  description: string | null;
  requires_assessment: boolean;
  is_published: boolean;
}

export interface Module {
  id: string;
  month_id: string;
  position: number;
  title: string;
  description: string | null;
}

export interface Lesson {
  id: string;
  module_id: string;
  position: number;
  title: string;
  description: string | null;
  objectives: string[];
  video_path: string | null;
  video_url: string | null;
  captions_path: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  is_published: boolean;
  is_required: boolean;
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  title: string;
  storage_path: string | null;
  external_url: string | null;
  is_downloadable: boolean;
}

export interface PracticeItem {
  id: string;
  month_id: string;
  position: number;
  title: string;
  description: string | null;
  movement_notes: string | null;
  video_path: string | null;
  video_url: string | null;
  is_published: boolean;
}

export interface Installment {
  number: number;
  amount: number;
  due_before_month: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  cohort_id: string | null;
  status: EnrollmentStatus;
  plan_type: PaymentPlanType;
  nationality: NationalityClass;
  currency: string;
  registration_fee: number;
  tuition_amount: number;
  installments: Installment[];
  final_approved_by: string | null;
  final_approved_at: string | null;
  created_at: string;
  activated_at: string | null;
  completed_at: string | null;
}

export interface PaymentMethod {
  id: string;
  method_type: PaymentMethodType;
  display_name: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch: string | null;
  swift_code: string | null;
  merchant_code: string | null;
  currency: string;
  instructions: string | null;
  is_enabled: boolean;
  position: number;
  updated_at: string;
}

export interface Payment {
  id: string;
  enrollment_id: string;
  user_id: string;
  purpose: PaymentPurpose;
  installment_number: number | null;
  method_id: string | null;
  method_type: PaymentMethodType;
  amount: number;
  currency: string;
  payer_name: string;
  reference: string;
  paid_at: string;
  proof_path: string | null;
  status: PaymentStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  receipt_number: string | null;
}

export interface LessonProgress {
  enrollment_id: string;
  lesson_id: string;
  last_position_seconds: number;
  completed_at: string | null;
  updated_at: string;
}

export interface Quiz {
  id: string;
  month_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  passing_score: number | null;
  max_attempts: number | null;
  is_required: boolean;
  is_published: boolean;
}

export interface McOption {
  id: string;
  text: string;
}
export interface MatchingOptions {
  left: McOption[];
  right: McOption[];
}

export interface QuizQuestionStudent {
  id: string;
  quiz_id: string;
  position: number;
  question_type: QuestionType;
  prompt: string;
  video_path: string | null;
  video_url: string | null;
  options: McOption[] | MatchingOptions;
  points: number;
}

export interface QuizQuestion extends QuizQuestionStudent {
  correct_answer: Json;
  explanation: string | null;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  attempt_number: number;
  answers: Record<string, Json>;
  score: number;
  passed: boolean;
  started_at: string;
  submitted_at: string;
}

export interface QuizResult {
  attempt_id: string;
  attempt_number: number;
  score: number;
  passed: boolean;
  passing_score: number;
  questions: { question_id: string; correct: boolean; correct_answer: Json; explanation: string | null; your_answer: Json }[];
}

export interface Assessment {
  id: string;
  enrollment_id: string;
  month_id: string;
  trainer_id: string | null;
  scheduled_at: string | null;
  status: AssessmentStatus;
  is_reassessment: boolean;
  notes: string | null;
  created_at: string;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  enrollment_id: string;
  month_id: string;
  attempt_number: number;
  score: number | null;
  result: AssessmentResult;
  trainer_feedback: string | null;
  notes: string | null;
  assessed_by: string;
  assessed_at: string;
}

export interface MonthOverride {
  id: string;
  enrollment_id: string;
  month_id: string;
  reason: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface Exam {
  id: string;
  course_id: string;
  month_id: string | null;
  title: string;
  instructions: string | null;
  is_final: boolean;
  opens_at: string | null;
  closes_at: string | null;
  time_limit_minutes: number | null;
  max_attempts: number;
  randomize_questions: boolean;
  passing_score: number;
  status: ExamStatus;
  created_at: string;
}

export interface ExamQuestionStudent {
  id: string;
  exam_id: string;
  position: number;
  question_type: QuestionType;
  prompt: string;
  video_path: string | null;
  video_url: string | null;
  options: McOption[] | MatchingOptions;
  points: number;
  requires_manual_grading: boolean;
}

export interface ExamQuestion extends ExamQuestionStudent {
  correct_answer: Json | null;
}

export interface ExamAttemptStudent {
  id: string;
  exam_id: string;
  enrollment_id: string;
  attempt_number: number;
  question_order: string[];
  answers: Record<string, Json>;
  status: ExamAttemptStatus;
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  total_score: number | null;
  passed: boolean | null;
  grader_feedback: string | null;
  results_released_at: string | null;
}

export interface ExamAttempt extends ExamAttemptStudent {
  auto_score: number | null;
  manual_scores: Record<string, number> | null;
  graded_by: string | null;
  graded_at: string | null;
}

export interface DiscussionThread {
  id: string;
  course_id: string;
  month_id: string | null;
  author_id: string;
  title: string;
  body: string;
  is_announcement: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  author?: PublicProfile | null;
  posts?: { count: number }[];
}

export interface DiscussionPost {
  id: string;
  thread_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  is_hidden: boolean;
  created_at: string;
  author?: PublicProfile | null;
}

export interface DiscussionReport {
  id: string;
  thread_id: string | null;
  post_id: string | null;
  reporter_id: string;
  reason: string;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  user_id: string;
  certificate_number: string;
  student_name: string;
  course_title: string;
  certificate_title: string;
  completion_date: string;
  issued_at: string;
  issued_by: string | null;
  status: CertificateStatus;
  revoked_at: string | null;
  revoke_reason: string | null;
  reissued_from: string | null;
}

export interface CertificateVerification {
  found: boolean;
  certificate_number?: string;
  student_name?: string;
  course_title?: string;
  certificate_title?: string;
  completion_date?: string;
  issued_at?: string;
  status?: CertificateStatus;
  revoked_at?: string | null;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user?: PublicProfile | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  is_staff: boolean;
  body: string;
  created_at: string;
  author?: PublicProfile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, Json>;
  created_at: string;
  actor?: PublicProfile | null;
  target?: PublicProfile | null;
}

export interface SiteContentRow {
  key: string;
  value: Json;
  is_public: boolean;
  updated_at: string;
}

export interface PlatformSettingRow {
  key: string;
  value: Json;
  updated_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  is_online: boolean;
  registration_url: string | null;
  is_published: boolean;
}

export interface ContactMessage {
  id: string;
  kind: 'contact' | 'volunteer' | 'partner' | 'shop';
  full_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  body: string;
  metadata: Record<string, Json>;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

/** Shape returned by get_my_course_map(). */
export interface CourseMapMonth {
  id: string;
  month_number: number;
  title: string;
  description: string | null;
  requires_assessment: boolean;
  access: { allowed: boolean; reasons: { code: string; message: string; meta?: Record<string, Json> }[]; overridden?: boolean };
  lessons_total: number;
  lessons_completed: number;
  quizzes_total: number;
  quizzes_passed: number;
  assessment_result: AssessmentResult | null;
  assessment_attempts: number;
}

export interface AdminStats {
  total_students: number;
  active_students: number;
  pending_identity: number;
  pending_payments: number;
  upcoming_assessments: number;
  assessments_awaiting_results: number;
  students_blocked_by_payment: number;
  students_blocked_by_assessment: number;
  certificates_issued: number;
  open_tickets: number;
  open_reports: number;
  new_messages: number;
}

export interface TrainerStats {
  students: number;
  pending_assessments: number;
  reassessments: number;
  pending_grading: number;
  open_reports: number;
}
