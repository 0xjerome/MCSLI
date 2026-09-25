import { Link, Navigate } from 'react-router-dom';
import { Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState } from '@/components/ui/Misc';
import { ProgressBar } from '@/components/ui/Progress';
import { AssessmentResultBadge } from '@/components/StatusBadges';
import { LockedCard } from '@/components/LockedCard';
import { Badge } from '@/components/ui/Badge';
import type { LockReason } from '@/domain/types';

/** Course overview: every month with its lock state and completion. */
export default function CoursePage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  usePageMeta({ title: enrollment?.course.title ?? 'My course', noIndex: true });

  if (isLoading || (enrollment && map.isLoading)) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="My course" title={enrollment.course.title} description={enrollment.course.short_description ?? undefined} />
      <ol className="space-y-4">
        {(map.data ?? []).map((m) => {
          const lessonsPct = m.lessons_total ? Math.round((Number(m.lessons_completed) / Number(m.lessons_total)) * 100) : 0;
          const quizzesPct = m.quizzes_total ? Math.round((Number(m.quizzes_passed) / Number(m.quizzes_total)) * 100) : 0;
          if (!m.access.allowed) {
            return (
              <li key={m.id}>
                <div className="rounded-2xl border border-ink-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-500" aria-hidden="true">
                      <Lock className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Month {m.month_number}</p>
                      <h2 className="font-semibold text-ink-900">{m.title}</h2>
                    </div>
                  </div>
                  <LockedCard title={`Month ${m.month_number}`} reasons={m.access.reasons as LockReason[]} compact className="mt-4" />
                </div>
              </li>
            );
          }
          return (
            <li key={m.id}>
              <Link to={`/app/course/${enrollment.course_id}/month/${m.id}`} className="card group block p-5 transition-shadow hover:shadow-raised">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${m.assessment_result === 'pass' ? 'bg-success-50 text-success-700' : 'bg-brand-600 text-white'}`} aria-hidden="true">
                    {m.assessment_result === 'pass' ? <CheckCircle2 className="h-5 w-5" /> : m.month_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Month {m.month_number}</p>
                      {m.access.overridden && <Badge tone="warning" size="sm">Unlocked by MCSLI</Badge>}
                      <span className="ml-auto">
                        <AssessmentResultBadge result={m.assessment_result} size="sm" />
                      </span>
                    </div>
                    <h2 className="mt-0.5 font-semibold text-ink-900 group-hover:underline">{m.title}</h2>
                    {m.description && <p className="mt-1 text-sm text-ink-600">{m.description}</p>}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <ProgressBar value={lessonsPct} label={`Lessons ${m.lessons_completed}/${m.lessons_total}`} size="sm" />
                      <ProgressBar value={quizzesPct} label={`Quizzes passed ${m.quizzes_passed}/${m.quizzes_total}`} size="sm" tone="accent" />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" aria-hidden="true" />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
