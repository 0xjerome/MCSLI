import { getSupabase } from '@/lib/supabase';
import type {
  Assessment, AssessmentAttempt, AuditLog, Certificate, Cohort, Course, CourseMonth, Enrollment, Exam, ExamAttempt, ExamQuestion, IdentityDocument, IdentitySummary,
  Lesson, LessonProgress, Module, MonthOverride, Payment, PaymentMethod, PlatformSettingRow, PracticeItem, Profile, PublicProfile, Quiz, QuizAttempt, QuizQuestion, QuizAttemptDetail, QuizGenerationRun, QuizSelectionPreview, QuizStats, QuestionStats, QuestionDifficulty, QuestionType, McOption, MatchingOptions, CohortQuestion, CohortApplication, CohortApplicationEvent, CohortApplicationStatus, CohortStats, CohortImportResult,
  AiTrainingAsset,
  SiteContentRow, TrainerStats, AdminStats, TrainerAssignment, ContactMessage, EventRow, DiscussionReport, Json,
} from '@/types/database';
import type { AccountStatus, AssessmentResult, EnrollmentStatus, IdentityStatus, PaymentStatus, UserRole } from '@/domain/types';

const sb = () => getSupabase();
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------
export async function adminStats(): Promise<AdminStats> {
  return must(await sb().rpc('admin_dashboard_stats')) as AdminStats;
}
export async function trainerStats(): Promise<TrainerStats> {
  return must(await sb().rpc('trainer_dashboard_stats')) as TrainerStats;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
export interface ProfileFilter {
  role?: UserRole;
  search?: string;
  page?: number;
  pageSize?: number;
}
export async function listProfiles(f: ProfileFilter = {}): Promise<{ rows: Profile[]; count: number }> {
  const pageSize = f.pageSize ?? 25;
  const page = f.page ?? 1;
  let q = sb().from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (f.role) q = q.eq('role', f.role);
  if (f.search) q = q.or(`full_name.ilike.%${f.search}%,email.ilike.%${f.search}%,phone.ilike.%${f.search}%`);
  const res = await q;
  if (res.error) throw res.error;
  return { rows: (res.data ?? []) as Profile[], count: res.count ?? 0 };
}
export async function getProfile(id: string): Promise<Profile | null> {
  return must(await sb().from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
}
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  must(await sb().rpc('admin_set_user_role', { p_user_id: userId, p_role: role }));
}
export async function setAccountStatus(userId: string, status: AccountStatus, reason?: string): Promise<void> {
  must(await sb().rpc('admin_set_account_status', { p_user_id: userId, p_status: status, p_reason: reason ?? null }));
}
export async function adminUpdateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  must(await sb().from('profiles').update(patch).eq('id', userId));
}

// ---------------------------------------------------------------------------
// Enrollments (staff view)
// ---------------------------------------------------------------------------
export interface EnrollmentRow extends Enrollment {
  course: Pick<Course, 'id' | 'title' | 'duration_months' | 'slug'>;
  student: PublicProfile & { email?: string };
  cohort?: Pick<Cohort, 'id' | 'name'> | null;
}
export async function listEnrollments(f: { status?: EnrollmentStatus; courseId?: string; search?: string } = {}): Promise<EnrollmentRow[]> {
  let q = sb().from('enrollments').select('*, course:courses(id, title, duration_months, slug), student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path, email), cohort:cohorts(id, name)').order('created_at', { ascending: false }).limit(500);
  if (f.status) q = q.eq('status', f.status);
  if (f.courseId) q = q.eq('course_id', f.courseId);
  const rows = must(await q) as EnrollmentRow[];
  if (f.search) {
    const s = f.search.toLowerCase();
    return rows.filter((r) => r.student?.full_name?.toLowerCase().includes(s) || r.student?.email?.toLowerCase().includes(s));
  }
  return rows;
}
export async function getEnrollment(id: string): Promise<EnrollmentRow | null> {
  return must(await sb().from('enrollments').select('*, course:courses(id, title, duration_months, slug), student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path, email), cohort:cohorts(id, name)').eq('id', id).maybeSingle()) as EnrollmentRow | null;
}
export async function listEnrollmentsForUser(userId: string): Promise<EnrollmentRow[]> {
  return must(await sb().from('enrollments').select('*, course:courses(id, title, duration_months, slug), student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path, email), cohort:cohorts(id, name)').eq('user_id', userId)) as EnrollmentRow[];
}
export async function setEnrollmentStatus(id: string, status: EnrollmentStatus, reason?: string): Promise<void> {
  must(await sb().rpc('admin_set_enrollment_status', { p_enrollment_id: id, p_status: status, p_reason: reason ?? null }));
}
export async function approveCompletion(enrollmentId: string): Promise<void> {
  must(await sb().rpc('approve_enrollment_completion', { p_enrollment_id: enrollmentId }));
}
export async function getCourseMapFor(enrollmentId: string) {
  return must(await sb().rpc('get_my_course_map', { p_enrollment_id: enrollmentId })) as import('@/types/database').CourseMapMonth[];
}
export async function listLessonProgressFor(enrollmentId: string): Promise<LessonProgress[]> {
  return must(await sb().from('lesson_progress').select('*').eq('enrollment_id', enrollmentId)) as LessonProgress[];
}
export async function listQuizAttemptsFor(enrollmentId?: string, courseId?: string): Promise<(QuizAttempt & { quiz: Pick<Quiz, 'id' | 'title' | 'month_id'>; enrollment?: { user_id: string; student: PublicProfile } })[]> {
  let q = sb().from('quiz_attempts').select('*, quiz:quizzes(id, title, month_id), enrollment:enrollments(user_id, course_id, student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path))').order('started_at', { ascending: false }).limit(300);
  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId);
  const rows = must(await q) as (QuizAttempt & { quiz: Pick<Quiz, 'id' | 'title' | 'month_id'>; enrollment?: { user_id: string; course_id: string; student: PublicProfile } })[];
  return courseId ? rows.filter((r) => r.enrollment?.course_id === courseId) : rows;
}

// ---------------------------------------------------------------------------
// Payments (admin)
// ---------------------------------------------------------------------------
export interface PaymentRow extends Payment {
  student: PublicProfile & { email?: string };
  enrollment: Pick<Enrollment, 'id' | 'plan_type' | 'course_id' | 'status'> & { course: Pick<Course, 'title'> };
}
export async function listPayments(f: { status?: PaymentStatus | 'review' } = {}): Promise<PaymentRow[]> {
  let q = sb().from('payments').select('*, student:profiles!payments_user_id_fkey(id, full_name, role, avatar_path, email), enrollment:enrollments(id, plan_type, course_id, status, course:courses(title))').order('submitted_at', { ascending: false }).limit(500);
  if (f.status === 'review') q = q.in('status', ['pending', 'under_review']);
  else if (f.status) q = q.eq('status', f.status);
  return must(await q) as PaymentRow[];
}
export async function reviewPayment(paymentId: string, decision: 'confirmed' | 'rejected' | 'under_review', note?: string): Promise<void> {
  must(await sb().rpc('review_payment', { p_payment_id: paymentId, p_decision: decision, p_note: note ?? null }));
}
export async function listPaymentsFor(enrollmentId: string): Promise<Payment[]> {
  return must(await sb().from('payments').select('*').eq('enrollment_id', enrollmentId).order('submitted_at', { ascending: false })) as Payment[];
}
export async function listAllPaymentMethods(): Promise<PaymentMethod[]> {
  return must(await sb().from('payment_methods').select('*').order('position')) as PaymentMethod[];
}
export async function savePaymentMethod(m: Partial<PaymentMethod> & { id: string }): Promise<void> {
  const { id, ...rest } = m;
  must(await sb().from('payment_methods').update(rest).eq('id', id));
}

// ---------------------------------------------------------------------------
// Identity (admin)
// ---------------------------------------------------------------------------
export interface IdentityRow extends IdentitySummary {
  profile?: Pick<Profile, 'full_name' | 'email' | 'nationality'> | null;
}
export async function listIdentities(status?: IdentityStatus): Promise<IdentityRow[]> {
  // admin-only SECURITY DEFINER function (masked numbers, ordered by submission)
  const rows = must(await sb().rpc('admin_list_identities', { p_status: status ?? null })) as IdentityRow[];
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.user_id);
  const profiles = must(await sb().from('profiles').select('id, full_name, email, nationality').in('id', ids)) as (Pick<Profile, 'full_name' | 'email' | 'nationality'> & { id: string })[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
}
export async function listIdentityDocumentsFor(userId: string): Promise<IdentityDocument[]> {
  return must(await sb().from('identity_documents').select('*').eq('user_id', userId).is('deleted_at', null)) as IdentityDocument[];
}
export async function reviewIdentity(verificationId: string, decision: 'verified' | 'rejected', reason?: string): Promise<void> {
  must(await sb().rpc('review_identity', { p_verification_id: verificationId, p_decision: decision, p_reason: reason ?? null }));
}
/** Audited reveal of the full (decrypted) identification number. Never cache or persist the result. */
export async function revealIdentityNumber(verificationId: string, reason?: string): Promise<string> {
  return must(await sb().rpc('admin_reveal_identity_number', { p_verification_id: verificationId, p_reason: reason ?? 'identity verification review' })) as string;
}
/**
 * Admin access to a private identity document. ONLY through the audited Edge Function
 * (supabase/functions/identity-document-url): it authorises the caller in the database, writes the
 * audit row first and returns a 2-minute signed URL. Storage policies no longer let admins sign
 * identity-document URLs directly, so there is deliberately no fallback.
 */
export async function adminDocumentUrl(documentId: string): Promise<string> {
  const fn = await sb().functions.invoke('identity-document-url', { body: { document_id: documentId } });
  if (fn.error || !fn.data?.url) {
    throw new Error('The document could not be opened. The identity-document service may be unavailable; try again or contact the platform administrator.');
  }
  return fn.data.url as string;
}
export async function adminDeleteIdentityDocument(documentId: string): Promise<void> {
  must(await sb().rpc('delete_identity_document', { p_document_id: documentId }));
}

// ---------------------------------------------------------------------------
// Assessments (trainer/admin)
// ---------------------------------------------------------------------------
export interface AssessmentRow extends Assessment {
  month: CourseMonth;
  enrollment: Pick<Enrollment, 'id' | 'user_id' | 'course_id' | 'status'> & { student: PublicProfile; course: Pick<Course, 'title'> };
  trainer?: PublicProfile | null;
}
export async function listAssessments(f: { status?: 'scheduled' | 'completed' | 'cancelled'; reassessment?: boolean } = {}): Promise<AssessmentRow[]> {
  let q = sb().from('assessments').select('*, month:course_months(*), enrollment:enrollments(id, user_id, course_id, status, student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path), course:courses(title)), trainer:profiles!assessments_trainer_id_fkey(id, full_name, role, avatar_path)').order('scheduled_at', { ascending: true, nullsFirst: false }).limit(500);
  if (f.status) q = q.eq('status', f.status);
  if (f.reassessment !== undefined) q = q.eq('is_reassessment', f.reassessment);
  return must(await q) as AssessmentRow[];
}
export async function listAssessmentsFor(enrollmentId: string): Promise<(Assessment & { month: CourseMonth })[]> {
  return must(await sb().from('assessments').select('*, month:course_months(*)').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false })) as (Assessment & { month: CourseMonth })[];
}
export async function listAssessmentAttemptsFor(enrollmentId: string): Promise<(AssessmentAttempt & { month: CourseMonth })[]> {
  return must(await sb().from('assessment_attempts').select('*, month:course_months(*)').eq('enrollment_id', enrollmentId).order('assessed_at', { ascending: false })) as (AssessmentAttempt & { month: CourseMonth })[];
}
export async function scheduleAssessment(input: { enrollmentId: string; monthId: string; scheduledAt: string | null; trainerId?: string | null; notes?: string }): Promise<string> {
  return must(await sb().rpc('schedule_assessment', { p_enrollment_id: input.enrollmentId, p_month_id: input.monthId, p_scheduled_at: input.scheduledAt, p_trainer_id: input.trainerId ?? null, p_notes: input.notes ?? null })) as string;
}
export async function recordAssessment(input: { assessmentId: string; score: number | null; result: AssessmentResult; feedback?: string; notes?: string }): Promise<string> {
  return must(await sb().rpc('record_assessment_result', { p_assessment_id: input.assessmentId, p_score: input.score, p_result: input.result, p_feedback: input.feedback ?? null, p_notes: input.notes ?? null })) as string;
}
export async function cancelAssessment(id: string): Promise<void> {
  must(await sb().from('assessments').update({ status: 'cancelled' }).eq('id', id));
}
export async function overrideMonth(enrollmentId: string, monthId: string, reason: string): Promise<string> {
  return must(await sb().rpc('override_month_unlock', { p_enrollment_id: enrollmentId, p_month_id: monthId, p_reason: reason })) as string;
}
export async function revokeOverride(overrideId: string, reason: string): Promise<void> {
  must(await sb().rpc('revoke_month_override', { p_override_id: overrideId, p_reason: reason }));
}
export async function listOverridesFor(enrollmentId: string): Promise<(MonthOverride & { month: CourseMonth })[]> {
  return must(await sb().from('month_overrides').select('*, month:course_months(*)').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false })) as (MonthOverride & { month: CourseMonth })[];
}

// ---------------------------------------------------------------------------
// Courses & curriculum (admin)
// ---------------------------------------------------------------------------
export async function listAllCourses(): Promise<Course[]> {
  return must(await sb().from('courses').select('*').order('created_at')) as Course[];
}
export async function getCourse(id: string): Promise<Course | null> {
  return must(await sb().from('courses').select('*').eq('id', id).maybeSingle()) as Course | null;
}
export async function saveCourse(c: Partial<Course> & { id?: string }): Promise<string> {
  if (c.id) {
    const { id, ...rest } = c;
    must(await sb().from('courses').update(rest).eq('id', id));
    return id;
  }
  const row = must(await sb().from('courses').insert(c).select('id').single()) as { id: string };
  return row.id;
}
export async function listMonths(courseId: string): Promise<CourseMonth[]> {
  return must(await sb().from('course_months').select('*').eq('course_id', courseId).order('month_number')) as CourseMonth[];
}
export async function saveMonth(m: Partial<CourseMonth> & { id?: string }): Promise<void> {
  if (m.id) {
    const { id, ...rest } = m;
    must(await sb().from('course_months').update(rest).eq('id', id));
  } else must(await sb().from('course_months').insert(m));
}
export async function listModules(monthId: string): Promise<(Module & { lessons: Lesson[] })[]> {
  const rows = must(await sb().from('modules').select('*, lessons(*)').eq('month_id', monthId).order('position')) as (Module & { lessons: Lesson[] })[];
  return rows.map((m) => ({ ...m, lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position) }));
}
export async function saveModule(m: Partial<Module> & { id?: string }): Promise<void> {
  if (m.id) {
    const { id, ...rest } = m;
    must(await sb().from('modules').update(rest).eq('id', id));
  } else must(await sb().from('modules').insert(m));
}
export async function deleteModule(id: string): Promise<void> {
  must(await sb().from('modules').delete().eq('id', id));
}
export async function saveLesson(l: Partial<Lesson> & { id?: string }): Promise<void> {
  if (l.id) {
    const { id, ...rest } = l;
    must(await sb().from('lessons').update(rest).eq('id', id));
  } else must(await sb().from('lessons').insert(l));
}
export async function deleteLesson(id: string): Promise<void> {
  must(await sb().from('lessons').delete().eq('id', id));
}
export async function listPractice(monthId: string): Promise<PracticeItem[]> {
  return must(await sb().from('practice_items').select('*').eq('month_id', monthId).order('position')) as PracticeItem[];
}
export async function savePractice(p: Partial<PracticeItem> & { id?: string }): Promise<void> {
  if (p.id) {
    const { id, ...rest } = p;
    must(await sb().from('practice_items').update(rest).eq('id', id));
  } else must(await sb().from('practice_items').insert(p));
}
export async function deletePractice(id: string): Promise<void> {
  must(await sb().from('practice_items').delete().eq('id', id));
}
export async function listQuizzesForMonth(monthId: string): Promise<Quiz[]> {
  return must(await sb().from('quizzes').select('*').eq('month_id', monthId).order('created_at')) as Quiz[];
}
/**
 * Publishing is validated by the database (approved pool, blueprint quotas, question content).
 * A brand-new quiz is created unpublished; if "published" was requested it is then published in a
 * second step so the checklist error names what is missing instead of refusing the whole save.
 */
export async function saveQuiz(q: Partial<Quiz> & { id?: string }): Promise<string> {
  if (q.id) {
    const { id, ...rest } = q;
    must(await sb().from('quizzes').update(rest).eq('id', id));
    return id;
  }
  const { is_published, ...rest } = q;
  const id = (must(await sb().from('quizzes').insert({ ...rest, is_published: false }).select('id').single()) as { id: string }).id;
  if (is_published) must(await sb().from('quizzes').update({ is_published: true }).eq('id', id));
  return id;
}
export async function deleteQuiz(id: string): Promise<void> {
  must(await sb().from('quizzes').delete().eq('id', id));
}
export async function getQuizPublishProblems(quizId: string): Promise<string[]> {
  return (must(await sb().rpc('get_quiz_publish_problems', { p_quiz_id: quizId })) as string[]) ?? [];
}
export async function listQuizQuestionsStaff(quizId: string): Promise<QuizQuestion[]> {
  return must(await sb().rpc('staff_quiz_questions', { p_quiz_id: quizId })) as QuizQuestion[];
}
export async function saveQuizQuestion(q: Partial<QuizQuestion> & { id?: string }): Promise<void> {
  if (q.id) {
    const { id, ...rest } = q;
    must(await sb().from('quiz_questions').update(rest).eq('id', id));
  } else must(await sb().from('quiz_questions').insert(q));
}
/** Questions with student history cannot be deleted (the database refuses); retire them instead. */
export async function deleteQuizQuestion(id: string): Promise<void> {
  must(await sb().from('quiz_questions').delete().eq('id', id));
}
// ---------------------------------------------------------------------------
// Cohorts: settings, application questions, applications review, import (admin)
// ---------------------------------------------------------------------------
export async function listCohortsAdmin(): Promise<(Cohort & { course: Pick<Course, 'id' | 'title' | 'slug'> | null })[]> {
  return must(await sb().from('cohorts').select('*, course:courses(id, title, slug)').order('cohort_number', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })) as (Cohort & { course: Pick<Course, 'id' | 'title' | 'slug'> | null })[];
}
export async function getCohortAdmin(id: string): Promise<(Cohort & { course: Pick<Course, 'id' | 'title' | 'slug'> | null }) | null> {
  return must(await sb().from('cohorts').select('*, course:courses(id, title, slug)').eq('id', id).maybeSingle()) as (Cohort & { course: Pick<Course, 'id' | 'title' | 'slug'> | null }) | null;
}
export async function saveCohortDetails(c: Partial<Cohort> & { id?: string }): Promise<string> {
  if (c.id) {
    const { id, ...rest } = c;
    must(await sb().from('cohorts').update(rest).eq('id', id));
    return id;
  }
  return (must(await sb().from('cohorts').insert(c).select('id').single()) as { id: string }).id;
}
export async function setCohortApplicationsOpen(cohortId: string, open: boolean): Promise<void> {
  must(await sb().rpc('set_cohort_applications_open', { p_cohort_id: cohortId, p_open: open }));
}
export async function markCohortCompleted(cohortId: string, summary?: string | null, participants?: number | null): Promise<void> {
  must(await sb().rpc('mark_cohort_completed', { p_cohort_id: cohortId, p_summary: summary ?? null, p_participants: participants ?? null }));
}
export async function getCohortStats(cohortId: string): Promise<CohortStats> {
  return must(await sb().rpc('staff_cohort_stats', { p_cohort_id: cohortId })) as CohortStats;
}
export async function listCohortQuestions(cohortId: string): Promise<CohortQuestion[]> {
  return must(await sb().from('cohort_questions').select('*').eq('cohort_id', cohortId).order('position').order('created_at')) as CohortQuestion[];
}
export async function saveCohortQuestion(q: Partial<CohortQuestion> & { id?: string }): Promise<void> {
  if (q.id) {
    const { id, ...rest } = q;
    must(await sb().from('cohort_questions').update(rest).eq('id', id));
  } else must(await sb().from('cohort_questions').insert(q));
}
export async function deleteCohortQuestion(id: string): Promise<void> {
  must(await sb().from('cohort_questions').delete().eq('id', id));
}
export async function seedDefaultCohortQuestions(cohortId: string): Promise<number> {
  return (must(await sb().rpc('seed_default_cohort_questions', { p_cohort_id: cohortId })) as number) ?? 0;
}
export async function copyCohortQuestions(fromCohortId: string, toCohortId: string): Promise<number> {
  return (must(await sb().rpc('copy_cohort_questions', { p_from_cohort: fromCohortId, p_to_cohort: toCohortId })) as number) ?? 0;
}
export async function listCohortApplications(cohortId: string, status?: CohortApplicationStatus | null): Promise<CohortApplication[]> {
  let q = sb().from('cohort_applications').select('*').eq('cohort_id', cohortId).order('submitted_at', { ascending: false }).limit(1000);
  if (status) q = q.eq('status', status);
  return must(await q) as CohortApplication[];
}
export async function getCohortApplication(id: string): Promise<(CohortApplication & { events: CohortApplicationEvent[] }) | null> {
  const app = must(await sb().from('cohort_applications').select('*').eq('id', id).maybeSingle()) as CohortApplication | null;
  if (!app) return null;
  const events = must(await sb().from('cohort_application_events').select('*').eq('application_id', id).order('created_at')) as CohortApplicationEvent[];
  return { ...app, events };
}
export type CohortReviewDecision = 'review' | 'accept' | 'waitlist' | 'reject' | 'reopen' | 'withdraw';
export async function reviewCohortApplication(id: string, decision: CohortReviewDecision, note?: string | null): Promise<void> {
  must(await sb().rpc('review_cohort_application', { p_application_id: id, p_decision: decision, p_note: note ?? null }));
}
export async function setCohortApplicationNotes(id: string, notes: string): Promise<void> {
  must(await sb().rpc('set_cohort_application_notes', { p_application_id: id, p_notes: notes }));
}
export async function assignApplicationEnrollment(applicationId: string, enrollmentId: string): Promise<void> {
  must(await sb().rpc('assign_application_enrollment', { p_application_id: applicationId, p_enrollment_id: enrollmentId }));
}
export interface CohortImportRow {
  full_name: string;
  email: string;
  phone?: string | null;
  delivery_mode: 'online' | 'physical' | 'hybrid';
  submitted_at?: string | null;
  external_ref?: string | null;
  answers?: Record<string, string>;
}
/** Dry-run by default. Never accepts or enrolls; duplicates are reported, not overwritten. */
export async function importCohortApplications(cohortId: string, rows: CohortImportRow[], dryRun = true): Promise<CohortImportResult> {
  return must(await sb().rpc('import_cohort_applications', { p_cohort_id: cohortId, p_rows: rows as unknown as Json, p_dry_run: dryRun })) as CohortImportResult;
}
export async function sendCohortStartReminder(cohortId: string, message?: string | null): Promise<number> {
  return (must(await sb().rpc('send_cohort_start_reminder', { p_cohort_id: cohortId, p_message: message ?? null })) as number) ?? 0;
}

export type QuestionReviewDecision = 'approve' | 'reject' | 'retire' | 'draft';
export async function reviewQuizQuestion(id: string, decision: QuestionReviewDecision, note?: string | null): Promise<void> {
  must(await sb().rpc('review_quiz_question', { p_question_id: id, p_decision: decision, p_note: note ?? null }));
}
export async function previewQuizSelection(quizId: string): Promise<QuizSelectionPreview> {
  return must(await sb().rpc('preview_quiz_selection', { p_quiz_id: quizId })) as QuizSelectionPreview;
}
export async function getQuizStats(quizId: string): Promise<QuizStats> {
  return must(await sb().rpc('staff_quiz_stats', { p_quiz_id: quizId })) as QuizStats;
}
export async function getQuestionStats(quizId: string): Promise<QuestionStats[]> {
  return (must(await sb().rpc('staff_question_stats', { p_quiz_id: quizId })) as QuestionStats[]) ?? [];
}
export async function getQuizAttemptDetail(attemptId: string): Promise<QuizAttemptDetail> {
  return must(await sb().rpc('staff_quiz_attempt_detail', { p_attempt_id: attemptId })) as QuizAttemptDetail;
}
export interface ImportedQuestion {
  prompt: string;
  question_type?: QuestionType;
  options: McOption[] | MatchingOptions;
  correct_answer: Json;
  explanation?: string | null;
  points?: number;
  topic?: string | null;
  difficulty?: QuestionDifficulty;
  learning_objective?: string | null;
  video_path?: string | null;
  video_url?: string | null;
}
/** Rows become drafts; every row is validated server-side and skipped rows come back with reasons. */
export async function importQuizQuestions(quizId: string, rows: ImportedQuestion[]): Promise<{ imported: number; skipped: { prompt: string; reason: string }[] }> {
  return must(await sb().rpc('import_quiz_questions', { p_quiz_id: quizId, p_questions: rows as unknown as Json })) as { imported: number; skipped: { prompt: string; reason: string }[] };
}
export async function listQuizGenerationRuns(quizId: string): Promise<QuizGenerationRun[]> {
  return (must(await sb().rpc('list_quiz_generation_runs', { p_quiz_id: quizId })) as QuizGenerationRun[]) ?? [];
}
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI question generation is not configured.');
    this.name = 'AiNotConfiguredError';
  }
}
/**
 * Asks the Edge Function to draft questions from approved MCSLI material. Drafts land in the bank
 * as status "draft" and need a human decision; nothing here is student-visible.
 */
export async function generateQuestionDrafts(input: { quizId: string; count: number; difficultyMix?: Partial<Record<QuestionDifficulty, number>>; lessonIds?: string[] | null; includePractice?: boolean }): Promise<{ run_id: string; status: string; generated: number; dropped: number; message?: string }> {
  const res = await sb().functions.invoke('generate-question-drafts', {
    body: { quiz_id: input.quizId, requested_count: input.count, difficulty_mix: input.difficultyMix ?? {}, lesson_ids: input.lessonIds ?? null, include_practice: input.includePractice ?? true },
  });
  const data = (res.data ?? null) as { run_id?: string; status?: string; generated?: number; dropped?: number; message?: string; error?: string } | null;
  if (res.error) {
    const ctx = (res.error as { context?: Response }).context;
    let body: { error?: string; status?: string; message?: string } | null = null;
    try {
      body = ctx ? await ctx.clone().json() : null;
    } catch {
      body = null;
    }
    if (body?.status === 'not_configured' || ctx?.status === 503) throw new AiNotConfiguredError();
    throw new Error(body?.message ?? body?.error ?? res.error.message);
  }
  if (data?.status === 'not_configured') throw new AiNotConfiguredError();
  return { run_id: data?.run_id ?? '', status: data?.status ?? 'failed', generated: data?.generated ?? 0, dropped: data?.dropped ?? 0, message: data?.message };
}
/** Upload lesson/practice media to the private course-media bucket (admin only via storage RLS). */
export async function uploadCourseMedia(file: File, prefix: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const res = await sb().storage.from('course-media').upload(path, file, { contentType: file.type, upsert: false });
  if (res.error) throw res.error;
  return path;
}

// ---------------------------------------------------------------------------
// Cohorts & trainer assignments
// ---------------------------------------------------------------------------
export async function listCohorts(courseId?: string): Promise<Cohort[]> {
  let q = sb().from('cohorts').select('*').order('created_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  return must(await q) as Cohort[];
}
export async function saveCohort(c: Partial<Cohort> & { id?: string }): Promise<void> {
  if (c.id) {
    const { id, ...rest } = c;
    must(await sb().from('cohorts').update(rest).eq('id', id));
  } else must(await sb().from('cohorts').insert(c));
}
export async function listTrainerAssignments(): Promise<(TrainerAssignment & { trainer: PublicProfile; course: Pick<Course, 'id' | 'title'>; cohort?: Pick<Cohort, 'id' | 'name'> | null })[]> {
  return must(await sb().from('trainer_assignments').select('*, trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name, role, avatar_path), course:courses(id, title), cohort:cohorts(id, name)').order('created_at', { ascending: false })) as (TrainerAssignment & { trainer: PublicProfile; course: Pick<Course, 'id' | 'title'>; cohort?: Pick<Cohort, 'id' | 'name'> | null })[];
}
export async function addTrainerAssignment(input: { trainerId: string; courseId: string; cohortId?: string | null; canGradeExams?: boolean; canModerate?: boolean }): Promise<void> {
  must(await sb().from('trainer_assignments').insert({ trainer_id: input.trainerId, course_id: input.courseId, cohort_id: input.cohortId ?? null, can_grade_exams: input.canGradeExams ?? true, can_moderate: input.canModerate ?? true }));
}
export async function removeTrainerAssignment(id: string): Promise<void> {
  must(await sb().from('trainer_assignments').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Exams (staff)
// ---------------------------------------------------------------------------
export async function listExamsStaff(courseId?: string): Promise<(Exam & { course: Pick<Course, 'title'> })[]> {
  let q = sb().from('exams').select('*, course:courses(title)').order('created_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  return must(await q) as (Exam & { course: Pick<Course, 'title'> })[];
}
export async function getExamStaff(id: string): Promise<(Exam & { course: Pick<Course, 'title'> }) | null> {
  return must(await sb().from('exams').select('*, course:courses(title)').eq('id', id).maybeSingle()) as (Exam & { course: Pick<Course, 'title'> }) | null;
}
export async function saveExam(x: Partial<Exam> & { id?: string }): Promise<string> {
  if (x.id) {
    const { id, ...rest } = x;
    must(await sb().from('exams').update(rest).eq('id', id));
    return id;
  }
  return (must(await sb().from('exams').insert(x).select('id').single()) as { id: string }).id;
}
export async function listExamQuestionsStaff(examId: string): Promise<ExamQuestion[]> {
  return must(await sb().rpc('staff_exam_questions', { p_exam_id: examId })) as ExamQuestion[];
}
export async function saveExamQuestion(q: Partial<ExamQuestion> & { id?: string }): Promise<void> {
  if (q.id) {
    const { id, ...rest } = q;
    must(await sb().from('exam_questions').update(rest).eq('id', id));
  } else must(await sb().from('exam_questions').insert(q));
}
export async function deleteExamQuestion(id: string): Promise<void> {
  must(await sb().from('exam_questions').delete().eq('id', id));
}
export interface ExamAttemptRow extends ExamAttempt {
  student?: PublicProfile;
}
export async function listExamAttemptsStaff(examId?: string, enrollmentId?: string): Promise<ExamAttemptRow[]> {
  const rows = must(await sb().rpc('staff_exam_attempts', { p_exam_id: examId ?? null, p_enrollment_id: enrollmentId ?? null })) as ExamAttemptRow[];
  if (!rows.length) return rows;
  const enrollmentIds = Array.from(new Set(rows.map((r) => r.enrollment_id)));
  const enr = must(await sb().from('enrollments').select('id, student:profiles!enrollments_user_id_fkey(id, full_name, role, avatar_path)').in('id', enrollmentIds)) as unknown as { id: string; student: PublicProfile }[];
  const byId = new Map(enr.map((e) => [e.id, e.student]));
  return rows.map((r) => ({ ...r, student: byId.get(r.enrollment_id) }));
}
export async function gradeExamAttempt(attemptId: string, manualScores: Record<string, number>, feedback?: string): Promise<void> {
  must(await sb().rpc('grade_exam_attempt', { p_attempt_id: attemptId, p_manual_scores: manualScores, p_feedback: feedback ?? null }));
}
export async function releaseExamResults(examId: string): Promise<number> {
  return must(await sb().rpc('release_exam_results', { p_exam_id: examId })) as number;
}

// ---------------------------------------------------------------------------
// Certificates (admin)
// ---------------------------------------------------------------------------
export async function listCertificates(): Promise<(Certificate & { student?: PublicProfile })[]> {
  return must(await sb().from('certificates').select('*, student:profiles!certificates_user_id_fkey(id, full_name, role, avatar_path)').order('issued_at', { ascending: false })) as (Certificate & { student?: PublicProfile })[];
}
export async function issueCertificate(enrollmentId: string, completionDate?: string): Promise<string> {
  return must(await sb().rpc('issue_certificate', { p_enrollment_id: enrollmentId, p_completion_date: completionDate ?? new Date().toISOString().slice(0, 10) })) as string;
}
export async function revokeCertificate(id: string, reason: string): Promise<void> {
  must(await sb().rpc('revoke_certificate', { p_certificate_id: id, p_reason: reason }));
}
export async function reissueCertificate(id: string, reason: string, studentName?: string): Promise<string> {
  return must(await sb().rpc('reissue_certificate', { p_certificate_id: id, p_reason: reason, p_student_name: studentName ?? null })) as string;
}
export async function certificateEligibility(enrollmentId: string): Promise<{ eligible: boolean; missing: string[] }> {
  return must(await sb().rpc('get_certificate_eligibility', { p_enrollment_id: enrollmentId })) as { eligible: boolean; missing: string[] };
}

// ---------------------------------------------------------------------------
// Content, settings, audit, contact messages, events, reports
// ---------------------------------------------------------------------------
export async function listSiteContent(): Promise<SiteContentRow[]> {
  return must(await sb().from('site_content').select('*')) as SiteContentRow[];
}
export async function setSiteContent(key: string, value: Json, isPublic = true): Promise<void> {
  must(await sb().rpc('set_site_content', { p_key: key, p_value: value, p_public: isPublic }));
}
export async function listSettings(): Promise<PlatformSettingRow[]> {
  return must(await sb().from('platform_settings').select('*')) as PlatformSettingRow[];
}
export async function setSetting(key: string, value: Json): Promise<void> {
  must(await sb().rpc('set_platform_setting', { p_key: key, p_value: value }));
}
export async function listAudit(f: { page?: number; pageSize?: number; action?: string; targetUserId?: string } = {}): Promise<{ rows: AuditLog[]; count: number }> {
  const pageSize = f.pageSize ?? 50;
  const page = f.page ?? 1;
  let q = sb().from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(id, full_name, role, avatar_path), target:profiles!audit_logs_target_user_id_fkey(id, full_name, role, avatar_path)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (f.action) q = q.ilike('action', `${f.action}%`);
  if (f.targetUserId) q = q.eq('target_user_id', f.targetUserId);
  const res = await q;
  if (res.error) throw res.error;
  return { rows: (res.data ?? []) as AuditLog[], count: res.count ?? 0 };
}
export async function listContactMessages(status?: 'new' | 'read' | 'archived'): Promise<ContactMessage[]> {
  let q = sb().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  return must(await q) as ContactMessage[];
}
export async function setContactMessageStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<void> {
  must(await sb().from('contact_messages').update({ status }).eq('id', id));
}
export async function listAllEvents(): Promise<EventRow[]> {
  return must(await sb().from('events').select('*').order('starts_at', { ascending: false })) as EventRow[];
}
export async function saveEvent(e: Partial<EventRow> & { id?: string }): Promise<void> {
  if (e.id) {
    const { id, ...rest } = e;
    must(await sb().from('events').update(rest).eq('id', id));
  } else must(await sb().from('events').insert(e));
}
export async function deleteEvent(id: string): Promise<void> {
  must(await sb().from('events').delete().eq('id', id));
}
export async function listReports(): Promise<(DiscussionReport & { reporter?: PublicProfile })[]> {
  return must(await sb().from('discussion_reports').select('*, reporter:profiles!discussion_reports_reporter_id_fkey(id, full_name, role, avatar_path)').eq('status', 'open').order('created_at')) as (DiscussionReport & { reporter?: PublicProfile })[];
}
export async function dismissReport(id: string): Promise<void> {
  must(await sb().from('discussion_reports').update({ status: 'dismissed' }).eq('id', id));
}

// ---------------------------------------------------------------------------
// Staff invitations (ADMIN / TRAINER)
// ---------------------------------------------------------------------------
export interface StaffInvitation {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'TRAINER';
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  invited_by: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
}
export interface InviteResult {
  invitation_id: string;
  email_sent: boolean;
  email_error?: string;
}
/**
 * Creates the invitation and sends the e-mail through the invite-staff Edge Function. The
 * single-use token never reaches the browser: it is generated in the database and put only into
 * the e-mailed link.
 */
export async function inviteStaff(input: { email: string; fullName: string; role: 'ADMIN' | 'TRAINER' }): Promise<InviteResult> {
  const res = await sb().functions.invoke('invite-staff', { body: { email: input.email.trim(), full_name: input.fullName.trim(), role: input.role } });
  if (res.error) {
    // FunctionsHttpError: surface the database's human-readable refusal when available
    const ctx = (res.error as { context?: Response }).context;
    let message = 'The invitation could not be sent.';
    try {
      const body = ctx ? await ctx.json() : null;
      if (body?.error && typeof body.error === 'string' && body.error.length < 200) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message.charAt(0).toUpperCase() + message.slice(1));
  }
  return res.data as InviteResult;
}
export async function listStaffInvitations(): Promise<StaffInvitation[]> {
  return must(await sb().rpc('list_staff_invitations')) as StaffInvitation[];
}
export async function cancelStaffInvitation(id: string): Promise<void> {
  must(await sb().rpc('cancel_staff_invitation', { p_invitation_id: id }));
}
export async function listStaffAccounts(): Promise<Profile[]> {
  return must(await sb().from('profiles').select('*').in('role', ['SUPER_ADMIN', 'ADMIN', 'TRAINER']).order('role').order('full_name')) as Profile[];
}

// ---------------------------------------------------------------------------
// AI training review queue
// ---------------------------------------------------------------------------
export async function listAiTrainingAssets(): Promise<AiTrainingAsset[]> {
  return must(
    await sb()
      .from('ai_training_assets')
      .select('*')
      .eq('active', true)
      .order('training_approved', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(1000),
  ) as AiTrainingAsset[];
}

export async function reviewAiTrainingAsset(
  id: string,
  patch: Partial<Pick<AiTrainingAsset, 'signer_consent_confirmed' | 'training_rights_confirmed' | 'quality_status' | 'training_approved' | 'notes'>>,
): Promise<void> {
  const { data } = await sb().auth.getUser();
  const reviewedBy = data.user?.id ?? null;
  must(
    await sb()
      .from('ai_training_assets')
      .update({ ...patch, reviewed_by: reviewedBy, updated_at: new Date().toISOString() })
      .eq('id', id),
  );
}

// ---------------------------------------------------------------------------
// Curriculum publishing
// ---------------------------------------------------------------------------
export async function getCoursePublishProblems(courseId: string): Promise<string[]> {
  return (must(await sb().rpc('get_course_publish_problems', { p_course_id: courseId })) as string[] | null) ?? [];
}

/** Allowed course-media uploads (mirrors the bucket's allowed MIME types). */
export const COURSE_MEDIA_TYPES: Record<string, string[]> = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  captions: ['text/vtt'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
};
export function validateCourseMedia(file: File, kind: keyof typeof COURSE_MEDIA_TYPES, maxBytes: number): string | null {
  const type = file.type || (file.name.toLowerCase().endsWith('.vtt') ? 'text/vtt' : '');
  if (!COURSE_MEDIA_TYPES[kind]!.includes(type)) {
    return kind === 'video' ? 'Upload an MP4 (H.264), WebM or MOV video.' : kind === 'captions' ? 'Captions must be a WebVTT (.vtt) file.' : 'Upload a JPEG, PNG or WebP image.';
  }
  if (file.size > maxBytes) return `This file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit. Compress it (e.g. 720p H.264) and try again.`;
  return null;
}
