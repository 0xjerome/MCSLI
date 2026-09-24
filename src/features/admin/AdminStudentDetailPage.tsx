import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2 } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { canAssignRole } from '@/domain/roles';
import { getProfile, listEnrollmentsForUser, listIdentities, setUserRole, setAccountStatus, adminUpdateProfile, listCertificates, listAudit } from '@/services/staff';
import { IdentityReviewCard } from './AdminIdentityPage';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Skeleton, ErrorState, Avatar, DescriptionList, EmptyState } from '@/components/ui/Misc';
import { EnrollmentStatusBadge, CertificateStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import type { UserRole } from '@/domain/types';

export default function AdminStudentDetailPage() {
  const { userId = '' } = useParams();
  const { role: myRole, user } = useAuth();
  const toast = useToast();
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(userId) });
  const enrollments = useQuery({ queryKey: ['enrollments-for-user', userId], queryFn: () => listEnrollmentsForUser(userId) });
  const identities = useQuery({ queryKey: ['identities-all'], queryFn: () => listIdentities() });
  const certs = useQuery({ queryKey: ['certificates'], queryFn: listCertificates });
  const audit = useQuery({ queryKey: ['audit', 'user', userId], queryFn: () => listAudit({ targetUserId: userId, pageSize: 20 }) });
  const [saving, setSaving] = useState(false);
  usePageMeta({ title: profile.data?.full_name ?? 'Account', noIndex: true });

  if (profile.isLoading) return <Skeleton className="h-96" />;
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />;
  if (!profile.data) return <ErrorState title="Account not found" />;
  const p = profile.data;
  const identity = (identities.data ?? []).find((i) => i.user_id === p.id) ?? null;
  const isSelf = user?.id === p.id;

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await adminUpdateProfile(p.id, { full_name: String(fd.get('full_name')).trim(), phone: String(fd.get('phone')).trim() || null, country: String(fd.get('country')).trim() || null, nationality: String(fd.get('nationality')) as 'ugandan' | 'international' });
      await profile.refetch();
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (r: UserRole) => {
    if (!window.confirm(`Change ${p.full_name}'s role to ${r}?`)) return;
    try {
      await setUserRole(p.id, r);
      await profile.refetch();
      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  const toggleStatus = async () => {
    const next = p.account_status === 'active' ? 'suspended' : 'active';
    const reason = window.prompt(`Reason for ${next === 'suspended' ? 'suspending' : 'reactivating'} this account (audited):`);
    if (reason === null) return;
    try {
      await setAccountStatus(p.id, next, reason);
      await profile.refetch();
      toast.success(next === 'suspended' ? 'Account suspended' : 'Account reactivated');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  return (
    <>
      <Link to="/admin/students" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Students
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={p.full_name} size="lg" />
          <div>
            <h1 className="text-display-sm">{p.full_name}</h1>
            <p className="text-sm text-ink-600">{p.email} · joined {formatDate(p.created_at)}</p>
            <div className="mt-1 flex gap-2">
              <Badge tone="brand" size="sm">{p.role}</Badge>
              {p.account_status === 'active' ? <Badge tone="success" size="sm">Active</Badge> : <Badge tone="danger" size="sm">Suspended</Badge>}
            </div>
          </div>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap gap-2">
            <Select label={<span className="sr-only">Role</span>} value={p.role} onChange={(e) => changeRole(e.target.value as UserRole)} wrapperClassName="w-44" options={(['STUDENT', 'TRAINER', 'ADMIN', 'SUPER_ADMIN'] as UserRole[]).map((r) => ({ value: r, label: r, disabled: !canAssignRole(myRole!, r) }))} />
            <Button variant={p.account_status === 'active' ? 'danger' : 'primary'} onClick={toggleStatus} leftIcon={p.account_status === 'active' ? <Ban className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
              {p.account_status === 'active' ? 'Suspend' : 'Reactivate'}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <form onSubmit={save} className="space-y-4">
            <Input name="full_name" label="Full name" defaultValue={p.full_name} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="phone" label="Phone" defaultValue={p.phone ?? ''} />
              <Input name="country" label="Country" defaultValue={p.country ?? ''} />
            </div>
            <Select name="nationality" label="Student classification" defaultValue={p.nationality} options={[{ value: 'ugandan', label: 'Ugandan (national tuition)' }, { value: 'international', label: 'Non-Ugandan (international tuition)' }]} hint="Changing this does not alter fees of existing enrollments (prices are snapshotted)." />
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </form>
        </Card>

        {identity ? <IdentityReviewCard row={identity} onChanged={() => identities.refetch()} /> : (
          <Card>
            <CardHeader title="Identity verification" />
            <EmptyState compact title="Not submitted" description="The student has not submitted identification yet." />
          </Card>
        )}

        <Card>
          <CardHeader title="Enrollments" />
          {(enrollments.data ?? []).length === 0 ? (
            <EmptyState compact title="No enrollments" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(enrollments.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link to={`/admin/enrollments/${e.id}`} className="font-medium text-ink-900 hover:underline">
                      {e.course.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {e.plan_type === 'full' ? 'Full payment' : 'Installments'} · enrolled {formatDate(e.created_at)}
                    </p>
                  </div>
                  <EnrollmentStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Certificates" />
          {(certs.data ?? []).filter((c) => c.user_id === p.id).length === 0 ? (
            <EmptyState compact title="None issued" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(certs.data ?? [])
                .filter((c) => c.user_id === p.id)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="font-mono">{c.certificate_number}</span>
                    <CertificateStatusBadge status={c.status} />
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Audit trail for this account" />
          {(audit.data?.rows ?? []).length === 0 ? (
            <EmptyState compact title="No audited actions yet" />
          ) : (
            <DescriptionList columns={1} items={(audit.data?.rows ?? []).map((a) => ({ label: formatDateTime(a.created_at), value: `${titleCase(a.action.replace('.', ': '))} — by ${a.actor?.full_name ?? 'system'}${a.metadata?.reason ? ` · ${String(a.metadata.reason)}` : ''}` }))} />
          )}
        </Card>
      </div>
    </>
  );
}
