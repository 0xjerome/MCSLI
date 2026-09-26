/**
 * Compile-time contract between the hand-written row types in ./database.ts (used across the app)
 * and ./supabase.generated.ts, which is generated from the real schema:
 *
 *   npx supabase gen types typescript --local --schema public > src/types/supabase.generated.ts
 *   # or, for the hosted project:  --project-id <ref>
 *
 * If a migration adds, removes or renames a column, `npm run typecheck` fails here and names the
 * column, instead of the mismatch surfacing as a runtime error in production. Only column NAMES
 * are compared (manual types intentionally narrow enums/JSON shapes and may omit columns).
 * This file has no runtime effect and is not imported by the app.
 */
import type { Database } from './supabase.generated';
import type * as M from './database';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
type Row<T extends keyof Tables> = Tables[T]['Row'];
type ViewRow<T extends keyof Views> = Views[T]['Row'];
type Fns = Database['public']['Functions'];
/** Row shape of a set-returning RPC (the SECURITY DEFINER functions that replaced the definer views). */
type FnRow<T extends keyof Fns> = Fns[T]['Returns'] extends (infer R)[] ? R : never;

/**
 * `true` when every column of the manual type exists in the schema row. Manual types may be a
 * subset, and may carry embedded relations (PostgREST joins) listed in `Joins`.
 */
type KeysExist<Manual, Generated, Joins extends PropertyKey = never> = [Exclude<Exclude<keyof Manual, Joins>, keyof Generated>] extends [never] ? true : { notInSchema: Exclude<Exclude<keyof Manual, Joins>, keyof Generated> };

export const schemaContract: {
  profiles: KeysExist<M.Profile, Row<'profiles'>>;
  public_profiles: KeysExist<M.PublicProfile, FnRow<'public_profiles_lookup'>>;
  identity_summary: KeysExist<M.IdentitySummary, FnRow<'get_my_identity'>>;
  identity_documents: KeysExist<M.IdentityDocument, Row<'identity_documents'>>;
  courses: KeysExist<M.Course, Row<'courses'>>;
  cohorts: KeysExist<M.Cohort, Row<'cohorts'>>;
  trainer_assignments: KeysExist<M.TrainerAssignment, Row<'trainer_assignments'>>;
  course_months: KeysExist<M.CourseMonth, Row<'course_months'>>;
  modules: KeysExist<M.Module, Row<'modules'>>;
  lessons: KeysExist<M.Lesson, Row<'lessons'>>;
  lesson_resources: KeysExist<M.LessonResource, Row<'lesson_resources'>>;
  practice_items: KeysExist<M.PracticeItem, Row<'practice_items'>>;
  enrollments: KeysExist<M.Enrollment, Row<'enrollments'>>;
  payment_methods: KeysExist<M.PaymentMethod, Row<'payment_methods'>>;
  payments: KeysExist<M.Payment, Row<'payments'>>;
  lesson_progress: KeysExist<M.LessonProgress, Row<'lesson_progress'>>;
  quizzes: KeysExist<M.Quiz, Row<'quizzes'>>;
  quiz_questions_student: KeysExist<M.QuizQuestionStudent, ViewRow<'quiz_questions_student'>>;
  quiz_questions: KeysExist<M.QuizQuestion, Row<'quiz_questions'>>;
  quiz_attempts: KeysExist<M.QuizAttempt, Row<'quiz_attempts'>>;
  assessments: KeysExist<M.Assessment, Row<'assessments'>>;
  assessment_attempts: KeysExist<M.AssessmentAttempt, Row<'assessment_attempts'>>;
  month_overrides: KeysExist<M.MonthOverride, Row<'month_overrides'>>;
  exams: KeysExist<M.Exam, Row<'exams'>>;
  exam_questions_student: KeysExist<M.ExamQuestionStudent, ViewRow<'exam_questions_student'>>;
  exam_questions: KeysExist<M.ExamQuestion, Row<'exam_questions'>>;
  exam_attempts_student: KeysExist<M.ExamAttemptStudent, FnRow<'my_exam_attempts'>>;
  exam_attempts: KeysExist<M.ExamAttempt, Row<'exam_attempts'>>;
  discussion_threads: KeysExist<M.DiscussionThread, Row<'discussion_threads'>, 'author' | 'posts'>;
  discussion_posts: KeysExist<M.DiscussionPost, Row<'discussion_posts'>, 'author'>;
  discussion_reports: KeysExist<M.DiscussionReport, Row<'discussion_reports'>>;
  certificates: KeysExist<M.Certificate, Row<'certificates'>>;
  support_tickets: KeysExist<M.SupportTicket, Row<'support_tickets'>, 'user'>;
  support_messages: KeysExist<M.SupportMessage, Row<'support_messages'>, 'author'>;
  notifications: KeysExist<M.Notification, Row<'notifications'>>;
  audit_logs: KeysExist<M.AuditLog, Row<'audit_logs'>, 'actor' | 'target'>;
  site_content: KeysExist<M.SiteContentRow, Row<'site_content'>>;
  platform_settings: KeysExist<M.PlatformSettingRow, Row<'platform_settings'>>;
  events: KeysExist<M.EventRow, Row<'events'>>;
  contact_messages: KeysExist<M.ContactMessage, Row<'contact_messages'>>;
} = {
  profiles: true,
  public_profiles: true,
  identity_summary: true,
  identity_documents: true,
  courses: true,
  cohorts: true,
  trainer_assignments: true,
  course_months: true,
  modules: true,
  lessons: true,
  lesson_resources: true,
  practice_items: true,
  enrollments: true,
  payment_methods: true,
  payments: true,
  lesson_progress: true,
  quizzes: true,
  quiz_questions_student: true,
  quiz_questions: true,
  quiz_attempts: true,
  assessments: true,
  assessment_attempts: true,
  month_overrides: true,
  exams: true,
  exam_questions_student: true,
  exam_questions: true,
  exam_attempts_student: true,
  exam_attempts: true,
  discussion_threads: true,
  discussion_posts: true,
  discussion_reports: true,
  certificates: true,
  support_tickets: true,
  support_messages: true,
  notifications: true,
  audit_logs: true,
  site_content: true,
  platform_settings: true,
  events: true,
  contact_messages: true,
};

/** Every RPC the app calls must exist in the schema (a typo becomes a compile error). */
type Fn = keyof Database['public']['Functions'];
export const rpcContract: Fn[] = [
  'get_my_course_map', 'enroll_in_course', 'submit_payment', 'review_payment', 'save_lesson_progress', 'submit_quiz_attempt',
  'schedule_assessment', 'record_assessment_result', 'override_month_unlock', 'revoke_month_override', 'start_exam_attempt',
  'save_exam_answers', 'submit_exam_attempt', 'grade_exam_attempt', 'release_exam_results', 'get_certificate_eligibility',
  'approve_enrollment_completion', 'issue_certificate', 'revoke_certificate', 'reissue_certificate', 'verify_certificate',
  'submit_identity', 'register_identity_document', 'review_identity', 'delete_identity_document', 'admin_reveal_identity_number',
  'moderate_discussion', 'update_ticket_status', 'mark_notifications_read', 'set_site_content', 'set_platform_setting',
  'admin_set_user_role', 'admin_set_account_status', 'admin_set_enrollment_status', 'admin_dashboard_stats', 'trainer_dashboard_stats',
  'staff_quiz_questions', 'staff_exam_questions', 'staff_exam_attempts', 'get_public_settings',
  'get_site_content_public', 'get_my_identity', 'admin_list_identities', 'my_exam_attempts', 'public_profiles_lookup',
  'create_staff_invitation', 'cancel_staff_invitation', 'list_staff_invitations', 'accept_staff_invitation', 'get_course_publish_problems',
];
