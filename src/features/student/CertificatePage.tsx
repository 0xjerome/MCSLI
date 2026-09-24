import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Download, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { usePageMeta, SITE_URL } from '@/lib/seo';
import { friendlyError, getSupabase } from '@/lib/supabase';
import { useMyEnrollment } from './useEnrollment';
import { listMyCertificates, getCertificateEligibility } from '@/services/student';
import { buildCertificatePdf, downloadBytes, type CertificateSettings } from '@/features/certificates/certificatePdf';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CertificateStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import type { Certificate } from '@/types/database';

async function fetchCertificateSettings(): Promise<CertificateSettings> {
  const { data } = await getSupabase().rpc('get_public_settings');
  return ((data as Record<string, unknown> | null)?.certificate as CertificateSettings) ?? {};
}

export default function CertificatePage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const certs = useQuery({ queryKey: ['my-certificates'], queryFn: listMyCertificates });
  const eligibility = useQuery({ queryKey: ['cert-eligibility', enrollment?.id], queryFn: () => getCertificateEligibility(enrollment!.id), enabled: Boolean(enrollment) });
  const settings = useQuery({ queryKey: ['cert-settings'], queryFn: fetchCertificateSettings });
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  usePageMeta({ title: 'Certificate', noIndex: true });

  if (isLoading || certs.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (certs.isError) return <ErrorState onRetry={() => certs.refetch()} />;

  const download = async (c: Certificate) => {
    setBusyId(c.id);
    try {
      const bytes = await buildCertificatePdf(c, settings.data ?? {});
      downloadBytes(bytes, `MCSLI-Certificate-${c.certificate_number}.pdf`);
    } catch (e) {
      toast.error('Could not generate PDF', friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const list = certs.data ?? [];
  const requirements = eligibility.data?.missing ?? [];

  return (
    <>
      <PageHeader eyebrow="Certificate" title="Your certificate" description="Issued by MCSLI when you complete the course. Every certificate has a unique number and QR code that anyone can verify." />

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Award className="h-6 w-6" />} title="No certificate issued yet" description="Once every requirement below is met and MCSLI approves your completion, an administrator issues your certificate and you will be notified." />
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-500">Requirements</h2>
          {eligibility.isLoading ? (
            <Skeleton lines={4} className="mt-3" />
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {requirements.length === 0 ? (
                <li className="flex items-center gap-2 text-success-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> All requirements met — awaiting issue by MCSLI.
                </li>
              ) : (
                requirements.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-ink-700">
                    <Circle className="h-4 w-4 text-ink-300" aria-hidden="true" /> {r}
                  </li>
                ))
              )}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader eyebrow={c.certificate_title} title={c.course_title} action={<CertificateStatusBadge status={c.status} />} />
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-500">Certificate number</dt>
                  <dd className="font-mono font-semibold text-ink-900">{c.certificate_number}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-500">Issued to</dt>
                  <dd className="text-ink-900">{c.student_name}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-500">Completion / issue date</dt>
                  <dd className="text-ink-900">
                    {formatDate(c.completion_date)} · {formatDate(c.issued_at)}
                  </dd>
                </div>
              </dl>
              {c.status === 'revoked' && <p className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">This certificate was revoked{c.revoke_reason ? `: ${c.revoke_reason}` : ''}. {c.reissued_from ? '' : 'Contact MCSLI if you believe this is a mistake.'}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => download(c)} loading={busyId === c.id} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />} disabled={c.status !== 'issued'}>
                  Download PDF
                </Button>
                <Link to={`/certificate/${c.certificate_number}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-300 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-50">
                  Public verification page <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-3 text-xs text-ink-500">Share the verification link with employers: {SITE_URL}/certificate/{c.certificate_number}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
