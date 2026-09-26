import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Mail, UserPlus } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { formatDateTime } from '@/lib/utils';
import { useSiteContent } from '@/content/useSiteContent';
import { useAuth } from '@/features/auth/AuthProvider';
import { Section } from '@/components/public/Sections';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';
import type { CohortApplicationReceipt } from '@/types/database';

export default function CohortAppliedPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { content } = useSiteContent();
  const [receipt, setReceipt] = useState<CohortApplicationReceipt | null>((location.state as { receipt?: CohortApplicationReceipt } | null)?.receipt ?? null);
  usePageMeta({ title: 'Application received', noIndex: true });

  useEffect(() => {
    if (receipt) return;
    try {
      const raw = sessionStorage.getItem(`mcsli.cohort-receipt.${slug}`);
      if (raw) setReceipt(JSON.parse(raw) as CohortApplicationReceipt);
    } catch {
      /* ignore */
    }
  }, [receipt, slug]);

  if (!receipt) {
    return (
      <Section>
        <EmptyState title="No application to show" description="If you already applied, check your e-mail for your reference number." action={<ButtonLink to={`/cohorts/${slug}`}>Back to the cohort</ButtonLink>} />
      </Section>
    );
  }

  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-success-100 bg-success-50 p-6 sm:p-8" role="status">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-success-600 shadow-card" aria-hidden="true">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink-900">Application received</h1>
              <p className="mt-1 text-ink-700">Thank you, {receipt.full_name}. MCSLI has received your application for {receipt.cohort.name}.</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Application reference</dt>
              <dd className="font-mono text-base font-semibold text-ink-900">{receipt.reference}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Cohort</dt>
              <dd className="font-semibold text-ink-900">{receipt.cohort.name}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Submitted</dt>
              <dd className="font-semibold text-ink-900">{formatDateTime(receipt.submitted_at)}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Status</dt>
              <dd className="font-semibold text-ink-900">{receipt.status === 'accepted' ? 'Accepted' : 'Submitted – awaiting review'}</dd>
            </div>
          </dl>
        </div>

        <h2 className="mt-8 text-lg font-semibold">What happens next</h2>
        <ol className="mt-3 space-y-3 text-sm text-ink-700">
          {receipt.email_verification_required && (
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
              <span>
                We sent a confirmation e-mail to <strong>{receipt.email}</strong>. Open it and confirm your e-mail address so we can reach you. Check your spam folder if it does not arrive within a few minutes.
              </span>
            </li>
          )}
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>{receipt.status === 'accepted' ? 'Your place is confirmed. The next step is to create your MCSLI account, enroll and submit your registration fee and first tuition payment.' : 'MCSLI staff review every application and e-mail you the outcome – accepted, waiting list or not this time. Keep your reference number.'}</span>
          </li>
          <li className="flex items-start gap-3">
            <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              {user ? 'Your application is linked to your MCSLI account; you can follow it from your dashboard.' : 'You can create an MCSLI account with the same e-mail address at any time to follow your application, and – once accepted – to enroll and pay online.'}
            </span>
          </li>
        </ol>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {user ? (
            <ButtonLink to="/app" variant="accent">
              Go to my dashboard
            </ButtonLink>
          ) : (
            <ButtonLink to="/register" variant="accent">
              Create my MCSLI account
            </ButtonLink>
          )}
          <ButtonLink to="/cohorts" variant="outline">
            All cohorts
          </ButtonLink>
        </div>

        <p className="mt-8 text-sm text-ink-600">
          Questions? WhatsApp or SMS {content.contact.phoneIntl} or e-mail{' '}
          <a href={`mailto:${content.contact.email}`} className="font-semibold text-brand-700 hover:underline">
            {content.contact.email}
          </a>
          . Quote your reference <span className="font-mono">{receipt.reference}</span>.{' '}
          <Link to="/contact" className="underline">
            Contact page
          </Link>
        </p>
      </div>
    </Section>
  );
}
