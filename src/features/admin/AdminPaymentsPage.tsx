import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Eye } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listPayments, reviewPayment, type PaymentRow } from '@/services/staff';
import { proofUrl } from '@/services/payments';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, DescriptionList } from '@/components/ui/Misc';
import { PaymentStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatUGX } from '@/lib/utils';
import type { PaymentStatus } from '@/domain/types';

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<'review' | PaymentStatus>('review');
  const q = useQuery({ queryKey: ['payments', tab], queryFn: () => listPayments({ status: tab }) });
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [busy, setBusy] = useState(false);
  usePageMeta({ title: 'Payments', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const decide = async (decision: 'confirmed' | 'rejected' | 'under_review', note?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await reviewPayment(selected.id, decision, note);
      toast.success(decision === 'confirmed' ? 'Payment confirmed' : decision === 'rejected' ? 'Payment rejected' : 'Marked under review', 'The student has been notified.');
      setSelected(null);
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ['admin-stats'] })]);
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Finance" title="Payment verification" description="Match each submission against the bank or mobile-money statement, then confirm or reject. Confirmations issue a receipt number and can unlock the student's next month." />
      <Tabs aria-label="Payment status" value={tab} onChange={setTab} className="mb-4" tabs={[{ id: 'review', label: 'To review' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'rejected', label: 'Rejected' }]} />
      <DataTable<PaymentRow>
        caption="Payments"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(p) => p.id}
        onRowClick={setSelected}
        empty={<EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments here" />}
        columns={[
          { key: 'student', header: 'Student', primary: true, cell: (p) => p.student?.full_name },
          { key: 'what', header: 'For', cell: (p) => (p.purpose === 'registration' ? 'Registration' : `Tuition${p.installment_number ? ` #${p.installment_number}` : ''}`) },
          { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="tabular-nums">{formatUGX(Number(p.amount), p.currency)}</span> },
          { key: 'method', header: 'Method', cell: (p) => ({ bank: 'Bank', mtn: 'MTN', airtel: 'Airtel' })[p.method_type] },
          { key: 'ref', header: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
          { key: 'paid', header: 'Paid on', cell: (p) => formatDate(p.paid_at), hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (p) => <PaymentStatusBadge status={p.status} /> },
        ]}
      />

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} title="Review payment" size="lg">
        {selected && (
          <div className="space-y-4">
            <DescriptionList
              items={[
                { label: 'Student', value: <Link to={`/admin/enrollments/${selected.enrollment.id}`} className="text-brand-700 hover:underline">{selected.student?.full_name}</Link> },
                { label: 'E-mail', value: selected.student?.email },
                { label: 'Course', value: `${selected.enrollment.course.title} (${selected.enrollment.plan_type})` },
                { label: 'Purpose', value: selected.purpose === 'registration' ? 'Registration fee' : `Tuition installment ${selected.installment_number ?? 1}` },
                { label: 'Amount', value: formatUGX(Number(selected.amount), selected.currency) },
                { label: 'Method', value: { bank: 'Bank transfer', mtn: 'MTN MoMo', airtel: 'Airtel Money' }[selected.method_type] },
                { label: 'Payer name', value: selected.payer_name },
                { label: 'Reference', value: <span className="font-mono">{selected.reference}</span> },
                { label: 'Paid on', value: formatDate(selected.paid_at) },
                { label: 'Submitted', value: formatDateTime(selected.submitted_at) },
                { label: 'Status', value: <PaymentStatusBadge status={selected.status} /> },
                { label: 'Receipt', value: selected.receipt_number ?? '—' },
              ]}
            />
            {selected.proof_path && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
                onClick={async () => {
                  try {
                    window.open(await proofUrl(selected.proof_path!), '_blank', 'noopener');
                  } catch (err) {
                    toast.error('Could not open proof', friendlyError(err));
                  }
                }}
              >
                View uploaded proof
              </Button>
            )}
            {selected.review_note && <p className="text-sm text-ink-600">Note: {selected.review_note}</p>}
            {selected.status !== 'confirmed' && (
              <form
                className="space-y-3 border-t border-ink-200 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const note = String(new FormData(e.currentTarget).get('note')) || undefined;
                  const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as 'confirmed' | 'rejected' | 'under_review';
                  void decide(decision, note);
                }}
              >
                <Textarea name="note" label="Note to the student / internal note" optionalLabel rows={2} placeholder="e.g. Matched MoMo statement 24 Sep." />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="submit" value="under_review" variant="outline" loading={busy}>
                    Mark under review
                  </Button>
                  <Button type="submit" value="rejected" variant="danger" loading={busy}>
                    Reject
                  </Button>
                  <Button type="submit" value="confirmed" loading={busy}>
                    Confirm payment
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
