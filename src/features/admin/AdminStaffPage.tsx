import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MailPlus, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { inviteStaff, listStaffInvitations, cancelStaffInvitation, listStaffAccounts, setAccountStatus, type StaffInvitation } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';

const statusTone: Record<StaffInvitation['status'], 'success' | 'warning' | 'neutral' | 'danger'> = { pending: 'warning', accepted: 'success', cancelled: 'neutral', expired: 'danger' };

/**
 * Staff administration. SUPER_ADMIN invites administrators and trainers; ADMIN invites trainers.
 * Invitees receive a secure, single-use, expiring link and choose their own password – nobody else
 * ever sets or sees it. Roles become active only when the invited address accepts.
 */
export default function AdminStaffPage() {
  usePageMeta({ title: 'Staff', noIndex: true });
  const toast = useToast();
  const { role, profile } = useAuth();
  const isSuper = role === 'SUPER_ADMIN';
  const staff = useQuery({ queryKey: ['staff-accounts'], queryFn: listStaffAccounts });
  const invitations = useQuery({ queryKey: ['staff-invitations'], queryFn: listStaffInvitations });
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const r = await inviteStaff({ email: String(fd.get('email')), fullName: String(fd.get('full_name')), role: fd.get('role') === 'ADMIN' ? 'ADMIN' : 'TRAINER' });
      await invitations.refetch();
      setInviting(false);
      if (r.email_sent) toast.success('Invitation sent', 'The link is valid for 24 hours and can be used once.');
      else toast.error('Invitation created, e-mail not sent', r.email_error ?? 'Check the e-mail configuration, then send the invitation again.');
    } catch (err) {
      setError(friendlyError(err, 'invite-staff'));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (id: string, suspend: boolean) => {
    const reason = window.prompt(suspend ? 'Reason for suspending this staff account (recorded in the audit log):' : 'Reason for reactivating (recorded in the audit log):');
    if (reason === null) return;
    try {
      await setAccountStatus(id, suspend ? 'suspended' : 'active', reason || undefined);
      await staff.refetch();
      toast.success(suspend ? 'Account suspended' : 'Account reactivated');
    } catch (err) {
      toast.error('Not changed', friendlyError(err));
    }
  };

  if (staff.isError) return <ErrorState onRetry={() => staff.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Staff"
        description={isSuper ? 'Invite administrators and trainers. Only a super administrator can invite or change administrators.' : 'Invite trainers. Administrator invitations are handled by the super administrator.'}
        actions={
          <Button onClick={() => setInviting(true)} leftIcon={<MailPlus className="h-4 w-4" aria-hidden="true" />}>
            Invite staff
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Staff accounts" description="Assign trainers to courses and cohorts in Trainers." />
          {staff.isLoading ? (
            <Skeleton lines={4} />
          ) : (staff.data ?? []).length === 0 ? (
            <EmptyState compact title="No staff yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(staff.data ?? []).map((s) => {
                const canManage = s.id !== profile?.id && s.role !== 'SUPER_ADMIN' && (isSuper || s.role === 'TRAINER');
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-medium text-ink-900">
                        {s.full_name} {s.account_status === 'suspended' && <Badge tone="danger" size="sm">Suspended</Badge>}
                      </p>
                      <p className="text-xs text-ink-500">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm" tone={s.role === 'SUPER_ADMIN' ? 'brand' : s.role === 'ADMIN' ? 'info' : 'neutral'}>
                        {s.role.replace('_', ' ')}
                      </Badge>
                      {canManage &&
                        (s.account_status === 'active' ? (
                          <Button size="sm" variant="ghost" aria-label={`Suspend ${s.full_name}`} onClick={() => toggleStatus(s.id, true)}>
                            <UserX className="h-4 w-4 text-danger-600" aria-hidden="true" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" aria-label={`Reactivate ${s.full_name}`} onClick={() => toggleStatus(s.id, false)}>
                            <UserCheck className="h-4 w-4 text-success-600" aria-hidden="true" />
                          </Button>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Invitations" description="Pending invitations expire after 24 hours. Sending a new invitation to the same address replaces the old link." />
          {invitations.isLoading ? (
            <Skeleton lines={4} />
          ) : invitations.isError ? (
            <Alert tone="danger">{friendlyError(invitations.error)}</Alert>
          ) : (invitations.data ?? []).length === 0 ? (
            <EmptyState compact icon={<ShieldCheck className="h-5 w-5" />} title="No invitations yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(invitations.data ?? []).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink-900">
                      {i.full_name} <span className="text-xs text-ink-500">· {i.role}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {i.email} · sent {formatDate(i.created_at)}
                      {i.status === 'pending' && ` · expires ${formatDate(i.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge size="sm" tone={statusTone[i.status]}>
                      {i.status}
                    </Badge>
                    {i.status === 'pending' && (isSuper || i.role === 'TRAINER') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const r = await inviteStaff({ email: i.email, fullName: i.full_name, role: i.role });
                              await invitations.refetch();
                              if (r.email_sent) toast.success('Invitation resent', 'The previous link was replaced with a new 24-hour invitation.');
                              else toast.error('Invitation created, e-mail not sent', r.email_error ?? 'Check the e-mail configuration, then try again.');
                            } catch (err) {
                              toast.error('Not resent', friendlyError(err));
                            }
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm(`Cancel the invitation for ${i.email}? The link will stop working.`)) return;
                            try {
                              await cancelStaffInvitation(i.id);
                              await invitations.refetch();
                            } catch (err) {
                              toast.error('Not cancelled', friendlyError(err));
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={inviting} onClose={() => setInviting(false)} title="Invite a staff member">
        <form onSubmit={submit} className="space-y-4">
          <Input name="full_name" label="Full name" required minLength={2} maxLength={120} data-autofocus />
          <Input name="email" type="email" label="E-mail address" required hint="The invitation link is sent here and only works for this address." />
          <Select
            name="role"
            label="Role"
            required
            defaultValue="TRAINER"
            options={isSuper ? [{ value: 'TRAINER', label: 'Trainer' }, { value: 'ADMIN', label: 'Administrator' }] : [{ value: 'TRAINER', label: 'Trainer' }]}
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Send invitation
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
