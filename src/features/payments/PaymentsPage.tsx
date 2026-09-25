import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Smartphone, Upload, Receipt, Copy, Check, Info } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { formatUGX, formatDate, cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyEnrollment } from '@/features/student/useEnrollment';
import { listPaymentMethods, listMyPayments, submitPayment, uploadPaymentProof, validateUpload, proofUrl } from '@/services/payments';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, RadioCards } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { DataTable } from '@/components/ui/DataTable';
import { PaymentStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { Payment, PaymentMethod } from '@/types/database';

type Item = { key: string; label: string; purpose: 'registration' | 'tuition'; installment: number | null; amount: number; dueBeforeMonth: number };

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="ml-1 rounded p-0.5 text-ink-400 hover:text-ink-700"
      aria-label={`Copy ${value}`}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        })
      }
    >
      {ok ? <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { enrollment, isLoading } = useMyEnrollment();
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: listPaymentMethods });
  const payments = useQuery({ queryKey: ['my-payments', enrollment?.id], queryFn: () => listMyPayments(enrollment!.id), enabled: Boolean(enrollment) });
  const [itemKey, setItemKey] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  usePageMeta({ title: 'Payments', noIndex: true });

  const items = useMemo<Item[]>(() => {
    if (!enrollment) return [];
    const list: Item[] = [{ key: 'registration', label: 'Registration fee', purpose: 'registration', installment: null, amount: Number(enrollment.registration_fee), dueBeforeMonth: 1 }];
    for (const i of enrollment.installments) {
      list.push({ key: `tuition-${i.number}`, label: enrollment.plan_type === 'full' ? 'Tuition (full)' : `Tuition installment ${i.number}`, purpose: 'tuition', installment: enrollment.plan_type === 'full' ? null : i.number, amount: Number(i.amount), dueBeforeMonth: i.due_before_month });
    }
    return list;
  }, [enrollment]);

  const statusFor = (it: Item): { paid: number; status: Payment['status'] | 'unpaid' } => {
    const rel = (payments.data ?? []).filter((p) => p.purpose === it.purpose && (it.purpose === 'registration' || enrollment?.plan_type === 'full' || p.installment_number === it.installment));
    const confirmed = rel.filter((p) => p.status === 'confirmed').reduce((a, p) => a + Number(p.amount), 0);
    if (confirmed >= it.amount) return { paid: confirmed, status: 'confirmed' };
    const pending = rel.find((p) => p.status === 'pending' || p.status === 'under_review');
    if (pending) return { paid: confirmed, status: pending.status };
    const rejected = rel.find((p) => p.status === 'rejected');
    if (rejected) return { paid: confirmed, status: 'rejected' };
    return { paid: confirmed, status: 'unpaid' };
  };

  if (isLoading || methods.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (methods.isError) return <ErrorState onRetry={() => methods.refetch()} />;

  const enabledMethods = (methods.data ?? []).filter((m) => m.is_enabled);
  const selectedItem = items.find((i) => i.key === itemKey) ?? items.find((i) => statusFor(i).status === 'unpaid' || statusFor(i).status === 'rejected') ?? null;
  const selectedMethod = enabledMethods.find((m) => m.id === methodId) ?? enabledMethods[0] ?? null;
  const outstanding = items.filter((i) => statusFor(i).status !== 'confirmed');

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem || !selectedMethod || !user) return;
    const fd = new FormData(e.currentTarget);
    const amount = Number(String(fd.get('amount')).replace(/[^\d.]/g, ''));
    setError('');
    if (!amount || amount <= 0) return setError('Enter the amount you paid.');
    setBusy(true);
    try {
      let proofPath: string | null = null;
      if (file) proofPath = await uploadPaymentProof(user.id, file);
      await submitPayment({
        enrollmentId: enrollment.id,
        purpose: selectedItem.purpose,
        installmentNumber: selectedItem.installment,
        methodId: selectedMethod.id,
        amount,
        payerName: String(fd.get('payer_name')),
        reference: String(fd.get('reference')),
        paidAt: String(fd.get('paid_at')),
        proofPath,
      });
      await qc.invalidateQueries({ queryKey: ['my-payments'] });
      toast.success('Payment submitted', 'An MCSLI administrator will confirm it, usually within one working day.');
      (e.target as HTMLFormElement).reset();
      setFile(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Payments" title="Fees & payments" description={`${enrollment.course.title} · ${enrollment.plan_type === 'full' ? 'Paying in full' : `${enrollment.installments.length} installments`} · Fees fixed at enrollment.`} />

      {/* Fee schedule */}
      <Card padding="none">
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 className="font-semibold">Your fee schedule</h2>
        </div>
        <ul className="divide-y divide-ink-100">
          {items.map((it) => {
            const st = statusFor(it);
            return (
              <li key={it.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink-900">{it.label}</p>
                  <p className="text-xs text-ink-500">Required before Month {it.dueBeforeMonth}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatUGX(it.amount, enrollment.currency)}</span>
                  {st.status === 'unpaid' ? <Badge tone="warning">Not paid</Badge> : <PaymentStatusBadge status={st.status} />}
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="font-semibold">Total</span>
            <span className="font-semibold tabular-nums">{formatUGX(Number(enrollment.registration_fee) + Number(enrollment.tuition_amount), enrollment.currency)}</span>
          </li>
        </ul>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 [&>*]:min-w-0">
        {/* How to pay */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="How to pay" description="Pay with one of MCSLI's official channels, then submit the details so an administrator can confirm it." />
            {enabledMethods.length === 0 ? (
              <Alert tone="warning" title="Payment details not yet published">
                MCSLI has not yet configured its payment channels on the platform. Contact MCSLI via Help for instructions.
              </Alert>
            ) : (
              <div className="space-y-3">
                {enabledMethods.map((m) => (
                  <MethodCard key={m.id} method={m} />
                ))}
              </div>
            )}
          </Card>
          <p className="flex items-start gap-2 text-xs text-ink-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Payments are confirmed manually against MCSLI's bank and mobile-money statements. Automated Mobile Money confirmation may be added in future; nothing is charged automatically from this app.
          </p>
        </div>

        {/* Submit payment */}
        <Card className="lg:col-span-3">
          <CardHeader title="Submit a payment" description="After paying, tell us what you paid and the transaction reference." />
          {outstanding.length === 0 ? (
            <Alert tone="success" title="All fees confirmed">
              Thank you — you have no outstanding payments.
            </Alert>
          ) : enabledMethods.length === 0 ? (
            <EmptyState compact title="Payment channels unavailable" description="Once MCSLI publishes its payment details you can submit payments here." />
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <RadioCards
                name="item"
                legend="What are you paying for?"
                value={selectedItem?.key ?? null}
                onChange={setItemKey}
                columns={2}
                options={outstanding.map((it) => ({ value: it.key, title: it.label, description: formatUGX(it.amount, enrollment.currency) }))}
              />
              <RadioCards
                name="method"
                legend="Payment method used"
                value={selectedMethod?.id ?? null}
                onChange={setMethodId}
                columns={2}
                options={enabledMethods.map((m) => ({ value: m.id, title: m.display_name }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="amount" label={`Amount paid (${enrollment.currency})`} type="number" inputMode="numeric" min={1} required defaultValue={selectedItem?.amount} key={selectedItem?.key} />
                <Input name="paid_at" label="Payment date" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="payer_name" label="Payer name" required hint="Name on the mobile money account or bank transfer." defaultValue={user?.user_metadata?.full_name as string | undefined} />
                <Input name="reference" label="Transaction / reference number" required minLength={3} maxLength={100} autoComplete="off" spellCheck={false} hint="From your MoMo / Airtel SMS or bank slip." />
              </div>
              <div>
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm', file ? 'border-brand-400 bg-brand-50/50' : 'border-ink-300 hover:bg-ink-50')}>
                  <Upload className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-900">{file ? file.name : 'Attach receipt or screenshot (optional)'}</span>
                    <span className="block text-xs text-ink-500">JPG, PNG, WEBP or PDF · max 10 MB · stored privately</span>
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      const v = f ? validateUpload(f) : null;
                      setFileErr(v ?? '');
                      setFile(v ? null : f);
                    }}
                  />
                </label>
                {fileErr && <p className="mt-1 text-sm text-danger-700" role="alert">{fileErr}</p>}
              </div>
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" loading={busy} leftIcon={<Receipt className="h-4 w-4" aria-hidden="true" />}>
                Submit payment for confirmation
              </Button>
            </form>
          )}
        </Card>
      </div>

      {/* History */}
      <Card className="mt-6">
        <CardHeader title="Payment history" description="Every payment you have submitted, with its status and receipt number once confirmed." />
        <DataTable<Payment>
          caption="Payment history"
          rows={payments.data}
          loading={payments.isLoading}
          rowKey={(p) => p.id}
          empty={<EmptyState compact title="No payments submitted yet" />}
          columns={[
            { key: 'what', header: 'Payment', primary: true, cell: (p) => (p.purpose === 'registration' ? 'Registration fee' : `Tuition${p.installment_number ? ` · installment ${p.installment_number}` : ''}`) },
            { key: 'amount', header: 'Amount', cell: (p) => <span className="tabular-nums">{formatUGX(Number(p.amount), p.currency)}</span>, align: 'right' },
            { key: 'method', header: 'Method', cell: (p) => ({ bank: 'Bank', mtn: 'MTN MoMo', airtel: 'Airtel Money' })[p.method_type] },
            { key: 'ref', header: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
            { key: 'date', header: 'Paid on', cell: (p) => formatDate(p.paid_at) },
            { key: 'status', header: 'Status', cell: (p) => <PaymentStatusBadge status={p.status} /> },
            { key: 'receipt', header: 'Receipt', cell: (p) => (p.receipt_number ? <span className="font-mono text-xs">{p.receipt_number}</span> : p.review_note && p.status === 'rejected' ? <span className="text-xs text-danger-700">{p.review_note}</span> : '—') },
            { key: 'proof', header: 'Proof', hideOnMobile: true, cell: (p) => (p.proof_path ? <ProofLink path={p.proof_path} /> : '—') },
          ]}
        />
      </Card>
    </>
  );
}

function ProofLink({ path }: { path: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="text-xs font-semibold text-brand-700 hover:underline"
      onClick={async () => {
        try {
          window.open(await proofUrl(path), '_blank', 'noopener');
        } catch (e) {
          toast.error('Could not open proof', friendlyError(e));
        }
      }}
    >
      View
    </button>
  );
}

function MethodCard({ method: m }: { method: PaymentMethod }) {
  const Icon = m.method_type === 'bank' ? Landmark : Smartphone;
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <p className="flex items-center gap-2 font-semibold text-ink-900">
        <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" /> {m.display_name}
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        {m.bank_name && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Bank</dt>
            <dd className="text-right font-medium">{m.bank_name}</dd>
          </div>
        )}
        {m.account_name && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Account name</dt>
            <dd className="text-right font-medium">{m.account_name}</dd>
          </div>
        )}
        {m.account_number && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Account number</dt>
            <dd className="flex items-center break-all font-mono font-medium">
              {m.account_number} <CopyBtn value={m.account_number} />
            </dd>
          </div>
        )}
        {m.branch && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Branch</dt>
            <dd className="text-right font-medium">{m.branch}</dd>
          </div>
        )}
        {m.swift_code && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">SWIFT</dt>
            <dd className="font-mono font-medium">{m.swift_code}</dd>
          </div>
        )}
        {m.merchant_code && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Merchant code</dt>
            <dd className="flex items-center font-mono text-base font-semibold text-brand-700">
              {m.merchant_code} <CopyBtn value={m.merchant_code} />
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Currency</dt>
          <dd className="font-medium">{m.currency}</dd>
        </div>
      </dl>
      {m.instructions && <p className="mt-2 text-xs text-ink-600">{m.instructions}</p>}
    </div>
  );
}
