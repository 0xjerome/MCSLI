import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { getPublicCohort, submitCohortApplication } from '@/services/public';
import { useAuth } from '@/features/auth/AuthProvider';
import { DELIVERY_MODE_LABEL, type DeliveryMode } from '@/domain/cohorts';
import { Section } from '@/components/public/Sections';
import { Input, Textarea, Checkbox, RadioCards } from '@/components/ui/Field';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { ProgressBar } from '@/components/ui/Progress';
import { Logo } from '@/components/Logo';
import type { Json, PublicCohortQuestion } from '@/types/database';

type Answers = Record<string, Json>;
const draftKey = (slug: string) => `mcsli.cohort-application.${slug}`;

function QuestionField({ q, value, onChange, error }: { q: PublicCohortQuestion; value: Json | undefined; onChange: (v: Json) => void; error?: string }) {
  const id = `q-${q.key}`;
  const hint = q.help_text ?? undefined;
  const options = q.options ?? [];
  if (q.question_type === 'long_text') return <Textarea id={id} label={q.label} hint={hint} required={q.required} error={error} rows={4} maxLength={4000} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.question_type === 'email') return <Input id={id} type="email" inputMode="email" autoComplete="email" label={q.label} hint={hint} required={q.required} error={error} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.question_type === 'phone') return <Input id={id} type="tel" inputMode="tel" autoComplete="tel" label={q.label} hint={hint ?? 'Include the country code, e.g. +256 7…'} required={q.required} error={error} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.question_type === 'date') return <Input id={id} type="date" label={q.label} hint={hint} required={q.required} error={error} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.question_type === 'country') return <Input id={id} autoComplete="country-name" label={q.label} hint={hint} required={q.required} error={error} maxLength={300} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.question_type === 'yes_no') {
    return (
      <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
        <legend className="text-sm font-medium text-ink-800">
          {q.label}
          {q.required && <span className="text-danger-600"> *</span>}
        </legend>
        {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-500">{hint}</p>}
        <div className="mt-2 flex gap-4">
          {(['yes', 'no'] as const).map((o) => (
            <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name={q.key} value={o} checked={value === o} onChange={() => onChange(o)} className="h-4 w-4 text-brand-600" /> {o === 'yes' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
        {error && <p className="mt-1 text-sm text-danger-700" role="alert">{error}</p>}
      </fieldset>
    );
  }
  if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
    const multi = q.question_type === 'multiple_choice';
    const selected = multi ? (Array.isArray(value) ? (value as string[]) : []) : typeof value === 'string' ? value : '';
    const hasOther = options.includes('Other');
    const otherValue = multi ? (selected as string[]).find((s) => s.startsWith('Other: ')) : typeof selected === 'string' && selected.startsWith('Other: ') ? selected : undefined;
    const setOther = (text: string) => {
      const v = text.trim() ? `Other: ${text.slice(0, 200)}` : 'Other';
      if (multi) onChange([...(selected as string[]).filter((s) => !s.startsWith('Other')), v]);
      else onChange(v);
    };
    const isOtherChecked = multi ? (selected as string[]).some((s) => s.startsWith('Other')) : typeof selected === 'string' && selected.startsWith('Other');
    return (
      <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
        <legend className="text-sm font-medium text-ink-800">
          {q.label}
          {q.required && <span className="text-danger-600"> *</span>}
        </legend>
        {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-500">{hint}</p>}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const checked = o === 'Other' ? isOtherChecked : multi ? (selected as string[]).includes(o) : selected === o;
            return (
              <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-ink-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/35">
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={q.key}
                  value={o}
                  checked={checked}
                  onChange={(e) => {
                    if (multi) {
                      const rest = (selected as string[]).filter((s) => (o === 'Other' ? !s.startsWith('Other') : s !== o));
                      onChange(e.target.checked ? [...rest, o] : rest);
                    } else onChange(o);
                  }}
                  className={`h-4 w-4 text-brand-600 ${multi ? 'rounded' : ''}`}
                />
                {o}
              </label>
            );
          })}
        </div>
        {hasOther && isOtherChecked && <Input wrapperClassName="mt-2" label={<span className="sr-only">Please specify</span>} placeholder="Please specify" maxLength={200} value={otherValue?.replace(/^Other: /, '') ?? ''} onChange={(e) => setOther(e.target.value)} />}
        {error && <p className="mt-1 text-sm text-danger-700" role="alert">{error}</p>}
      </fieldset>
    );
  }
  // short_text, location
  return <Input id={id} label={q.label} hint={hint} required={q.required} error={error} maxLength={300} autoComplete={q.question_type === 'location' ? 'address-level2' : 'off'} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * MCSLI-branded cohort application. Works for visitors (e-mail confirmation afterwards) and for
 * signed-in members (linked to their account). The database enforces the deadline, validation,
 * duplicates and rate limits; this page only helps people get it right first time.
 */
export default function CohortApplyPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const cohort = useQuery({ queryKey: ['public-cohort', slug], queryFn: () => getPublicCohort(slug), enabled: Boolean(slug) });
  const c = cohort.data;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  usePageMeta({ title: c ? `Apply – ${c.name}` : 'Apply', noIndex: true });

  // Restore a draft (phones lose form state easily) and prefill from the signed-in profile.
  useEffect(() => {
    if (!slug || restored) return;
    try {
      const raw = localStorage.getItem(draftKey(slug));
      if (raw) {
        const d = JSON.parse(raw) as { fullName?: string; email?: string; phone?: string; mode?: DeliveryMode | null; answers?: Answers };
        setFullName(d.fullName ?? '');
        setEmail(d.email ?? '');
        setPhone(d.phone ?? '');
        setMode(d.mode ?? null);
        setAnswers(d.answers ?? {});
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, [slug, restored]);
  useEffect(() => {
    if (profile) {
      setFullName((v) => v || profile.full_name);
      setEmail((v) => v || profile.email);
      setPhone((v) => v || profile.phone || '');
    }
  }, [profile]);
  useEffect(() => {
    if (!restored || !slug) return;
    try {
      localStorage.setItem(draftKey(slug), JSON.stringify({ fullName, email, phone, mode, answers }));
    } catch {
      /* ignore */
    }
  }, [slug, restored, fullName, email, phone, mode, answers]);

  const questions = useMemo(() => (c?.questions ?? []).filter((q) => q.question_type !== 'delivery_mode'), [c]);
  const modes = useMemo<DeliveryMode[]>(() => (c ? (c.delivery_mode === 'hybrid' ? ['online', 'physical', 'hybrid'] : [c.delivery_mode]) : []), [c]);
  useEffect(() => {
    if (modes.length === 1 && !mode) setMode(modes[0]!);
  }, [modes, mode]);

  const answered = [fullName.trim().length >= 3, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), phone.replace(/\D/g, '').length >= 9, Boolean(mode), ...questions.filter((q) => q.required).map((q) => { const v = answers[q.key]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0); })];
  const progress = Math.round((answered.filter(Boolean).length / answered.length) * 100);

  if (cohort.isLoading) return <Section><Skeleton className="h-96" /></Section>;
  if (cohort.isError) return <Section><ErrorState onRetry={() => cohort.refetch()} /></Section>;
  if (!c) return <Section><EmptyState title="Cohort not found" action={<ButtonLink to="/cohorts">All cohorts</ButtonLink>} /></Section>;
  if (c.applications !== 'open') {
    return (
      <Section>
        <div className="mx-auto max-w-xl">
          <Alert tone={c.applications === 'opening_soon' ? 'info' : 'warning'} title={c.applications === 'opening_soon' ? 'Applications are not open yet' : `Applications for ${c.name} are closed`}>
            {c.applications === 'opening_soon' && c.application_opens_at ? `They open on ${formatDate(c.application_opens_at, { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Watch mcsli.org for the next intake.'}
          </Alert>
          <ButtonLink to={`/cohorts/${c.slug}`} variant="outline" className="mt-4">
            Back to the cohort
          </ButtonLink>
        </div>
      </Section>
    );
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 3) errs.fullName = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = 'Enter a valid e-mail address.';
    if (phone.replace(/\D/g, '').length < 9) errs.phone = 'Enter a valid WhatsApp/phone number with the country code.';
    if (!mode) errs.mode = 'Choose how you want to attend.';
    for (const q of questions) {
      const v = answers[q.key];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (q.required && empty) errs[q.key] = 'This question is required.';
    }
    if (!consent) errs.consent = 'Please confirm the declaration.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setError('Please check the highlighted fields.');
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const receipt = await submitCohortApplication({ slug: c.slug, fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), deliveryMode: mode!, answers, consent, website });
      try {
        localStorage.removeItem(draftKey(slug));
        sessionStorage.setItem(`mcsli.cohort-receipt.${slug}`, JSON.stringify(receipt));
      } catch {
        /* ignore */
      }
      navigate(`/cohorts/${c.slug}/applied`, { state: { receipt }, replace: true });
    } catch (err) {
      setError(friendlyError(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-ink-50">
      <div className="container-x max-w-3xl py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link to={`/cohorts/${c.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Cohort details
          </Link>
        </div>
        <header className="rounded-2xl bg-brand-700 p-6 text-white sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">Application</p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{c.name}</h1>
          <p className="mt-2 text-brand-100">
            {c.course?.title ?? 'Ugandan Sign Language Training'}
            {c.course ? ` · ${c.course.duration_months} months` : ''} · {DELIVERY_MODE_LABEL[c.delivery_mode]}
            {c.application_deadline ? ` · apply by ${formatDate(c.application_deadline, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          </p>
          {c.tagline && <p className="mt-3 max-w-xl text-sm text-brand-100">{c.tagline}</p>}
        </header>

        <form onSubmit={submit} noValidate className="mt-6 space-y-6" aria-describedby="apply-progress">
          <div className="sticky top-16 z-10 rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-card backdrop-blur" id="apply-progress">
            <ProgressBar value={progress} label={`${progress}% complete`} showValue={false} size="sm" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {user && <Alert tone="info">You are applying as <strong>{profile?.email}</strong>. The application will be linked to your MCSLI account.</Alert>}

          <fieldset className="card space-y-4 p-5 sm:p-6">
            <legend className="px-1 text-base font-semibold text-ink-900">About you</legend>
            <Input label="Full name" required autoComplete="name" maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
            <Input label="E-mail address" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} hint="We send your reference number and updates here." disabled={Boolean(user)} />
            <Input label="WhatsApp number" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="Include the country code, e.g. +256 7…" />
            {/* honeypot – hidden from people, filled by bots */}
            <div className="hidden" aria-hidden="true">
              <label>
                Website <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
          </fieldset>

          <div className="card p-5 sm:p-6">
            <RadioCards<DeliveryMode>
              name="delivery_mode"
              legend="How do you want to attend?"
              value={mode}
              onChange={setMode}
              options={modes.map((m) => ({ value: m, title: DELIVERY_MODE_LABEL[m], description: m === 'online' ? c.online_details ?? 'Live online classes plus recorded lessons on the MCSLI platform.' : m === 'physical' ? c.physical_location ?? 'Classes in Kampala.' : 'The Saturday option: physical and online sessions.' }))}
            />
            {errors.mode && <p className="mt-2 text-sm text-danger-700" role="alert">{errors.mode}</p>}
          </div>

          {questions.length > 0 && (
            <fieldset className="card space-y-5 p-5 sm:p-6">
              <legend className="px-1 text-base font-semibold text-ink-900">Your application</legend>
              {questions.map((q) => (
                <QuestionField key={q.key} q={q} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} error={errors[q.key]} />
              ))}
            </fieldset>
          )}

          <fieldset className="card space-y-3 p-5 sm:p-6">
            <legend className="px-1 text-base font-semibold text-ink-900">Declaration</legend>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
              <li>I confirm that the information provided is true and correct.</li>
              <li>I understand that registration fees are non-refundable.</li>
              <li>I agree to follow MCSLI training rules and attendance requirements.</li>
            </ul>
            <Checkbox label="I agree to the declaration above" checked={consent} onChange={(e) => setConsent(e.target.checked)} error={errors.consent} required />
            <p className="flex items-start gap-2 text-xs text-ink-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              MCSLI uses your answers only to review your application and organise the training. Identity documents are never collected here – they are requested later through your secure MCSLI account.{' '}
              <Link to="/privacy" className="underline">
                Privacy
              </Link>
            </p>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link to={`/cohorts/${c.slug}`} className="text-center text-sm font-semibold text-ink-600 hover:underline">
              Cancel
            </Link>
            <Button type="submit" size="lg" loading={busy}>
              Submit application
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
