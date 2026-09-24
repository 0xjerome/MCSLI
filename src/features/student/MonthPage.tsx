import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, PlayCircle, ListChecks, Hand, ClipboardCheck, Clock } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { listModulesWithLessons, listLessonProgress, listQuizzes, listQuizAttempts, listPracticeItems } from '@/services/student';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, Breadcrumb, EmptyState } from '@/components/ui/Misc';
import { Card, CardHeader } from '@/components/ui/Card';
import { LockedCard } from '@/components/LockedCard';
import { AssessmentResultBadge } from '@/components/StatusBadges';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDuration } from '@/lib/utils';
import type { LockReason } from '@/domain/types';

export default function MonthPage() {
  const { monthId = '', courseId = '' } = useParams();
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const month = map.data?.find((m) => m.id === monthId);
  const allowed = Boolean(month?.access.allowed);
  const modules = useQuery({ queryKey: ['modules', monthId], queryFn: () => listModulesWithLessons(monthId), enabled: allowed });
  const progress = useQuery({ queryKey: ['lesson-progress', enrollment?.id], queryFn: () => listLessonProgress(enrollment!.id), enabled: Boolean(enrollment) && allowed });
  const quizzes = useQuery({ queryKey: ['quizzes', monthId], queryFn: () => listQuizzes([monthId]), enabled: allowed });
  const attempts = useQuery({ queryKey: ['quiz-attempts', enrollment?.id], queryFn: () => listQuizAttempts(enrollment!.id), enabled: Boolean(enrollment) && allowed });
  const practice = useQuery({ queryKey: ['practice', monthId], queryFn: () => listPracticeItems(monthId), enabled: allowed });
  usePageMeta({ title: month ? month.title : 'Month', noIndex: true });

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;
  if (!month) return <ErrorState title="Month not found" description="This month does not belong to your course." />;

  if (!allowed) {
    return (
      <>
        <Breadcrumb items={[{ label: 'My course', to: `/app/course/${courseId}` }, { label: `Month ${month.month_number}` }]} className="mb-4" />
        <PageHeader eyebrow={`Month ${month.month_number}`} title={month.title} />
        <LockedCard title={`Month ${month.month_number}`} reasons={month.access.reasons as LockReason[]} />
      </>
    );
  }

  const done = new Set((progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const passedQuiz = new Set((attempts.data ?? []).filter((a) => a.passed).map((a) => a.quiz_id));
  const lessons = (modules.data ?? []).flatMap((m) => m.lessons);
  const nextLesson = lessons.find((l) => !done.has(l.id));
  const allLessonsDone = lessons.length > 0 && lessons.every((l) => done.has(l.id));
  const allQuizzesPassed = (quizzes.data ?? []).every((q) => passedQuiz.has(q.id));

  return (
    <>
      <Breadcrumb items={[{ label: 'My course', to: `/app/course/${courseId}` }, { label: `Month ${month.month_number}` }]} className="mb-4" />
      <PageHeader
        eyebrow={`Month ${month.month_number}`}
        title={month.title}
        description={month.description ?? undefined}
        actions={
          nextLesson ? (
            <ButtonLink to={`/app/lessons/${nextLesson.id}`} leftIcon={<PlayCircle className="h-4 w-4" aria-hidden="true" />}>
              {done.size ? 'Continue' : 'Start'} lessons
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
        <div className="space-y-6">
          {modules.isLoading ? (
            <Skeleton className="h-64" />
          ) : (modules.data ?? []).length === 0 ? (
            <EmptyState title="No lessons published yet" description="MCSLI is preparing this month's content." />
          ) : (
            (modules.data ?? []).map((mod) => (
              <Card key={mod.id} padding="none">
                <div className="border-b border-ink-200 px-5 py-4">
                  <h2 className="font-semibold text-ink-900">{mod.title}</h2>
                  {mod.description && <p className="mt-0.5 text-sm text-ink-600">{mod.description}</p>}
                </div>
                <ol className="divide-y divide-ink-100">
                  {mod.lessons.map((l, i) => {
                    const isDone = done.has(l.id);
                    return (
                      <li key={l.id}>
                        <Link to={`/app/lessons/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                          {isDone ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" aria-label="Completed" /> : <Circle className="h-5 w-5 shrink-0 text-ink-300" aria-label="Not completed" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink-900">
                              {i + 1}. {l.title}
                            </span>
                            {l.duration_seconds ? (
                              <span className="flex items-center gap-1 text-xs text-ink-500">
                                <Clock className="h-3 w-3" aria-hidden="true" /> {formatDuration(l.duration_seconds)}
                              </span>
                            ) : null}
                          </span>
                          <PlayCircle className="h-5 w-5 text-brand-600" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <Card padding="sm" className="p-5">
            <CardHeader title="Month checklist" className="mb-3" />
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                {allLessonsDone ? <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" /> : <Circle className="h-5 w-5 text-ink-300" aria-hidden="true" />}
                Lessons {done.size}/{lessons.length}
              </li>
              <li className="flex items-center gap-2">
                {(practice.data?.length ?? 0) > 0 ? <Hand className="h-5 w-5 text-brand-600" aria-hidden="true" /> : <Circle className="h-5 w-5 text-ink-300" aria-hidden="true" />}
                <Link to="/app/practice" className="hover:underline">
                  Practice signs ({practice.data?.length ?? 0})
                </Link>
              </li>
              <li className="flex items-center gap-2">
                {allQuizzesPassed && (quizzes.data?.length ?? 0) > 0 ? <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" /> : <Circle className="h-5 w-5 text-ink-300" aria-hidden="true" />}
                Quizzes passed {passedQuiz.size}/{quizzes.data?.length ?? 0}
              </li>
              <li className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-ink-400" aria-hidden="true" />
                <span className="flex flex-wrap items-center gap-1">
                  Assessment <AssessmentResultBadge result={month.assessment_result} size="sm" />
                </span>
              </li>
            </ul>
          </Card>

          <Card padding="sm" className="p-5">
            <CardHeader title="Quizzes" className="mb-3" />
            {(quizzes.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-500">No quizzes for this month yet.</p>
            ) : (
              <ul className="space-y-2">
                {(quizzes.data ?? []).map((q) => (
                  <li key={q.id}>
                    <Link to={`/app/quizzes/${q.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-50">
                      <span className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-brand-600" aria-hidden="true" /> {q.title}
                      </span>
                      {passedQuiz.has(q.id) ? <Badge tone="success" size="sm">Passed</Badge> : <Badge size="sm">Open</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
