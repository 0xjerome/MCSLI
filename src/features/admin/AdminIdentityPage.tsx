import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, FileText, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listIdentities, listIdentityDocumentsFor, reviewIdentity, revealIdentityNumber, adminDocumentUrl, adminDeleteIdentityDocument, type IdentityRow } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton, ErrorState, EmptyState, DescriptionList, Alert } from '@/components/ui/Misc';
import { IdentityStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { formatDate, humanFileSize } from '@/lib/utils';
import type { IdentityStatus } from '@/domain/types';

export default function AdminIdentityPage() {
  const [tab, setTab] = useState<IdentityStatus>('pending');
  const q = useQuery({ queryKey: ['identities', tab], queryFn: () => listIdentities(tab) });
  usePageMeta({ title: 'Identity verification', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Compliance" title="Identity verification" description="Verify each student's identification against the uploaded document. Numbers are masked; revealing one is recorded in the audit log." />
      <Tabs aria-label="Verification status" value={tab} onChange={setTab} className="mb-6" tabs={[{ id: 'pending', label: 'Pending' }, { id: 'verified', label: 'Verified' }, { id: 'rejected', label: 'Rejected' }]} />
      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={`No ${tab} verifications`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(q.data ?? []).map((row) => (
            <IdentityReviewCard key={row.id} row={row} onChanged={() => q.refetch()} />
          ))}
        </div>
      )}
    </>
  );
}

export function IdentityReviewCard({ row, onChanged }: { row: IdentityRow; onChanged: () => void }) {
  const toast = useToast();
  const docs = useQuery({ queryKey: ['identity-docs', row.user_id], queryFn: () => listIdentityDocumentsFor(row.user_id) });
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async () => {
    if (revealed) return setRevealed(null);
    try {
      setRevealed(await revealIdentityNumber(row.id));
      setTimeout(() => setRevealed(null), 60_000);
    } catch (err) {
      toast.error('Could not reveal', friendlyError(err));
    }
  };

  const decide = async (decision: 'verified' | 'rejected') => {
    const reason = decision === 'rejected' ? window.prompt('Reason for rejection (shown to the student):') : null;
    if (decision === 'rejected' && !reason) return;
    setBusy(true);
    try {
      await reviewIdentity(row.id, decision, reason ?? undefined);
      toast.success(decision === 'verified' ? 'Identity verified' : 'Marked for resubmission', 'The student has been notified.');
      onChanged();
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (id: string, path: string) => {
    try {
      window.open(await adminDocumentUrl(id, path), '_blank', 'noopener');
    } catch (err) {
      toast.error('Could not open document', friendlyError(err));
    }
  };

  return (
    <Card>
      <CardHeader title={row.profile?.full_name ?? row.full_name_on_document} description={row.profile?.email} action={<IdentityStatusBadge status={row.status} />} />
      <DescriptionList
        items={[
          { label: 'Document type', value: row.doc_type === 'national_id' ? 'National ID (NIN)' : row.doc_type === 'passport' ? 'Passport' : 'Other ID' },
          {
            label: 'Number',
            value: (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{revealed ?? row.id_number_masked}</span>
                <button type="button" onClick={reveal} className="rounded p-1 text-ink-500 hover:bg-ink-100" aria-label={revealed ? 'Hide full number' : 'Reveal full number (audited)'} title={revealed ? 'Hide' : 'Reveal (audited)'}>
                  {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </span>
            ),
          },
          { label: 'Name on document', value: row.full_name_on_document },
          { label: 'Issuing country', value: row.issuing_country },
          { label: 'Classification', value: row.profile?.nationality === 'ugandan' ? 'Ugandan' : 'International' },
          { label: 'Submitted', value: formatDate(row.submitted_at) },
        ]}
      />
      {row.rejection_reason && <Alert tone="danger" className="mt-3">{row.rejection_reason}</Alert>}
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-500">Documents</h3>
      {docs.isLoading ? (
        <Skeleton lines={2} className="mt-2" />
      ) : (docs.data ?? []).length === 0 ? (
        <p className="mt-1 text-sm text-warning-700">No document uploaded yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {(docs.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg border border-ink-200 p-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {d.file_name} <span className="text-xs text-ink-500">({humanFileSize(d.size_bytes)})</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => openDoc(d.id, d.storage_path)}>
                Open (audited)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Delete document"
                onClick={async () => {
                  if (!window.confirm('Delete this document permanently (retention policy)?')) return;
                  try {
                    await adminDeleteIdentityDocument(d.id);
                    await docs.refetch();
                  } catch (err) {
                    toast.error('Failed', friendlyError(err));
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {row.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <Button onClick={() => decide('verified')} loading={busy} leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
            Verify
          </Button>
          <Button variant="outline" onClick={() => decide('rejected')} loading={busy} leftIcon={<ShieldX className="h-4 w-4" aria-hidden="true" />}>
            Request resubmission
          </Button>
        </div>
      )}
    </Card>
  );
}
