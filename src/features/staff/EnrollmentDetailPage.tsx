import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, Unlock, CheckCircle2, CalendarPlus, Award, ShieldCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { isAdmin } from '@/domain/roles';
import { getEnrollment, getCourseMapFor, listAssessmentsFor, listAssessmentAttemptsFor, listPaymentsFor, listOverridesFor, overrideMonth, revokeOverride, scheduleAssessment, setEnrollmentStatus, approveCompletion, certificateEligibility, issueCertificate, listQuizAttemptsFor } from '@/services/staff';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Skeleton, ErrorState, DescriptionList, Alert, Avatar, EmptyState } from '@/components/ui/Misc';
import { ProgressBar } from '@/components/ui/Progress';
import { AssessmentResultBadge, EnrollmentStatusBadge, PaymentStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { RecordAssessmentDialog } from '@/features/trainer/RecordAssessmentDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatUGX } from '@/lib/utils';
import type { AssessmentRow } from '@/services/staff';
import type { EnrollmentStatus } from '@/domain/types';

export default function EnrollmentDetailPage() {
  const { enrollmentId = '' } = useParams();
  const { role } = useAuth();
  const admin = isAdmin(role);
  const location = useLocation();
  const back = location.pathname.startsWith('/admin') ? '/admin/enrollments' : '/trainer/students';
  const qc = useQueryClient();
  const toast = useToast();
  const enr = useQuery({ queryKey: ['enrollment', enrollmentId], queryFn: () => getEnrollment(enrollmentId) });
  const map = useQuery({ queryKey: ['course-map', enrollmentId], queryFn: () => getCourseMapFor(enrollmentId), enabled: Boolean(enr.data) });
  const assessments = useQuery({ queryKey: ['assessments-for', enrollmentId], queryFn: () => listAssessmentsFor(enrollmentId), enabled: Boolean(enr.data) });
  const attempts = useQuery({ queryKey: ['assessment-attempts-for', enrollmentId], queryFn: () => listAssessmentAttemptsFor(enrollmentId), enabled: Boolean(enr.data) });
  const payments = useQuery({ queryKey: ['payments-for', enrollmentId], queryFn: () => listPaymentsFor(enrollmentId), enabled: Boolean(enr.data) });
  const overrides = useQuery({ queryKey: ['overrides-for', enrollmentId], queryFn: () => listOverridesFor(enrollmentId), enabled: Boolean(enr.data) });
  const quizzes = useQuery({ queryKey: ['quiz-attempts-for', enrollmentId], queryFn: () => listQuizAttemptsFor(enrollmentId), enabled: Boolean(enr.data) });
  const eligibility = useQuery({ queryKey: ['eligibility', enrollmentId], queryFn: () => certificateEligibility(enrollmentId), enabled: Boolean(enr.data) });
  const [overrideFor, setOverrideFor] = useState<{ id: string; number: number } | null>(null);
  const [scheduleFor, setScheduleFor] = useState<{ id: string; number: number } | null>(null);
  const [recordFor, setRecordFor] = useState<AssessmentRow | null>(null);
  const [busy, setBusy] = useState(false);
  usePageMeta({ title: enr.data?.student?.full_name ?? 'Student', noIndex: true });

  const refreshAll = () => Promise.all([map.refetch(), assessments.refetch(), attempts.refetch(), overrides.refetch(), eligibility.refetch(), enr.refetch(), qc.invalidateQueries({ queryKey: ['assessments'] })]);

  if (enr.isLoading) return <Skeleton className="h-96" />;
  if (enr.isError) return <ErrorState onRetry={() => enr.refetch()} />;
  if (!enr.data) return <ErrorState title="Enrollment not found" description="You may not be assigned to this student's course." />;
  const e = enr.data;

  const submitOverride = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!overrideFor) return;
    const fd = new FormData(ev.currentTarget);
    setBusy(true);
    try {
      await overrideMonth(e.id, overrideFor.id, String(fd.get('reason')));
      toast.success(`Month ${overrideFor.number} override recorded`, 'The override is in the audit log.');
      setOverrideFor(null);
      await refreshAll();
    } catch (err) {
      toast.error('Override failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSchedule = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!scheduleFor) return;
    const fd = new FormData(ev.currentTarget);
    const when = String(fd.get('scheduled_at'));
    setBusy(true);
    try {
      await scheduleAssessment({ enrollmentId: e.id, monthId: scheduleFor.id, scheduledAt: when ? new Date(when).toISOString() : null, notes: String(fd.get('notes')) || undefined });
      toast.success('Assessment scheduled', 'The student has been notified.');
      setScheduleFor(null);
      await refreshAll();
    } catch (err) {
      toast.error('Could not schedule', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (s: EnrollmentStatus) => {
    const reason = window.prompt(`Reason for setting status to "${s}" (recorded in the audit log):`);
    if (reason === null) return;
    try {
      await setEnrollmentStatus(e.id, s, reason);
      toast.success('Status updated');
      await refreshAll();
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  const approve = async () => {
    try {
      await approveCompletion(e.id);
      toast.success('Completion approved');
      await refreshAll();
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  const issue = async () => {
    if (!window.confirm(`Issue a certificate to ${e.student?.full_name}? This cannot be undone (it can be revoked).`)) return;
    try {
      await issueCertificate(e.id);
      toast.success('Certificate issued', 'The student has been notified.');
      await refreshAll();
    } catch (err) {
      toast.error('Could not issue', friendlyError(err));
    }
  };

  const confirmedReg = (payments.data ?? []).filter((p) => p.status === 'confirmed' && p.purpose === 'registration').reduce((a, p) => a + Number(p.amount), 0);
  const confirmedTuition = (payments.data ?? []).filter((p) => p.status === 'confirmed' && p.purpose === 'tuition').reduce((a, p) => a + Number(p.amount), 0);
  const pendingScheduled = (assessments.data ?? []).filter((a) => a.status === 'scheduled');

  return (
    <>
      <Link to={back} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={e.student?.full_name} size="lg" />
          <div>
            <h1 className="text-display-sm">{e.student?.full_name}</h1>
            <p className="text-sm text-ink-600">
              {e.student?.email} · {e.course?.title} · {e.plan_type === 'full' ? 'Full payment' : `${e.installments.length} installments`} · {e.nationality === 'ugandan' ? 'Ugandan' : 'International'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <EnrollmentStatusBadge status={e.status} />
              {admin && (
                <Link to={`/admin/students/${e.user_id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                  Full student record
                </Link>
              )}
            </div>
          </div>
        </div>
        {admin && (
          <Select label={<span className="sr-only">Enrollment status</span>} value={e.status} onChange={(ev) => changeStatus(ev.target.value as EnrollmentStatus)} wrapperClassName="w-48" options={[{ value: 'pending_payment', label: 'Awaiting payment' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'suspended', label: 'Suspended' }, { value: 'withdrawn', label: 'Withdrawn' }]} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Months / progression */}
        <Card className="lg:col-span-2">
          <CardHeader title="Progression" description="Each month requires the financial and academic gates. Overrides bypass only the academic gate and are audited." />
          {map.isLoading ? (
            <Skeleton lines={5} />
          ) : (
            <ol className="space-y-3">
              {(map.data ?? []).map((m) => {
                const pct = m.lessons_total ? Math.round((Number(m.lessons_completed) / Number(m.lessons_total)) * 100) : 0;
                const openAssessment = pendingScheduled.find((a) => a.month_id === m.id);
                const activeOverride = (overrides.data ?? []).find((o) => o.month_id === m.id && !o.revoked_at);
                return (
                  <li key={m.id} className="rounded-xl border border-ink-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold text-ink-900">
                        {m.access.allowed ? <Unlock className="h-4 w-4 text-success-600" aria-label="Unlocked" /> : <Lock className="h-4 w-4 text-ink-400" aria-label="Locked" />}
                        Month {m.month_number} · {m.title}
                        {m.access.overridden && <Badge tone="warning" size="sm">Override</Badge>}
                      </p>
                      <AssessmentResultBadge result={m.assessment_result} size="sm" />
                    </div>
                    {!m.access.allowed && <p className="mt-1 text-xs text-ink-600">{m.access.reasons.map((r) => r.message).join(' ')}</p>}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ProgressBar value={pct} label={`Lessons ${m.lessons_completed}/${m.lessons_total}`} size="sm" />
                      <ProgressBar value={m.quizzes_total ? Math.round((Number(m.quizzes_passed) / Number(m.quizzes_total)) * 100) : 0} label={`Quizzes ${m.quizzes_passed}/${m.quizzes_total}`} size="sm" tone="accent" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.requires_assessment && m.access.allowed && m.assessment_result !== 'pass' && !openAssessment && (
                        <Button size="sm" variant="outline" onClick={() => setScheduleFor({ id: m.id, number: m.month_number })} leftIcon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}>
                          Schedule assessment
                        </Button>
                      )}
                      {openAssessment && (
                        <Button size="sm" onClick={() => setRecordFor({ ...(openAssessment as unknown as AssessmentRow), enrollment: { id: e.id, user_id: e.user_id, course_id: e.course_id, status: e.status, student: e.student, course: { title: e.course.title } } })} leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
                          Record result {openAssessment.is_reassessment ? '(reassessment)' : ''}
                        </Button>
                      )}
                      {admin && !m.access.allowed && !activeOverride && m.month_number > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => setOverrideFor({ id: m.id, number: m.month_number })} leftIcon={<Unlock className="h-4 w-4" aria-hidden="true" />}>
                          Override unlock
                        </Button>
                      )}
                      {admin && activeOverride && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const reason = window.prompt('Reason for revoking this override:');
                            if (!reason) return;
                            try {
                              await revokeOverride(activeOverride.id, reason);
                              await refreshAll();
                              toast.success('Override revoked');
                            } catch (err) {
                              toast.error('Failed', friendlyError(err));
                            }
                          }}
                        >
                          Revoke override
                        </Button>
                      )}
                    </div>
                    {activeOverride && <p className="mt-2 text-xs text-warning-700">Override: {activeOverride.reason} ({formatDate(activeOverride.created_at)})</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payments" action={admin ? <Link to="/admin/payments" className="text-sm font-semibold text-brand-700 hover:underline">Review</Link> : undefined} />
            <DescriptionList
              columns={1}
              items={[
                { label: 'Registration fee', value: `${formatUGX(confirmedReg, e.currency)} / ${formatUGX(Number(e.registration_fee), e.currency)}` },
                { label: 'Tuition', value: `${formatUGX(confirmedTuition, e.currency)} / ${formatUGX(Number(e.tuition_amount), e.currency)}` },
              ]}
            />
            <ul className="mt-3 space-y-1 text-sm">
              {(payments.data ?? []).slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink-600">
                    {p.purpose === 'registration' ? 'Registration' : `Tuition #${p.installment_number ?? 1}`} · {formatDate(p.paid_at)}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
              {(payments.data ?? []).length === 0 && <li className="text-ink-500">No payments submitted.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Certificate" />
            {eligibility.data?.eligible ? (
              <Alert tone="success" title="Eligible for certificate">
                {admin ? (
                  <Button size="sm" className="mt-2" onClick={issue} leftIcon={<Award className="h-4 w-4" aria-hidden="true" />}>
                    Issue certificate
                  </Button>
                ) : (
                  'An administrator can now issue the certificate.'
                )}
              </Alert>
            ) : (
              <ul className="space-y-1 text-sm text-ink-700">
                {(eligibility.data?.missing ?? []).map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            )}
            {!e.final_approved_at && (eligibility.data?.missing ?? []).length === 1 && (
              <Button size="sm" variant="outline" className="mt-3" onClick={approve} leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
                Give final approval
              </Button>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assessment history" />
          {(attempts.data ?? []).length === 0 ? (
            <EmptyState compact title="No assessments recorded" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(attempts.data ?? []).map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink-900">
                      Month {a.month.month_number} · attempt {a.attempt_number}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.score != null && <span className="text-sm font-semibold">{a.score}%</span>}
                      <AssessmentResultBadge result={a.result} size="sm" />
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">{formatDateTime(a.assessed_at)}</p>
                  {a.trainer_feedback && <p className="mt-1 text-sm text-ink-700">{a.trainer_feedback}</p>}
                  {a.notes && <p className="mt-1 text-xs text-ink-500">Notes: {a.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Quiz attempts" />
          {(quizzes.data ?? []).length === 0 ? (
            <EmptyState compact title="No quiz attempts" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(quizzes.data ?? []).slice(0, 12).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate">{a.quiz?.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {a.score}% {a.passed ? <Badge tone="success" size="sm">Pass</Badge> : <Badge size="sm">Retry</Badge>} <span className="text-ink-500">{formatDate(a.submitted_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Override dialog */}
      <Dialog open={Boolean(overrideFor)} onClose={() => setOverrideFor(null)} title={`Override unlock – Month ${overrideFor?.number}`} description="Bypasses the academic requirement only. Payment gates still apply. Recorded permanently in the audit log with your name.">
        <form onSubmit={submitOverride} className="space-y-4">
          <Textarea name="reason" label="Reason (required, at least 10 characters)" required minLength={10} rows={4} data-autofocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOverrideFor(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Record override
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={Boolean(scheduleFor)} onClose={() => setScheduleFor(null)} title={`Schedule Month ${scheduleFor?.number} assessment`} description="The student receives an in-app notification.">
        <form onSubmit={submitSchedule} className="space-y-4">
          <Input name="scheduled_at" type="datetime-local" label="Date and time" optionalLabel hint="Leave empty if you will arrange it with the student directly." data-autofocus />
          <Textarea name="notes" label="Notes for the student" optionalLabel rows={3} placeholder="e.g. Join the Zoom link sent by WhatsApp; prepare the family signs." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setScheduleFor(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Schedule
            </Button>
          </div>
        </form>
      </Dialog>

      <RecordAssessmentDialog assessment={recordFor} onClose={() => setRecordFor(null)} onRecorded={refreshAll} />
    </>
  );
}
