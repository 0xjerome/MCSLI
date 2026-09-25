import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Smartphone, Settings2, Award } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listAllPaymentMethods, savePaymentMethod, listSettings, setSetting } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Textarea, Checkbox } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Alert, Skeleton, ErrorState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { PaymentMethod } from '@/types/database';

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<'payments' | 'platform' | 'certificate' | 'fees'>('payments');
  usePageMeta({ title: 'Settings', noIndex: true });
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" description="Payment channels, platform options and certificate details. Course fees are edited per course." />
      <Tabs aria-label="Settings sections" value={tab} onChange={setTab} className="mb-6" tabs={[{ id: 'payments', label: 'Payment methods' }, { id: 'fees', label: 'Course fees' }, { id: 'certificate', label: 'Certificate' }, { id: 'platform', label: 'Platform' }]} />
      <TabPanel id="payments" value={tab}>
        <PaymentMethodsEditor />
      </TabPanel>
      <TabPanel id="fees" value={tab}>
        <Card>
          <CardHeader title="Course fees & installments" description="Tuition (Ugandan / non-Ugandan), the registration fee, installment count, amounts and which month requires installment 2 are configured on each course." />
          <ButtonLink to="/admin/courses">Open courses</ButtonLink>
        </Card>
      </TabPanel>
      <TabPanel id="certificate" value={tab}>
        <PlatformSettingsEditor keys={['certificate']} />
      </TabPanel>
      <TabPanel id="platform" value={tab}>
        <PlatformSettingsEditor keys={['registration_open', 'require_staff_mfa', 'support_email', 'support_phone', 'support_whatsapp', 'identity_retention_days']} />
      </TabPanel>
    </>
  );
}

function PaymentMethodsEditor() {
  const toast = useToast();
  const qc = useQueryClient();
  const methods = useQuery({ queryKey: ['payment-methods-admin'], queryFn: listAllPaymentMethods });
  const [busyId, setBusyId] = useState<string | null>(null);
  if (methods.isLoading) return <Skeleton className="h-64" />;
  if (methods.isError) return <ErrorState onRetry={() => methods.refetch()} />;

  const save = async (m: PaymentMethod, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusyId(m.id);
    try {
      await savePaymentMethod({
        id: m.id,
        display_name: String(fd.get('display_name')).trim(),
        bank_name: String(fd.get('bank_name')).trim() || null,
        account_name: String(fd.get('account_name')).trim() || null,
        account_number: String(fd.get('account_number')).trim() || null,
        branch: String(fd.get('branch')).trim() || null,
        swift_code: String(fd.get('swift_code')).trim() || null,
        merchant_code: String(fd.get('merchant_code')).trim() || null,
        currency: String(fd.get('currency')).trim() || 'UGX',
        instructions: String(fd.get('instructions')).trim() || null,
        is_enabled: fd.get('is_enabled') === 'on',
        position: Number(fd.get('position')) || 1,
      });
      await Promise.all([methods.refetch(), qc.invalidateQueries({ queryKey: ['payment-methods'] })]);
      toast.success(`${m.display_name} saved`);
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Students only see enabled methods">
        Enter MCSLI's real bank account and MTN / Airtel merchant details here, then enable each method. Nothing is invented by the platform — a method with missing details should stay disabled.
      </Alert>
      {(methods.data ?? []).map((m) => {
        const isBank = m.method_type === 'bank';
        const incomplete = isBank ? !(m.bank_name && m.account_name && m.account_number) : !m.merchant_code;
        return (
          <Card key={m.id}>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {isBank ? <Landmark className="h-5 w-5 text-brand-600" aria-hidden="true" /> : <Smartphone className="h-5 w-5 text-brand-600" aria-hidden="true" />}
                  {m.display_name}
                </span>
              }
              action={m.is_enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Disabled</Badge>}
            />
            {m.is_enabled && incomplete && (
              <Alert tone="danger" className="mb-4" title="Enabled but incomplete">
                Students will see this method without the details they need. Complete it or disable it.
              </Alert>
            )}
            <form onSubmit={(e) => save(m, e)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input name="display_name" label="Display name" required defaultValue={m.display_name} />
                <Input name="currency" label="Currency" defaultValue={m.currency} />
                <Input name="position" type="number" min={1} label="Order" defaultValue={m.position} />
              </div>
              {isBank ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="bank_name" label="Bank name" defaultValue={m.bank_name ?? ''} />
                  <Input name="account_name" label="Account name" defaultValue={m.account_name ?? ''} />
                  <Input name="account_number" label="Account number" defaultValue={m.account_number ?? ''} />
                  <Input name="branch" label="Branch" optionalLabel defaultValue={m.branch ?? ''} />
                  <Input name="swift_code" label="SWIFT code (international)" optionalLabel defaultValue={m.swift_code ?? ''} />
                  <input type="hidden" name="merchant_code" value="" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="merchant_code" label={`${m.method_type === 'mtn' ? 'MTN MoMo Pay' : 'Airtel Pay'} merchant code`} defaultValue={m.merchant_code ?? ''} />
                  <Input name="account_name" label="Registered merchant name" defaultValue={m.account_name ?? ''} hint="Required before the method can be enabled." />
                  <input type="hidden" name="bank_name" value="" />
                  <input type="hidden" name="account_number" value="" />
                  <input type="hidden" name="branch" value="" />
                  <input type="hidden" name="swift_code" value="" />
                </div>
              )}
              <Textarea name="instructions" label="Instructions shown to students" optionalLabel rows={2} defaultValue={m.instructions ?? ''} />
              <div className="flex items-center justify-between">
                <Checkbox name="is_enabled" label="Enabled – visible to students (requires the details above)" defaultChecked={m.is_enabled} />
                <Button type="submit" loading={busyId === m.id}>
                  Save
                </Button>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

const labels: Record<string, { label: string; hint?: string; type: 'boolean' | 'text' | 'number' | 'json' }> = {
  registration_open: { label: 'Registration open', hint: 'When off, new accounts cannot enroll. Super admin only.', type: 'boolean' },
  require_staff_mfa: { label: 'Require two-factor authentication for staff', hint: 'Trainers and administrators must verify an authenticator code to use staff tools. Set up two-factor authentication on your own profile first. Super admin only.', type: 'boolean' },
  support_email: { label: 'Support e-mail', type: 'text' },
  support_phone: { label: 'Support phone', type: 'text' },
  support_whatsapp: { label: 'Support WhatsApp', type: 'text' },
  identity_retention_days: { label: 'Identity document retention (days)', hint: 'Guideline for deleting verified documents.', type: 'number' },
  certificate: { label: 'Certificate details', hint: 'signatory_name, signatory_title, issuer, footer_note', type: 'json' },
};

function PlatformSettingsEditor({ keys }: { keys: string[] }) {
  const toast = useToast();
  const settings = useQuery({ queryKey: ['platform-settings'], queryFn: listSettings });
  const [busy, setBusy] = useState(false);
  if (settings.isLoading) return <Skeleton className="h-48" />;
  if (settings.isError) return <ErrorState onRetry={() => settings.refetch()} />;
  const byKey = new Map((settings.data ?? []).map((s) => [s.key, s.value]));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      for (const k of keys) {
        const meta = labels[k] ?? { label: k, type: 'text' as const };
        let value: unknown;
        if (meta.type === 'boolean') value = fd.get(k) === 'on';
        else if (meta.type === 'number') value = Number(fd.get(k));
        else if (meta.type === 'json') value = JSON.parse(String(fd.get(k)));
        else value = String(fd.get(k));
        await setSetting(k, value as never);
      }
      await settings.refetch();
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title={keys.includes('certificate') ? 'Certificate settings' : 'Platform settings'} description={keys.includes('certificate') ? 'Printed on every certificate PDF. Leave the signatory name empty until MCSLI confirms who signs.' : undefined} />
      <form onSubmit={submit} className="space-y-4">
        {keys.map((k) => {
          const meta = labels[k] ?? { label: k, type: 'text' as const };
          const v = byKey.get(k);
          if (meta.type === 'boolean') return <Checkbox key={k} name={k} label={meta.label} description={meta.hint} defaultChecked={Boolean(v)} />;
          if (meta.type === 'json') {
            const obj = (v as Record<string, string>) ?? {};
            return (
              <div key={k} className="space-y-3">
                <CertificateFields value={obj} name={k} />
              </div>
            );
          }
          return <Input key={k} name={k} label={meta.label} hint={meta.hint} type={meta.type === 'number' ? 'number' : 'text'} defaultValue={v == null ? '' : String(v)} />;
        })}
        <Button type="submit" loading={busy} leftIcon={<Settings2 className="h-4 w-4" aria-hidden="true" />}>
          Save settings
        </Button>
      </form>
    </Card>
  );
}

function CertificateFields({ value, name }: { value: Record<string, string>; name: string }) {
  const [v, setV] = useState({ signatory_name: value.signatory_name ?? '', signatory_title: value.signatory_title ?? 'Founder & Executive Director', issuer: value.issuer ?? 'Master Class Sign Language Initiative (MCSLI)', footer_note: value.footer_note ?? 'Verify this certificate at mcsli.org/certificate/<number>' });
  return (
    <>
      <input type="hidden" name={name} value={JSON.stringify(v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Signatory name" value={v.signatory_name} onChange={(e) => setV({ ...v, signatory_name: e.target.value })} leftAddon={<Award className="h-4 w-4" aria-hidden="true" />} />
        <Input label="Signatory title" value={v.signatory_title} onChange={(e) => setV({ ...v, signatory_title: e.target.value })} />
        <Input label="Issuer" value={v.issuer} onChange={(e) => setV({ ...v, issuer: e.target.value })} />
        <Input label="Footer note" value={v.footer_note} onChange={(e) => setV({ ...v, footer_note: e.target.value })} hint="<number> is replaced with the certificate number." />
      </div>
    </>
  );
}
