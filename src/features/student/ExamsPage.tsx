import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Clock, ArrowRight } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment } from './useEnrollment';
import { listExams, listMyExamAttempts } from '@/services/student';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { ExamStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { Exam } from '@/types/database';

export function examIsOpen(x: Exam): boolean {
  const now = Date.now();
  if (x.status === 'open') return true;
  if (x.status !== 'scheduled') return false;
  const opens = x.opens_at ? new Date(x.opens_at).getTime() : Infinity;
  const closes = x.closes_at ? new Date(x.closes_at).getTime() : Infinity;
  return opens <= now && closes > now;
}

export default function ExamsPage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const exams = useQuery({ queryKey: ['exams', enrollment?.course_id], queryFn: () => listExams(enrollment!.course_id), enabled: Boolean(enrollment) });
  const attempts = useQuery({ queryKey: ['my-exam-attempts', enrollment?.id], queryFn: () => listMyExamAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  usePageMeta({ title: 'Examinations', noIndex: true });

  if (isLoading || exams.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (exams.isError) return <ErrorState onRetry={() => exams.refetch()} />;

  const list = exams.data ?? [];

  return (
    <>
      <PageHeader eyebrow="Examinations" title="Online examinations" description="Timed examinations set by MCSLI. Practical questions are graded by your trainer; results are released together." />
      {list.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No examinations available yet" description="Examinations appear here when MCSLI schedules them for your course and you have unlocked the relevant month." />
      ) : (
        <ul className="space-y-4">
          {list.map((x) => {
            const mine = (attempts.data ?? []).filter((a) => a.exam_id === x.id);
            const inProgress = mine.find((a) => a.status === 'in_progress');
            const released = mine.find((a) => a.results_released_at);
            const open = examIsOpen(x);
            const canStart = open && (inProgress || mine.length < x.max_attempts);
            return (
              <li key={x.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink-900">{x.title}</h2>
                      {x.is_final && <Badge tone="brand" size="sm">Final</Badge>}
                      <ExamStatusBadge status={open && x.status === 'scheduled' ? 'open' : x.status} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
                      {x.time_limit_minutes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" aria-hidden="true" /> {x.time_limit_minutes} minutes
                        </span>
                      )}
                      <span>Pass mark {x.passing_score}%</span>
                      <span>
                        {mine.length}/{x.max_attempts} attempts used
                      </span>
                      {x.opens_at && <span>Opens {formatDateTime(x.opens_at)}</span>}
                      {x.closes_at && <span>Closes {formatDateTime(x.closes_at)}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    {released ? (
                      <div>
                        <p className="text-sm text-ink-500">Result</p>
                        <p className={`font-display text-2xl font-bold ${released.passed ? 'text-success-700' : 'text-danger-700'}`}>{Number(released.total_score)}%</p>
                        <p className="text-xs font-semibold">{released.passed ? 'Passed' : 'Not passed'}</p>
                      </div>
                    ) : mine.length > 0 ? (
                      <Badge tone="info">Awaiting results</Badge>
                    ) : null}
                  </div>
                </div>
                {canStart && (
                  <Link to={`/app/exams/${x.id}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                    {inProgress ? 'Resume examination' : 'Start examination'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                {released?.grader_feedback && <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">Trainer feedback: {released.grader_feedback}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
