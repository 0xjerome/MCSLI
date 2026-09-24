import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PlayCircle, ClipboardCheck, CreditCard, MessageSquare, Award, LifeBuoy, ShieldCheck, Lock } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyEnrollment, useCourseMap, summarise } from './useEnrollment';
import { listMyAssessments, listLessonProgress, listModulesWithLessons, listMyCertificates } from '@/services/student';
import { listMyPayments } from '@/services/payments';
import { getMyIdentity } from '@/services/identity';
import { listThreads } from '@/services/community';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { PaymentStatusBadge, IdentityStatusBadge, AssessmentResultBadge, EnrollmentStatusBadge } from '@/components/StatusBadges';
import { LockedCard } from '@/components/LockedCard';
import { formatDate, relativeTime } from '@/lib/utils';
import type { LockReason } from '@/domain/types';
import { PageHeader } from '@/app/layouts/Shell';
import { Navigate } from 'react-router-dom';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { enrollment, isLoading, error, refetch } = useMyEnrollment();
  usePageMeta({ title: 'Dashboard', noIndex: true });
  const map = useCourseMap(enrollment?.id);
  const s = summarise(map.data);
  const currentMonth = s.current;

  const modules = useQuery({ queryKey: ['modules', currentMonth?.id], queryFn: () => listModulesWithLessons(currentMonth!.id), enabled: Boolean(currentMonth) });
  const progress = useQuery({ queryKey: ['lesson-progress', enrollment?.id], queryFn: () => listLessonProgress(enrollment!.id), enabled: Boolean(enrollment) });
  const assessments = useQuery({ queryKey: ['my-assessments', enrollment?.id], queryFn: () => listMyAssessments(enrollment!.id), enabled: Boolean(enrollment) });
  const payments = useQuery({ queryKey: ['my-payments', enrollment?.id], queryFn: () => listMyPayments(enrollment!.id), enabled: Boolean(enrollment) });
  const identity = useQuery({ queryKey: ['my-identity'], queryFn: getMyIdentity });
  const threads = useQuery({ queryKey: ['threads', enrollment?.course_id], queryFn: () => listThreads(enrollment!.course_id), enabled: Boolean(enrollment) });
  const certs = useQuery({ queryKey: ['my-certificates'], queryFn: listMyCertificates });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;

  const firstName = profile?.full_name.split(' ')[0] ?? 'there';
  const lessons = (modules.data ?? []).flatMap((m) => m.lessons);
  const done = new Set((progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const nextLesson = lessons.find((l) => !done.has(l.id)) ?? lessons[lessons.length - 1];
  const upcomingAssessment = (assessments.data ?? []).find((a) => a.status === 'scheduled');
  const lastPayment = payments.data?.[0];
  const pendingPayments = (payments.data ?? []).filter((p) => p.status === 'pending' || p.status === 'under_review').length;
  const recentThreads = (threads.data ?? []).slice(0, 3);
  const certificate = certs.data?.find((c) => c.enrollment_id === enrollment.id && c.status === 'issued');
  const lockReasons = (s.nextLocked?.access.reasons ?? []) as LockReason[];
  const monthLocked = !currentMonth;

  return (
    <>
      <PageHeader eyebrow={enrollment.course.title} title={`Welcome back, ${firstName}`} description={<span className="inline-flex items-center gap-2">Enrollment <EnrollmentStatusBadge status={enrollment.status} /></span>} />

      {/* Continue learning – the primary action */}
      <section aria-labelledby="continue" className="overflow-hidden rounded-2xl bg-brand-700 text-white shadow-raised">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr,auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">{currentMonth ? `Current month · Month ${currentMonth.month_number}` : 'Getting started'}</p>
            <h2 id="continue" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              {monthLocked ? 'Your course will open once your payment is confirmed' : nextLesson ? nextLesson.title : currentMonth.title}
            </h2>
            <p className="mt-2 max-w-xl text-brand-100">
              {monthLocked
                ? 'Submit your registration fee and first tuition payment, then an MCSLI administrator will confirm it and unlock Month 1.'
                : nextLesson
                  ? `Next lesson in ${currentMonth.title}. ${Number(currentMonth.lessons_completed)} of ${Number(currentMonth.lessons_total)} lessons complete.`
                  : 'All lessons in this month are complete. Finish your quizzes and get ready for your assessment.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {monthLocked ? (
                <ButtonLink to="/app/payments" variant="accent" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
                  Go to payments
                </ButtonLink>
              ) : (
                <ButtonLink to={nextLesson ? `/app/lessons/${nextLesson.id}` : `/app/course/${enrollment.course_id}/month/${currentMonth.id}`} variant="accent" size="lg" leftIcon={<PlayCircle className="h-5 w-5" aria-hidden="true" />}>
                  Continue Learning
                </ButtonLink>
              )}
              <ButtonLink to={`/app/course/${enrollment.course_id}`} variant="ghost" size="lg" className="text-white hover:bg-white/10">
                View course
              </ButtonLink>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-white/10 p-4 lg:flex-col lg:text-center">
            <div className="text-white">
              <ProgressRing value={s.overall} size={84} label="Overall course progress" />
            </div>
            <div>
              <p className="text-sm font-semibold">Overall progress</p>
              <p className="text-xs text-brand-100">
                {s.monthsPassed} of {s.months.length} months passed
              </p>
            </div>
          </div>
        </div>
      </section>

      {lockReasons.length > 0 && s.nextLocked && (
        <div className="mt-6">
          <LockedCard title={`Month ${s.nextLocked.month_number}`} reasons={lockReasons} compact />
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Upcoming assessment
          </p>
          {upcomingAssessment ? (
            <>
              <p className="mt-2 font-semibold text-ink-900">Month {upcomingAssessment.month.month_number}{upcomingAssessment.is_reassessment ? ' · reassessment' : ''}</p>
              <p className="text-sm text-ink-600">{upcomingAssessment.scheduled_at ? formatDate(upcomingAssessment.scheduled_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date to be confirmed by your trainer'}</p>
            </>
          ) : currentMonth ? (
            <>
              <p className="mt-2 font-semibold text-ink-900">Month {currentMonth.month_number}</p>
              <div className="mt-1">
                <AssessmentResultBadge result={currentMonth.assessment_result} size="sm" />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-500">None yet</p>
          )}
          <Link to="/app/assessments" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Assessments
          </Link>
        </Card>

        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <CreditCard className="h-4 w-4" aria-hidden="true" /> Payment status
          </p>
          {lastPayment ? (
            <>
              <div className="mt-2">
                <PaymentStatusBadge status={lastPayment.status} />
              </div>
              <p className="mt-1 text-sm text-ink-600">
                Last: {lastPayment.purpose === 'registration' ? 'Registration fee' : `Tuition${lastPayment.installment_number ? ` (installment ${lastPayment.installment_number})` : ''}`}
                {pendingPayments > 0 && ` · ${pendingPayments} awaiting confirmation`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-warning-700">No payment submitted yet</p>
          )}
          <Link to="/app/payments" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Payments
          </Link>
        </Card>

        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Identity verification
          </p>
          <div className="mt-2">
            <IdentityStatusBadge status={identity.data?.status ?? 'not_submitted'} />
          </div>
          <Link to="/app/profile#identity" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            {identity.data ? 'View' : 'Submit identification'}
          </Link>
        </Card>

        <Card padding="sm" className="p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <Award className="h-4 w-4" aria-hidden="true" /> Certificate
          </p>
          {certificate ? (
            <p className="mt-2 font-mono text-sm font-semibold text-success-700">{certificate.certificate_number}</p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Issued after course completion
            </p>
          )}
          <Link to="/app/certificate" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Certificate
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your months" description="Each month unlocks after you pass the previous assessment and the payment due for it is confirmed." action={<Link to={`/app/course/${enrollment.course_id}`} className="text-sm font-semibold text-brand-700 hover:underline">Course map</Link>} />
          {map.isLoading ? (
            <Skeleton lines={4} />
          ) : (
            <ol className="space-y-3">
              {s.months.map((m) => {
                const pct = m.lessons_total ? Math.round((Number(m.lessons_completed) / Number(m.lessons_total)) * 100) : 0;
                return (
                  <li key={m.id} className="flex items-center gap-4 rounded-xl border border-ink-200 p-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${m.access.allowed ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500'}`} aria-hidden="true">
                      {m.access.allowed ? m.month_number : <Lock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-ink-900">
                          {m.access.allowed ? (
                            <Link to={`/app/course/${enrollment.course_id}/month/${m.id}`} className="hover:underline">
                              {m.title}
                            </Link>
                          ) : (
                            m.title
                          )}
                        </p>
                        <AssessmentResultBadge result={m.assessment_result} size="sm" />
                      </div>
                      {m.access.allowed ? <ProgressBar value={pct} label={`Month ${m.month_number} lessons`} size="sm" showValue={false} className="mt-2" /> : <p className="mt-1 text-xs text-ink-500">{m.access.reasons[0]?.message}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent discussion" action={<Link to="/app/discussions" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
            {threads.isLoading ? (
              <Skeleton lines={3} />
            ) : recentThreads.length === 0 ? (
              <EmptyState compact icon={<MessageSquare className="h-5 w-5" />} title="No discussions yet" description="Ask your first question to trainers and classmates." />
            ) : (
              <ul className="space-y-3">
                {recentThreads.map((t) => (
                  <li key={t.id}>
                    <Link to={`/app/discussions/${t.id}`} className="block rounded-lg p-2 hover:bg-ink-50">
                      <p className="truncate text-sm font-medium text-ink-900">{t.title}</p>
                      <p className="text-xs text-ink-500">
                        {t.author?.full_name ?? 'Member'} · {relativeTime(t.created_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link to="/app/help" className="card flex items-center gap-3 p-4 hover:shadow-raised">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600" aria-hidden="true">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-ink-900">Need help?</span>
              <span className="block text-sm text-ink-600">FAQs, payment help and support requests</span>
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
