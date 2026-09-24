import { Landmark, Smartphone, Gift, HeartHandshake, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero } from '@/components/public/Sections';
import { SectionHeader } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-base font-semibold text-ink-900">{value}</span>
      <button
        type="button"
        className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="h-4 w-4 text-success-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </span>
  );
}

export default function DonatePage() {
  const { content } = useSiteContent();
  const { donation, contact } = content;
  usePageMeta({ title: 'Support MCSLI', description: donation.intro, path: '/donate' });

  return (
    <>
      <PageHero eyebrow="Make a difference" title="Support our mission" description={donation.intro} image="/media/gallery/certificate-award-ceremony.jpg" imageAlt="Graduates receiving certificates on stage at an MCSLI certificate award ceremony." />

      <Section>
        <SectionHeader eyebrow="Payment options" title="Choose the way that works for you" description="Every contribution, regardless of size, makes a meaningful difference. These are MCSLI's official donation channels as published by the organisation." />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {donation.bank && (
            <div className="card p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                <Landmark className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">Bank transfer</h3>
              <p className="mt-1 text-sm text-ink-600">Available for both local and international transfers.</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Bank</dt>
                  <dd className="font-semibold">{donation.bank.bankName}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Account name</dt>
                  <dd className="font-semibold">{donation.bank.accountName}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Account number</dt>
                  <dd>
                    <CopyValue value={donation.bank.accountNumber} label="account number" />
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Currency</dt>
                  <dd className="font-semibold">{donation.bank.currency}</dd>
                </div>
                {donation.bank.swift && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-ink-600">SWIFT (international)</dt>
                    <dd>
                      <CopyValue value={donation.bank.swift} label="SWIFT code" />
                    </dd>
                  </div>
                )}
              </dl>
              {donation.bank.note && <p className="mt-3 text-xs text-ink-500">{donation.bank.note}</p>}
            </div>
          )}
          <div className="card p-6 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600" aria-hidden="true">
              <Smartphone className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Mobile money</h3>
            <p className="mt-1 text-sm text-ink-600">Use the MoMo Pay / Airtel Pay merchant codes to donate directly.</p>
            <ul className="mt-5 space-y-3">
              {donation.mobileMoney.map((m) => (
                <li key={m.provider} className="flex items-center justify-between rounded-xl border border-ink-200 p-4">
                  <div>
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs text-ink-500">Merchant code</p>
                  </div>
                  <CopyValue value={m.merchantCode} label={`${m.provider} merchant code`} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Available 24/7 · Secure · Instant</p>
          </div>
          <div className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-700" aria-hidden="true">
              <Gift className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">In-kind donations</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {donation.inKind.map((i) => (
                <li key={i} className="rounded-full bg-ink-100 px-3 py-1 text-sm text-ink-700">
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Sponsor a student</h3>
            <p className="mt-2 text-sm text-ink-600">Sponsor a learner's complete training programme, certificate included, and receive progress updates.</p>
            <ButtonLink to="/contact?topic=donation" variant="secondary" size="sm" className="mt-4">
              Talk to us about sponsorship
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeader eyebrow="Your donation impact" title="What your contribution can do" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donation.impactExamples.map((e) => (
            <li key={e.amount} className="card p-5">
              <p className="font-display text-xl font-bold text-brand-700">{e.amount}</p>
              <p className="mt-1 text-sm text-ink-600">{e.impact}</p>
            </li>
          ))}
          <li className="card border-dashed p-5">
            <p className="font-display text-xl font-bold text-accent-600">Any amount</p>
            <p className="mt-1 text-sm text-ink-600">Every contribution makes a difference.</p>
          </li>
        </ul>
        <h3 className="mt-12 text-lg font-semibold">Where your money goes</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {donation.useOfFunds.map((u) => (
            <li key={u.title} className="rounded-xl border border-ink-200 bg-white p-4">
              <p className="font-semibold">{u.title}</p>
              <p className="mt-1 text-sm text-ink-600">{u.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-ink-600">
          Need help with your donation? Call or WhatsApp {contact.phone}, or e-mail {contact.email}.
        </p>
      </Section>
    </>
  );
}
