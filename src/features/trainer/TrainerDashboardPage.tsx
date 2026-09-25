import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardCheck, RotateCcw, FileText, Flag, ArrowRight } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useAuth } from '@/features/auth/AuthProvider';
import { trainerStats, listAssessments, listQuizAttemptsFor, listExamAttemptsStaff } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { StatCard, Card, CardHeader } from '@/components/ui/Card';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, relativeTime } from '@/lib/utils';

export default function TrainerDashboardPage() {
  const { profile } = useAuth();
  const stats = useQuery({ queryKey: ['trainer-stats'], queryFn: trainerStats });
  const scheduled = useQuery({ queryKey: ['assessments', 'scheduled'], queryFn: () => listAssessments({ status: 'scheduled' }) });
  const recentQuiz = useQuery({ queryKey: ['recent-quiz-attempts'], queryFn: () => listQuizAttemptsFor() });
  const pendingGrading = useQuery({ queryKey: ['exam-attempts-pending'], queryFn: () => listExamAttemptsStaff() });
  usePageMeta({ title: 'Trainer dashboard', noIndex: true });

  if (stats.isError) return <ErrorState onRetry={() => stats.refetch()} />;
  const s = stats.data;
  const upcoming = (scheduled.data ?? []).filter((a) => !a.is_reassessment).slice(0, 6);
  const reassess = (scheduled.data ?? []).filter((a) => a.is_reassessment).slice(0, 6);
  const grading = (pendingGrading.data ?? []).filter((a) => a.status === 'submitted').slice(0, 6);

  return (
    <>
      <PageHeader eyebrow="Trainer" title={`Hello, ${profile?.full_name.split(' ')[0]}`} description="What needs your attention today." />
      {stats.isLoading ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Active students" value={s?.students ?? 0} icon={<Users className="h-4 w-4" />} to="/trainer/students" />
          <StatCard label="Students requiring assessment" value={s?.pending_assessments ?? 0} icon={<ClipboardCheck className="h-4 w-4" />} tone={s?.pending_assessments ? 'warning' : 'default'} to="/trainer/assessments" />
          <StatCard label="Reassessments" value={s?.reassessments ?? 0} icon={<RotateCcw className="h-4 w-4" />} tone={s?.reassessments ? 'danger' : 'default'} to="/trainer/reassessments" />
          <StatCard label="Exams pending grading" value={s?.pending_grading ?? 0} icon={<FileText className="h-4 w-4" />} tone={s?.pending_grading ? 'warning' : 'default'} to="/trainer/exams" />
          <StatCard label="Discussion reports" value={s?.open_reports ?? 0} icon={<Flag className="h-4 w-4" />} tone={s?.open_reports ? 'danger' : 'default'} to="/trainer/discussions" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming assessments" action={<Link to="/trainer/assessments" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
          {scheduled.isLoading ? (
            <Skeleton lines={4} />
          ) : upcoming.length === 0 ? (
            <EmptyState compact title="Nothing scheduled" description="Schedule assessments from the Students page when learners finish a month." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link to={`/trainer/students/${a.enrollment_id}`} className="font-medium text-ink-900 hover:underline">
                      {a.enrollment?.student?.full_name ?? 'Student'}
                    </Link>
                    <p className="text-xs text-ink-500">
                      Month {a.month.month_number} · {a.scheduled_at ? formatDateTime(a.scheduled_at) : 'unscheduled'}
                    </p>
                  </div>
                  <Link to="/trainer/assessments" className="text-sm font-semibold text-brand-700 hover:underline">
                    Record
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Reassessments" action={<Link to="/trainer/reassessments" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
          {reassess.length === 0 ? (
            <EmptyState compact title="No reassessments pending" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {reassess.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link to={`/trainer/students/${a.enrollment_id}`} className="font-medium text-ink-900 hover:underline">
                      {a.enrollment?.student?.full_name ?? 'Student'}
                    </Link>
                    <p className="text-xs text-ink-500">Month {a.month.month_number} · {a.notes}</p>
                  </div>
                  <Badge tone="warning" size="sm">Reassess</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Pending exam grading" action={<Link to="/trainer/exams" className="text-sm font-semibold text-brand-700 hover:underline">Exams</Link>} />
          {grading.length === 0 ? (
            <EmptyState compact title="Nothing to grade" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {grading.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {a.student?.full_name ?? 'Student'} · attempt {a.attempt_number}
                  </span>
                  <Link to={`/trainer/exams/${a.exam_id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                    Grade <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent student activity" description="Latest quiz attempts across your courses." />
          {recentQuiz.isLoading ? (
            <Skeleton lines={4} />
          ) : (recentQuiz.data ?? []).length === 0 ? (
            <EmptyState compact title="No activity yet" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(recentQuiz.data ?? []).slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink-900">{a.enrollment?.student?.full_name ?? 'Student'}</span> · {a.quiz?.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-ink-500">
                    <span className="font-semibold tabular-nums text-ink-800">{a.score}%</span>
                    {a.passed ? <Badge tone="success" size="sm">Pass</Badge> : <Badge size="sm">Retry</Badge>}
                    {relativeTime(a.submitted_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
