import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { formatUGX } from '@/lib/utils';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { listPublishedCourses } from '@/services/public';
import { enrollInCourse } from '@/services/student';
import { useMyEnrollment, enrollmentKeys } from './useEnrollment';
import { buildFeeSchedule, type CourseFeeConfig } from '@/domain/pricing';
import type { PaymentPlanType } from '@/domain/types';
import type { Course } from '@/types/database';
import { PageHeader } from '@/app/layouts/Shell';
import { Card } from '@/components/ui/Card';
import { RadioCards } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton, ErrorState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const toConfig = (c: Course): CourseFeeConfig => ({
  currency: c.currency,
  tuitionNational: Number(c.tuition_national),
  tuitionInternational: Number(c.tuition_international),
  registrationFee: Number(c.registration_fee),
  installmentsEnabled: c.installments_enabled,
  installmentCount: c.installment_count,
  installmentAmounts: c.installment_amounts ?? undefined,
  installmentDueBeforeMonth: Object.fromEntries(Object.entries(c.installment_due_before_month ?? {}).map(([k, v]) => [Number(k), Number(v)])),
});

export default function OnboardingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { enrollment, isLoading } = useMyEnrollment();
  const courses = useQuery({ queryKey: ['public-courses'], queryFn: listPublishedCourses });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaymentPlanType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: 'Enroll', noIndex: true });

  if (isLoading) return <Skeleton className="h-64" />;
  if (enrollment) return <Navigate to="/app" replace />;
  if (courses.isLoading) return <Skeleton className="h-64" />;
  if (courses.isError) return <ErrorState onRetry={() => courses.refetch()} />;

  const list = courses.data ?? [];
  const selected = list.find((c) => c.id === courseId) ?? (list.length === 1 ? list[0] : undefined);
  const nationality = profile?.nationality ?? 'ugandan';
  const schedule = selected && plan ? buildFeeSchedule(toConfig(selected), nationality, plan) : null;

  const enroll = async () => {
    if (!selected || !plan) return;
    setBusy(true);
    setError('');
    try {
      await enrollInCourse(selected.id, plan);
      await qc.invalidateQueries({ queryKey: enrollmentKeys.list });
      toast.success('Enrolled', 'Now submit your registration fee and first tuition payment.');
      navigate('/app/payments', { replace: true });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Step 1 of 3" title="Enroll in a course" description={`You registered as a ${nationality === 'ugandan' ? 'Ugandan' : 'non-Ugandan'} student, so the fees below apply to you.`} />
      {list.length === 0 ? (
        <EmptyState title="No course is open for enrollment right now" description="MCSLI will open the next online cohort soon. You will be notified by e-mail." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
          <div className="space-y-6">
            {list.length > 1 && (
              <Card>
                <RadioCards
                  name="course"
                  legend="Choose a course"
                  value={courseId}
                  onChange={setCourseId}
                  options={list.map((c) => ({ value: c.id, title: c.title, description: `${c.duration_months} months · ${c.short_description ?? ''}` }))}
                />
              </Card>
            )}
            {selected && (
              <Card>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                {selected.short_description && <p className="mt-1 text-sm text-ink-600">{selected.short_description}</p>}
                <div className="mt-5">
                  <RadioCards<PaymentPlanType>
                    name="plan"
                    legend="How would you like to pay tuition?"
                    value={plan}
                    onChange={setPlan}
                    options={[
                      {
                        value: 'full',
                        title: 'Pay in full',
                        badge: <Badge tone="success" size="sm">No installment conditions</Badge>,
                        description: `${formatUGX(nationality === 'ugandan' ? Number(selected.tuition_national) : Number(selected.tuition_international), selected.currency)} tuition, paid before Month 1. Later months only depend on passing your assessments.`,
                      },
                      {
                        value: 'installments',
                        title: `${selected.installment_count} installments`,
                        disabled: !selected.installments_enabled,
                        description: selected.installments_enabled
                          ? `First installment before Month 1; the next before Month ${selected.installment_due_before_month?.['2'] ?? 2}. A month stays locked until its installment is confirmed.`
                          : 'Installments are not available for this course.',
                      },
                    ]}
                  />
                </div>
              </Card>
            )}
          </div>
          <aside className="space-y-4">
            <Card padding="sm" className="p-5">
              <h2 className="font-semibold">Your fee summary</h2>
              {schedule ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Registration fee</dt>
                    <dd className="font-semibold">{formatUGX(schedule.registrationFee, schedule.currency)}</dd>
                  </div>
                  {schedule.installments.map((i) => (
                    <div key={i.number} className="flex justify-between">
                      <dt className="text-ink-600">{schedule.plan === 'full' ? 'Tuition' : `Installment ${i.number}`} <span className="text-xs">(before Month {i.dueBeforeMonth})</span></dt>
                      <dd className="font-semibold">{formatUGX(i.amount, schedule.currency)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-ink-200 pt-2">
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-semibold">{formatUGX(schedule.total, schedule.currency)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Choose a course and payment plan to see your fees.</p>
              )}
              {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
              <Button className="mt-4" fullWidth disabled={!schedule} loading={busy} onClick={enroll} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Enroll and continue to payment
              </Button>
              <p className="mt-2 text-xs text-ink-500">Fees are fixed at enrollment; later fee changes never affect you.</p>
            </Card>
            <ul className="space-y-2 text-sm text-ink-600">
              {['Enroll (this step)', 'Submit registration fee + first tuition payment', 'Submit identification for verification', 'MCSLI confirms → Month 1 opens'].map((t, i) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 ${i === 0 ? 'text-brand-600' : 'text-ink-300'}`} aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
