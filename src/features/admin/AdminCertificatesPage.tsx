import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Ban, RefreshCw, ExternalLink } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listCertificates, listEnrollments, revokeCertificate, reissueCertificate, issueCertificate, certificateEligibility } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Misc';
import { CertificateStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import type { Certificate, PublicProfile } from '@/types/database';

type Row = Certificate & { student?: PublicProfile };

export default function AdminCertificatesPage() {
  const toast = useToast();
  const certs = useQuery({ queryKey: ['certificates'], queryFn: listCertificates });
  const completed = useQuery({ queryKey: ['enrollments', 'completed-candidates'], queryFn: () => listEnrollments({ status: 'active' }) });
  const [checking, setChecking] = useState<string | null>(null);
  usePageMeta({ title: 'Certificates', noIndex: true });
  if (certs.isError) return <ErrorState onRetry={() => certs.refetch()} />;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      await certs.refetch();
      toast.success(msg);
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  return (
    <>
      <PageHeader eyebrow="Certification" title="Certificates" description="Issue, revoke, reissue and verify certificates. Issuing checks every requirement server-side." />
      <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
        <DataTable<Row>
          caption="Issued certificates"
          rows={certs.data}
          loading={certs.isLoading}
          rowKey={(c) => c.id}
          empty={<EmptyState icon={<Award className="h-6 w-6" />} title="No certificates issued yet" description="Approve a student's completion from their enrollment page, then issue." />}
          columns={[
            { key: 'number', header: 'Number', primary: true, cell: (c) => <span className="font-mono text-sm">{c.certificate_number}</span> },
            { key: 'student', header: 'Student', cell: (c) => c.student_name },
            { key: 'course', header: 'Course', cell: (c) => c.course_title, hideOnMobile: true },
            { key: 'issued', header: 'Issued', cell: (c) => formatDate(c.issued_at) },
            { key: 'status', header: 'Status', cell: (c) => <CertificateStatusBadge status={c.status} /> },
          ]}
          rowActions={(c) => (
            <div className="flex justify-end gap-1">
              <Link to={`/certificate/${c.certificate_number}`} target="_blank" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                Verify <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              {c.status === 'issued' && (
                <Button size="sm" variant="ghost" leftIcon={<Ban className="h-4 w-4 text-danger-600" aria-hidden="true" />} onClick={() => { const r = window.prompt('Reason for revoking:'); if (r) void act(() => revokeCertificate(c.id, r), 'Certificate revoked'); }}>
                  Revoke
                </Button>
              )}
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={() => { const r = window.prompt('Reason for reissuing:'); if (!r) return; const name = window.prompt('Corrected student name (leave empty to keep):', c.student_name) ?? undefined; void act(() => reissueCertificate(c.id, r, name || undefined), 'Certificate reissued'); }}>
                Reissue
              </Button>
            </div>
          )}
        />
        <Card>
          <CardHeader title="Ready to issue?" description="Active enrollments – check eligibility and issue." />
          {completed.isLoading ? (
            <Skeleton lines={4} />
          ) : (completed.data ?? []).length === 0 ? (
            <EmptyState compact title="No active enrollments" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(completed.data ?? []).slice(0, 25).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/admin/enrollments/${e.id}`} className="min-w-0 truncate hover:underline">
                    {e.student?.full_name}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={checking === e.id}
                    onClick={async () => {
                      setChecking(e.id);
                      try {
                        const el = await certificateEligibility(e.id);
                        if (el.eligible) {
                          if (window.confirm(`${e.student?.full_name} is eligible. Issue certificate now?`)) await act(() => issueCertificate(e.id), 'Certificate issued');
                        } else {
                          window.alert(`Not eligible yet:\n• ${el.missing.join('\n• ')}`);
                        }
                      } catch (err) {
                        toast.error('Failed', friendlyError(err));
                      } finally {
                        setChecking(null);
                      }
                    }}
                  >
                    Check
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
