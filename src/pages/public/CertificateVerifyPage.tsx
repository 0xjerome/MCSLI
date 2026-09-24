import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldX, Search } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { verifyCertificate } from '@/services/public';
import { isSupabaseConfigured, friendlyError } from '@/lib/supabase';
import { isValidCertificateNumber } from '@/domain/certificates';
import { Section, PageHero } from '@/components/public/Sections';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, DescriptionList, Spinner } from '@/components/ui/Misc';
import { CertificateStatusBadge } from '@/components/StatusBadges';
import { formatDate } from '@/lib/utils';

export default function CertificateVerifyPage() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateId ?? '');
  const [error, setError] = useState('');
  const number = (certificateId ?? '').trim().toUpperCase();
  usePageMeta({ title: 'Verify a certificate', description: 'Check whether an MCSLI certificate is genuine by entering its certificate number.', path: '/certificate', noIndex: Boolean(certificateId) });

  useEffect(() => setInput(certificateId ?? ''), [certificateId]);

  const q = useQuery({ queryKey: ['verify-cert', number], queryFn: () => verifyCertificate(number), enabled: Boolean(number) && isSupabaseConfigured && isValidCertificateNumber(number) });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = input.trim().toUpperCase();
    if (!isValidCertificateNumber(n)) {
      setError('Enter a certificate number in the format MCSLI-YYYY-XXXXXX.');
      return;
    }
    setError('');
    navigate(`/certificate/${n}`);
  };

  return (
    <>
      <PageHero eyebrow="Certificate verification" title="Verify an MCSLI certificate" description="Every certificate issued through the MCSLI learning platform carries a unique number and QR code. Enter the number to confirm it is genuine and still valid." />
      <Section>
        <div className="mx-auto max-w-xl">
          <form onSubmit={onSubmit} noValidate className="card p-6">
            <Input label="Certificate number" value={input} onChange={(e) => setInput(e.target.value)} placeholder="MCSLI-2026-ABC123" autoComplete="off" spellCheck={false} error={error} leftAddon={<Search className="h-4 w-4" aria-hidden="true" />} />
            <Button type="submit" className="mt-4" fullWidth>
              Verify certificate
            </Button>
          </form>

          {number && !isSupabaseConfigured && (
            <Alert tone="info" className="mt-6" title="Verification service unavailable">
              Please contact MCSLI to confirm this certificate.
            </Alert>
          )}
          {q.isLoading && (
            <div className="mt-6">
              <Spinner label="Checking" />
            </div>
          )}
          {q.isError && (
            <Alert tone="danger" className="mt-6" title="Could not verify right now">
              {friendlyError(q.error)}
            </Alert>
          )}
          {q.data && !q.data.found && (
            <div role="status" className="mt-6 flex gap-4 rounded-2xl border border-danger-100 bg-danger-50 p-6">
              <ShieldX className="h-8 w-8 shrink-0 text-danger-600" aria-hidden="true" />
              <div>
                <p className="font-semibold text-danger-700">No certificate found for {number}</p>
                <p className="mt-1 text-sm text-ink-700">Check the number carefully. If you believe this certificate should exist, contact MCSLI.</p>
              </div>
            </div>
          )}
          {q.data?.found && (
            <div role="status" className="mt-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
              <div className="flex items-start gap-4">
                <ShieldCheck className={`h-8 w-8 shrink-0 ${q.data.status === 'issued' ? 'text-success-600' : 'text-danger-600'}`} aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">{q.data.status === 'issued' ? 'Genuine MCSLI certificate' : 'This certificate has been revoked'}</p>
                    <CertificateStatusBadge status={q.data.status!} />
                  </div>
                  <DescriptionList
                    className="mt-4"
                    items={[
                      { label: 'Certificate number', value: <span className="font-mono">{q.data.certificate_number}</span> },
                      { label: 'Issued to', value: q.data.student_name },
                      { label: 'Course', value: q.data.course_title },
                      { label: 'Award', value: q.data.certificate_title },
                      { label: 'Completion date', value: formatDate(q.data.completion_date) },
                      { label: 'Issued on', value: formatDate(q.data.issued_at) },
                      ...(q.data.revoked_at ? [{ label: 'Revoked on', value: formatDate(q.data.revoked_at) }] : []),
                    ]}
                  />
                  <p className="mt-4 text-xs text-ink-500">Issued by Master Class Sign Language Initiative (MCSLI), Kampala, Uganda. This page shows only the information needed to confirm authenticity.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
