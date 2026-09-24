import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, ShieldCheck, CreditCard, ClipboardCheck, Lock, Award, LifeBuoy, Flag, Mail } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { adminStats, listAudit, listPayments, listIdentities } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { StatCard, Card, CardHeader } from '@/components/ui/Card';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { formatUGX, relativeTime, titleCase } from '@/lib/utils';

export default function AdminDashboardPage() {
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: adminStats });
  const payments = useQuery({ queryKey: ['payments', 'review'], queryFn: () => listPayments({ status: 'review' }) });
  const identities = useQuery({ queryKey: ['identities', 'pending'], queryFn: () => listIdentities('pending') });
  const audit = useQuery({ queryKey: ['audit', 'recent'], queryFn: () => listAudit({ pageSize: 12 }) });
  usePageMeta({ title: 'Admin dashboard', noIndex: true });

  if (stats.isError) return <ErrorState onRetry={() => stats.refetch()} />;
  const s = stats.data;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Admin dashboard" description="Everything that needs an administrator's action, in one place." />
      {stats.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total students" value={s?.total_students ?? 0} icon={<Users className="h-4 w-4" />} to="/admin/students" />
          <StatCard label="Active students" value={s?.active_students ?? 0} icon={<UserCheck className="h-4 w-4" />} to="/admin/enrollments" />
          <StatCard label="Pending ID verification" value={s?.pending_identity ?? 0} tone={s?.pending_identity ? 'warning' : 'default'} icon={<ShieldCheck className="h-4 w-4" />} to="/admin/identity" />
          <StatCard label="Pending payment verification" value={s?.pending_payments ?? 0} tone={s?.pending_payments ? 'warning' : 'default'} icon={<CreditCard className="h-4 w-4" />} to="/admin/payments" />
          <StatCard label="Upcoming assessments" value={s?.upcoming_assessments ?? 0} icon={<ClipboardCheck className="h-4 w-4" />} to="/admin/assessments" />
          <StatCard label="Awaiting assessment results" value={s?.assessments_awaiting_results ?? 0} icon={<ClipboardCheck className="h-4 w-4" />} to="/admin/assessments" />
          <StatCard label="Blocked by payment" value={s?.students_blocked_by_payment ?? 0} tone={s?.students_blocked_by_payment ? 'danger' : 'default'} icon={<Lock className="h-4 w-4" />} to="/admin/payments" hint="Students whose next month needs a confirmed payment" />
          <StatCard label="Blocked by assessment" value={s?.students_blocked_by_assessment ?? 0} tone={s?.students_blocked_by_assessment ? 'danger' : 'default'} icon={<Lock className="h-4 w-4" />} to="/admin/assessments" hint="Latest attempt not passed" />
          <StatCard label="Certificates issued" value={s?.certificates_issued ?? 0} icon={<Award className="h-4 w-4" />} to="/admin/certificates" />
          <StatCard label="Open support tickets" value={s?.open_tickets ?? 0} tone={s?.open_tickets ? 'warning' : 'default'} icon={<LifeBuoy className="h-4 w-4" />} to="/admin/support" />
          <StatCard label="Discussion reports" value={s?.open_reports ?? 0} tone={s?.open_reports ? 'danger' : 'default'} icon={<Flag className="h-4 w-4" />} to="/admin/discussions" />
          <StatCard label="New website messages" value={s?.new_messages ?? 0} icon={<Mail className="h-4 w-4" />} to="/admin/support" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Payments to review" action={<Link to="/admin/payments" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
          {payments.isLoading ? (
            <Skeleton lines={4} />
          ) : (payments.data ?? []).length === 0 ? (
            <EmptyState compact title="No payments waiting" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(payments.data ?? []).slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink-900">{p.student?.full_name}</span> · {formatUGX(Number(p.amount), p.currency)}
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">{relativeTime(p.submitted_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/payments" className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              Review payments
            </Button>
          </Link>
        </Card>
        <Card>
          <CardHeader title="Identity to verify" action={<Link to="/admin/identity" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
          {identities.isLoading ? (
            <Skeleton lines={4} />
          ) : (identities.data ?? []).length === 0 ? (
            <EmptyState compact title="Nothing pending" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(identities.data ?? []).slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-medium text-ink-900">{i.profile?.full_name ?? i.full_name_on_document}</span>
                  <span className="text-xs text-ink-500">{relativeTime(i.submitted_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent operational activity" action={<Link to="/admin/audit" className="text-sm font-semibold text-brand-700 hover:underline">Audit log</Link>} />
          {audit.isLoading ? (
            <Skeleton lines={6} />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(audit.data?.rows ?? []).map((a) => (
                <li key={a.id} className="py-2">
                  <p className="text-ink-900">
                    <span className="font-medium">{a.actor?.full_name ?? 'System'}</span> · {titleCase(a.action.replace('.', ': '))}
                    {a.target?.full_name ? ` → ${a.target.full_name}` : ''}
                  </p>
                  <p className="text-xs text-ink-500">{relativeTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
