import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { verifyCohortApplication } from '@/services/public';
import { Section } from '@/components/public/Sections';
import { Alert, Skeleton } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';

/** Landing page for the confirmation link in the "application received" e-mail. */
export default function CohortVerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<{ ok: true; reference: string; name: string; cohort: { name: string; slug: string } } | { ok: false; message: string } | null>(null);
  usePageMeta({ title: 'Confirm your e-mail', noIndex: true });

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ ok: false, message: 'This confirmation link is incomplete.' });
      return;
    }
    verifyCohortApplication(token)
      .then((r) => !cancelled && setState({ ok: true, reference: r.reference, name: r.full_name, cohort: r.cohort }))
      .catch((e) => !cancelled && setState({ ok: false, message: friendlyError(e) }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        {!state ? (
          <Skeleton className="h-40" />
        ) : state.ok ? (
          <Alert tone="success" title="E-mail address confirmed">
            Thank you, {state.name}. Your application {state.reference} for {state.cohort.name} is confirmed. MCSLI will e-mail you the outcome of the review.
          </Alert>
        ) : (
          <Alert tone="warning" title="We could not confirm this link">
            {state.message} If you already confirmed your e-mail address, nothing more is needed. Otherwise contact info@mcsli.org with your reference number.
          </Alert>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink to={state && state.ok ? `/cohorts/${state.cohort.slug}` : '/cohorts'} variant="outline">
            Cohort details
          </ButtonLink>
          <ButtonLink to="/register" variant="accent">
            Create my MCSLI account
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
