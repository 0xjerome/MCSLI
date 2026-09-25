import { useQuery } from '@tanstack/react-query';
import { listMyEnrollments, getCourseMap, type EnrollmentWithCourse } from '@/services/student';
import type { CourseMapMonth } from '@/types/database';

export const enrollmentKeys = {
  list: ['my-enrollments'] as const,
  map: (id: string) => ['course-map', id] as const,
};

/** The student's current (most recent) enrollment, if any. */
export function useMyEnrollment() {
  const q = useQuery({ queryKey: enrollmentKeys.list, queryFn: listMyEnrollments });
  const enrollment: EnrollmentWithCourse | null = q.data?.[0] ?? null;
  return { enrollment, enrollments: q.data ?? [], isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useCourseMap(enrollmentId: string | null | undefined) {
  return useQuery({ queryKey: enrollmentKeys.map(enrollmentId ?? ''), queryFn: () => getCourseMap(enrollmentId!), enabled: Boolean(enrollmentId) });
}

/** Derived helpers over the course map. */
export function summarise(map: CourseMapMonth[] | undefined) {
  const months = map ?? [];
  const unlocked = months.filter((m) => m.access.allowed);
  const current = [...unlocked].reverse().find((m) => m.assessment_result !== 'pass') ?? unlocked[unlocked.length - 1] ?? null;
  const nextLocked = months.find((m) => !m.access.allowed) ?? null;
  const lessonsTotal = months.reduce((a, m) => a + Number(m.lessons_total), 0);
  const lessonsDone = months.reduce((a, m) => a + Number(m.lessons_completed), 0);
  const quizzesTotal = months.reduce((a, m) => a + Number(m.quizzes_total), 0);
  const quizzesPassed = months.reduce((a, m) => a + Number(m.quizzes_passed), 0);
  const monthsPassed = months.filter((m) => m.assessment_result === 'pass').length;
  const weight = lessonsTotal + quizzesTotal + months.length;
  const overall = weight ? Math.round(((lessonsDone + quizzesPassed + monthsPassed) / weight) * 100) : 0;
  return { months, unlocked, current, nextLocked, lessonsTotal, lessonsDone, quizzesTotal, quizzesPassed, monthsPassed, overall };
}
