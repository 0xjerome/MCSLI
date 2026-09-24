import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { listQuizzes, listQuizAttempts } from '@/services/student';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

export default function QuizzesPage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const unlockedIds = (map.data ?? []).filter((m) => m.access.allowed).map((m) => m.id);
  const quizzes = useQuery({ queryKey: ['quizzes', unlockedIds.join(',')], queryFn: () => listQuizzes(unlockedIds), enabled: unlockedIds.length > 0 });
  const attempts = useQuery({ queryKey: ['quiz-attempts', enrollment?.id], queryFn: () => listQuizAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  usePageMeta({ title: 'Quizzes', noIndex: true });

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;

  const byMonth = (map.data ?? []).filter((m) => m.access.allowed);

  return (
    <>
      <PageHeader eyebrow="Quizzes" title="Quizzes" description="Check your understanding after each module. You can retry until you reach the passing score (unless a quiz limits attempts)." />
      {byMonth.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Quizzes open with Month 1" />
      ) : (
        <div className="space-y-8">
          {byMonth.map((m) => {
            const list = (quizzes.data ?? []).filter((q) => q.month_id === m.id);
            return (
              <section key={m.id} aria-labelledby={`m-${m.id}`}>
                <h2 id={`m-${m.id}`} className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                  Month {m.month_number} · {m.title}
                </h2>
                {list.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-500">No quizzes published for this month yet.</p>
                ) : (
                  <ul className="mt-3 grid gap-3 md:grid-cols-2">
                    {list.map((q) => {
                      const mine = (attempts.data ?? []).filter((a) => a.quiz_id === q.id);
                      const best = mine.reduce((b, a) => Math.max(b, a.score), 0);
                      const passed = mine.some((a) => a.passed);
                      const exhausted = q.max_attempts != null && mine.length >= q.max_attempts && !passed;
                      return (
                        <li key={q.id}>
                          <Link to={`/app/quizzes/${q.id}`} className="card flex items-start gap-3 p-4 hover:shadow-raised">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
                              <ListChecks className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-ink-900">{q.title}</span>
                                {passed ? <Badge tone="success" size="sm">Passed · {best}%</Badge> : exhausted ? <Badge tone="danger" size="sm">No attempts left</Badge> : mine.length ? <Badge tone="warning" size="sm">Best {best}%</Badge> : <Badge size="sm">Not attempted</Badge>}
                              </span>
                              <span className="mt-1 block text-xs text-ink-500">
                                {mine.length} attempt{mine.length === 1 ? '' : 's'}
                                {q.max_attempts ? ` of ${q.max_attempts}` : ''}
                                {mine[0] ? ` · last ${formatDate(mine[0].submitted_at)}` : ''}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
