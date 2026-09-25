import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Lock, Flag, CreditCard, Award } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap, summarise } from './useEnrollment';
import { listQuizAttempts, listMyAssessmentAttempts, listMyExamAttempts, listExams } from '@/services/student';
import { listMyPayments } from '@/services/payments';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState } from '@/components/ui/Misc';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { AssessmentResultBadge, PaymentStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatUGX } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function ProgressPage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const quizAttempts = useQuery({ queryKey: ['quiz-attempts', enrollment?.id], queryFn: () => listQuizAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  const assessmentAttempts = useQuery({ queryKey: ['my-assessment-attempts', enrollment?.id], queryFn: () => listMyAssessmentAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  const examAttempts = useQuery({ queryKey: ['my-exam-attempts', enrollment?.id], queryFn: () => listMyExamAttempts(enrollment!.id), enabled: Boolean(enrollment) });
  const exams = useQuery({ queryKey: ['exams', enrollment?.course_id], queryFn: () => listExams(enrollment!.course_id), enabled: Boolean(enrollment) });
  const payments = useQuery({ queryKey: ['my-payments', enrollment?.id], queryFn: () => listMyPayments(enrollment!.id), enabled: Boolean(enrollment) });
  usePageMeta({ title: 'Progress', noIndex: true });

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;

  const s = summarise(map.data);
  const confirmed = (payments.data ?? []).filter((p) => p.status === 'confirmed');
  const paidReg = confirmed.filter((p) => p.purpose === 'registration').reduce((a, p) => a + Number(p.amount), 0);
  const paidTuition = confirmed.filter((p) => p.purpose === 'tuition').reduce((a, p) => a + Number(p.amount), 0);
  const currentUnlocked = s.unlocked[s.unlocked.length - 1];

  const milestones = [
    { label: 'Enrolled', done: true, date: enrollment.created_at },
    { label: 'Payment confirmed – Month 1 open', done: enrollment.status !== 'pending_payment', date: enrollment.activated_at },
    ...s.months.map((m) => ({ label: `Month ${m.month_number} assessment passed`, done: m.assessment_result === 'pass', date: (assessmentAttempts.data ?? []).find((a) => a.month_id === m.id && a.result === 'pass')?.assessed_at ?? null })),
    { label: 'Final examination passed', done: (examAttempts.data ?? []).some((a) => a.passed && exams.data?.find((x) => x.id === a.exam_id)?.is_final), date: null },
    { label: 'Course completed', done: enrollment.status === 'completed', date: enrollment.completed_at },
  ];

  return (
    <>
      <PageHeader eyebrow="Progress" title="Your progress" description="A clear picture of what is complete, what is next and what still needs attention." />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="flex items-center gap-4 md:col-span-2">
          <div className="text-brand-700">
            <ProgressRing value={s.overall} size={88} label="Overall course completion" />
          </div>
          <div>
            <p className="font-semibold text-ink-900">Overall completion</p>
            <p className="text-sm text-ink-600">
              {s.monthsPassed}/{s.months.length} months passed · {s.lessonsDone}/{s.lessonsTotal} lessons · {s.quizzesPassed}/{s.quizzesTotal} quizzes
            </p>
            <p className="mt-1 text-sm text-ink-600">Current unlocked month: <strong>{currentUnlocked ? `Month ${currentUnlocked.month_number}` : 'none yet'}</strong></p>
          </div>
        </Card>
        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <CreditCard className="h-4 w-4" aria-hidden="true" /> Payments
          </p>
          <p className="mt-2 text-sm">
            Registration: <strong>{formatUGX(paidReg, enrollment.currency)}</strong> / {formatUGX(Number(enrollment.registration_fee), enrollment.currency)}
          </p>
          <p className="text-sm">
            Tuition: <strong>{formatUGX(paidTuition, enrollment.currency)}</strong> / {formatUGX(Number(enrollment.tuition_amount), enrollment.currency)}
          </p>
          <ProgressBar value={((paidReg + paidTuition) / (Number(enrollment.registration_fee) + Number(enrollment.tuition_amount))) * 100} label="Paid" size="sm" className="mt-2" />
        </Card>
        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <Award className="h-4 w-4" aria-hidden="true" /> Examinations
          </p>
          {(examAttempts.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-500">No exam attempts yet</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {(examAttempts.data ?? []).slice(0, 3).map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{exams.data?.find((x) => x.id === a.exam_id)?.title ?? 'Exam'} · #{a.attempt_number}</span>
                  <span className="font-semibold">{a.results_released_at ? `${Number(a.total_score)}%` : a.status === 'in_progress' ? 'In progress' : 'Pending'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Month by month" />
          <ol className="space-y-4">
            {s.months.map((m) => {
              const lp = m.lessons_total ? (Number(m.lessons_completed) / Number(m.lessons_total)) * 100 : 0;
              const qp = m.quizzes_total ? (Number(m.quizzes_passed) / Number(m.quizzes_total)) * 100 : 0;
              return (
                <li key={m.id} className={cn('rounded-xl border p-4', m.access.allowed ? 'border-ink-200' : 'border-dashed border-ink-300 bg-ink-50')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      {m.access.allowed ? <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden="true" /> : <Lock className="h-4 w-4 text-ink-400" aria-hidden="true" />}
                      Month {m.month_number} · {m.title}
                    </p>
                    <AssessmentResultBadge result={m.assessment_result} size="sm" />
                  </div>
                  {m.access.allowed ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ProgressBar value={lp} label={`Lessons ${m.lessons_completed}/${m.lessons_total}`} size="sm" />
                      <ProgressBar value={qp} label={`Quizzes passed ${m.quizzes_passed}/${m.quizzes_total}`} size="sm" tone="accent" />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-600">{m.access.reasons.map((r) => r.message).join(' ')}</p>
                  )}
                  {m.assessment_attempts > 0 && <p className="mt-2 text-xs text-ink-500">{m.assessment_attempts} assessment attempt{m.assessment_attempts === 1 ? '' : 's'}</p>}
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Milestones" />
            <ol className="relative space-y-4 border-l border-ink-200 pl-5">
              {milestones.map((m) => (
                <li key={m.label} className="relative">
                  <span className={cn('absolute -left-[1.6rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white', m.done ? 'text-success-600' : 'text-ink-300')} aria-hidden="true">
                    {m.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <p className={cn('text-sm', m.done ? 'font-medium text-ink-900' : 'text-ink-500')}>{m.label}</p>
                  {m.date && <p className="text-xs text-ink-500">{formatDate(m.date)}</p>}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Recent quiz scores" />
            {(quizAttempts.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-500">No quiz attempts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(quizAttempts.data ?? []).slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span className="text-ink-600">{formatDate(a.submitted_at)}</span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">
                      {a.score}% {a.passed ? <Badge tone="success" size="sm">Pass</Badge> : <Badge size="sm">Retry</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Payment history" />
            {(payments.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-500">No payments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(payments.data ?? []).slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-700">{p.purpose === 'registration' ? 'Registration' : `Tuition ${p.installment_number ? `#${p.installment_number}` : ''}`}</span>
                    <span className="flex items-center gap-2">
                      {formatUGX(Number(p.amount), p.currency)} <PaymentStatusBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Progress is stored on the server and follows you across devices.
          </p>
        </div>
      </div>
    </>
  );
}
