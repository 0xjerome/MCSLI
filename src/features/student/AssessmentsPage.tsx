import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CalendarClock, MessageSquareText } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { listMyAssessments, listMyAssessmentAttempts } from '@/services/student';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { Card, CardHeader } from '@/components/ui/Card';
import { AssessmentResultBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';

export default function AssessmentsPage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const scheduled = useQuery({ queryKey: ['my-assessments', enrollment?.id], queryFn: () => listMyAssessments(enrollment!.id), enabled: Boolean(enrollment) });
  const attempts = useQuery({ queryKey: ['my-assessment-attempts', enrollment?.id], queryFn: () => listMyAssessmentAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  usePageMeta({ title: 'Assessments', noIndex: true });

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError || scheduled.isError) return <ErrorState onRetry={() => map.refetch()} />;

  const upcoming = (scheduled.data ?? []).filter((a) => a.status === 'scheduled');
  const needsReassessment = (map.data ?? []).filter((m) => m.assessment_result === 'not_passed');

  return (
    <>
      <PageHeader eyebrow="Assessments" title="Monthly trainer assessments" description="At the end of each month an MCSLI trainer assesses you live (online or in person). A pass unlocks the next month." />

      {needsReassessment.length > 0 && (
        <Alert tone="warning" title="Assessment requires another attempt" className="mb-6">
          {needsReassessment.map((m) => `Month ${m.month_number}`).join(', ')}: review the lessons and practice signs. Your trainer will schedule a reassessment — you will be notified.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming" description="Scheduled by your trainer." />
          {upcoming.length === 0 ? (
            <EmptyState compact icon={<CalendarClock className="h-5 w-5" />} title="Nothing scheduled" description="Finish your month's lessons and quizzes; your trainer will schedule your assessment." />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">Month {a.month.month_number} assessment</p>
                    {a.is_reassessment && <Badge tone="warning" size="sm">Reassessment</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{a.scheduled_at ? formatDateTime(a.scheduled_at) : 'Date and time to be confirmed by your trainer'}</p>
                  {a.notes && <p className="mt-2 text-sm text-ink-700">{a.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Status by month" />
          <ul className="space-y-2">
            {(map.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3">
                <span className="text-sm font-medium text-ink-900">
                  Month {m.month_number} · {m.title}
                </span>
                {m.requires_assessment ? <AssessmentResultBadge result={m.assessment_result} size="sm" /> : <Badge size="sm">No assessment</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Assessment history" description="Every attempt, with your trainer's feedback." />
        {attempts.isLoading ? (
          <Skeleton lines={3} />
        ) : (attempts.data ?? []).length === 0 ? (
          <EmptyState compact icon={<ClipboardCheck className="h-5 w-5" />} title="No assessments recorded yet" />
        ) : (
          <ol className="space-y-3">
            {(attempts.data ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink-900">
                    Month {a.month.month_number} · attempt {a.attempt_number}
                  </p>
                  <div className="flex items-center gap-2">
                    {a.score != null && <span className="text-sm font-semibold tabular-nums">{a.score}%</span>}
                    <AssessmentResultBadge result={a.result} size="sm" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink-500">{formatDateTime(a.assessed_at)}</p>
                {a.trainer_feedback && (
                  <p className="mt-3 flex gap-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    <span>{a.trainer_feedback}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
