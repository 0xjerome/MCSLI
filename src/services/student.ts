import { getSupabase } from '@/lib/supabase';
import type {
  Assessment, AssessmentAttempt, Certificate, Course, CourseMapMonth, CourseMonth, Enrollment, Exam, ExamAttemptStudent, ExamQuestionStudent,
  Lesson, LessonProgress, LessonResource, Module, MonthOverride, PracticeItem, Quiz, QuizAttempt, QuizQuestionStudent, QuizResult, Json, Profile,
} from '@/types/database';
import type { PaymentPlanType } from '@/domain/types';

const sb = () => getSupabase();

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------
export interface EnrollmentWithCourse extends Enrollment {
  course: Course;
}

export async function listMyEnrollments(): Promise<EnrollmentWithCourse[]> {
  const res = await sb().from('enrollments').select('*, course:courses(*)').order('created_at', { ascending: false });
  return must(res) as EnrollmentWithCourse[];
}

export async function enrollInCourse(courseId: string, plan: PaymentPlanType, cohortId?: string | null): Promise<string> {
  const res = await sb().rpc('enroll_in_course', { p_course_id: courseId, p_plan: plan, p_cohort_id: cohortId ?? null });
  return must(res) as string;
}

export async function getCourseMap(enrollmentId: string): Promise<CourseMapMonth[]> {
  const res = await sb().rpc('get_my_course_map', { p_enrollment_id: enrollmentId });
  return (must(res) as CourseMapMonth[]) ?? [];
}

export async function listOverrides(enrollmentId: string): Promise<MonthOverride[]> {
  return must(await sb().from('month_overrides').select('*').eq('enrollment_id', enrollmentId).is('revoked_at', null)) as MonthOverride[];
}

// ---------------------------------------------------------------------------
// Curriculum (RLS hides locked content automatically)
// ---------------------------------------------------------------------------
export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export async function getMonth(monthId: string): Promise<CourseMonth | null> {
  return must(await sb().from('course_months').select('*').eq('id', monthId).maybeSingle()) as CourseMonth | null;
}

export async function listCourseMonths(courseId: string): Promise<CourseMonth[]> {
  return must(await sb().from('course_months').select('*').eq('course_id', courseId).order('month_number')) as CourseMonth[];
}

export async function listModulesWithLessons(monthId: string): Promise<ModuleWithLessons[]> {
  const mods = must(await sb().from('modules').select('*, lessons(*)').eq('month_id', monthId).order('position')) as ModuleWithLessons[];
  return mods.map((m) => ({ ...m, lessons: [...(m.lessons ?? [])].filter((l) => l.is_published).sort((a, b) => a.position - b.position) }));
}

export async function getLesson(lessonId: string): Promise<(Lesson & { module: Module & { month: CourseMonth } }) | null> {
  return must(await sb().from('lessons').select('*, module:modules(*, month:course_months(*))').eq('id', lessonId).maybeSingle()) as (Lesson & { module: Module & { month: CourseMonth } }) | null;
}

export async function listLessonResources(lessonId: string): Promise<LessonResource[]> {
  return must(await sb().from('lesson_resources').select('*').eq('lesson_id', lessonId)) as LessonResource[];
}

export async function listLessonProgress(enrollmentId: string): Promise<LessonProgress[]> {
  return must(await sb().from('lesson_progress').select('*').eq('enrollment_id', enrollmentId)) as LessonProgress[];
}

export async function saveLessonProgress(lessonId: string, positionSeconds: number, completed = false): Promise<void> {
  must(await sb().rpc('save_lesson_progress', { p_lesson_id: lessonId, p_position_seconds: Math.floor(positionSeconds), p_completed: completed }));
}

export async function listPracticeItems(monthId?: string): Promise<PracticeItem[]> {
  let q = sb().from('practice_items').select('*').eq('is_published', true).order('position');
  if (monthId) q = q.eq('month_id', monthId);
  return must(await q) as PracticeItem[];
}

/** Signed URL for private course media; passes through public/absolute URLs unchanged. */
export async function resolveMediaUrl(path: string | null | undefined, url: string | null | undefined, bucket = 'course-media'): Promise<string | null> {
  if (url) return url;
  if (!path) return null;
  // Admin media fields allow either a private storage path or a public/absolute URL.
  // Do not send absolute/public URLs to Supabase Storage as object names.
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  const res = await sb().storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (res.error) throw res.error;
  return res.data.signedUrl;
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------
export async function listQuizzes(monthIds?: string[]): Promise<Quiz[]> {
  let q = sb().from('quizzes').select('*').eq('is_published', true);
  if (monthIds?.length) q = q.in('month_id', monthIds);
  return must(await q) as Quiz[];
}

export async function getQuiz(quizId: string): Promise<(Quiz & { month: CourseMonth }) | null> {
  return must(await sb().from('quizzes').select('*, month:course_months(*)').eq('id', quizId).maybeSingle()) as (Quiz & { month: CourseMonth }) | null;
}

export async function listQuizQuestions(quizId: string): Promise<QuizQuestionStudent[]> {
  return must(await sb().from('quiz_questions_student').select('*').eq('quiz_id', quizId).order('position')) as QuizQuestionStudent[];
}

export async function listQuizAttempts(enrollmentId: string, quizId?: string): Promise<QuizAttempt[]> {
  let q = sb().from('quiz_attempts').select('*').eq('enrollment_id', enrollmentId).order('submitted_at', { ascending: false });
  if (quizId) q = q.eq('quiz_id', quizId);
  return must(await q) as QuizAttempt[];
}

export async function submitQuizAttempt(quizId: string, answers: Record<string, Json>): Promise<QuizResult> {
  return must(await sb().rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: answers })) as QuizResult;
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------
export async function listMyAssessments(enrollmentId: string): Promise<(Assessment & { month: CourseMonth })[]> {
  return must(await sb().from('assessments').select('*, month:course_months(*)').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false })) as (Assessment & { month: CourseMonth })[];
}

export async function listMyAssessmentAttempts(enrollmentId: string): Promise<(AssessmentAttempt & { month: CourseMonth })[]> {
  return must(await sb().from('assessment_attempts').select('*, month:course_months(*)').eq('enrollment_id', enrollmentId).order('assessed_at', { ascending: false })) as (AssessmentAttempt & { month: CourseMonth })[];
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export async function listExams(courseId: string): Promise<Exam[]> {
  return must(await sb().from('exams').select('*').eq('course_id', courseId).order('created_at')) as Exam[];
}

export async function getExam(examId: string): Promise<Exam | null> {
  return must(await sb().from('exams').select('*').eq('id', examId).maybeSingle()) as Exam | null;
}

export async function listMyExamAttempts(enrollmentId: string): Promise<ExamAttemptStudent[]> {
  // own attempts only; scores stay null until results are released (enforced server-side)
  return must(await sb().rpc('my_exam_attempts', { p_enrollment_id: enrollmentId })) as ExamAttemptStudent[];
}

export async function listExamQuestions(examId: string): Promise<ExamQuestionStudent[]> {
  return must(await sb().from('exam_questions_student').select('*').eq('exam_id', examId)) as ExamQuestionStudent[];
}

export interface ExamStart {
  attempt_id: string;
  deadline_at: string | null;
  question_order: string[];
  answers: Record<string, Json>;
  resumed: boolean;
}
export async function startExamAttempt(examId: string): Promise<ExamStart> {
  return must(await sb().rpc('start_exam_attempt', { p_exam_id: examId })) as ExamStart;
}
export class ExamTimeUpError extends Error {
  constructor() {
    super('Time is up. Your examination was submitted automatically with the answers saved before the deadline.');
    this.name = 'ExamTimeUpError';
  }
}
/** Autosave. The server refuses answers after the (server-side) deadline and submits the attempt itself. */
export async function saveExamAnswers(attemptId: string, answers: Record<string, Json>): Promise<void> {
  const r = must(await sb().rpc('save_exam_answers', { p_attempt_id: attemptId, p_answers: answers })) as { saved: boolean; reason?: string } | null;
  if (r && !r.saved) throw new ExamTimeUpError();
}
export async function submitExamAttempt(attemptId: string): Promise<{ status: string; needs_manual_grading?: boolean }> {
  return must(await sb().rpc('submit_exam_attempt', { p_attempt_id: attemptId })) as { status: string; needs_manual_grading?: boolean };
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
export async function listMyCertificates(): Promise<Certificate[]> {
  return must(await sb().from('certificates').select('*').order('issued_at', { ascending: false })) as Certificate[];
}

export async function getCertificateEligibility(enrollmentId: string): Promise<{ eligible: boolean; missing: string[] }> {
  return must(await sb().rpc('get_certificate_eligibility', { p_enrollment_id: enrollmentId })) as { eligible: boolean; missing: string[] };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function updateMyProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'country' | 'city' | 'bio' | 'date_of_birth' | 'nationality'>>): Promise<void> {
  const { data: u } = await sb().auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  must(await sb().from('profiles').update(patch).eq('id', u.user.id));
}
