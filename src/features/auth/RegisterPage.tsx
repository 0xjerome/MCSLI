import { useCaptcha } from '@/features/auth/Captcha';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { formatUGX } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotConfigured } from '@/app/guards';
import { fallbackCourseFees } from '@/services/public';
import { Input, Checkbox, RadioCards } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';
import { Steps } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import type { NationalityClass } from '@/domain/types';

const step1 = z.object({
  fullName: z.string().trim().min(3, 'Enter your full name as it appears on your ID').max(120),
  email: z.string().trim().email('Enter a valid e-mail address'),
  phone: z.string().trim().min(9, 'Enter a phone number we can reach you on').max(30),
});
const step3 = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(72),
    confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function RegisterPage() {
  const { signUp, configured } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', nationality: null as NationalityClass | null, country: '', city: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState<null | { needsEmailConfirmation: boolean }>(null);
  usePageMeta({ title: 'Create your account', description: 'Register for the MCSLI online Ugandan Sign Language course.', path: '/register' });
  const captcha = useCaptcha();

  if (!configured) return <NotConfigured />;

  const set = (k: keyof typeof form, v: string | boolean | null) => setForm((f) => ({ ...f, [k]: v }));
  const fail = (issues: z.ZodIssue[]) => {
    const e: Record<string, string> = {};
    issues.forEach((i) => (e[String(i.path[0])] = i.message));
    setErrors(e);
  };

  const next = () => {
    if (step === 0) {
      const r = step1.safeParse(form);
      if (!r.success) return fail(r.error.issues);
    }
    if (step === 1) {
      const e: Record<string, string> = {};
      if (!form.nationality) e.nationality = 'Choose one option so we can show the correct fees';
      if (form.country.trim().length < 2) e.country = 'Enter the country you live in';
      if (Object.keys(e).length) return setErrors(e);
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = step3.safeParse(form);
    if (!r.success) return fail(r.error.issues);
    setErrors({});
    setBusy(true);
    setServerError('');
    try {
      const res = await signUp({ email: form.email, password: form.password, fullName: form.fullName, phone: form.phone, nationality: form.nationality!, country: form.country, city: form.city }, captcha.token);
      setDone(res);
    } catch (err) {
      captcha.reset();
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-display-sm">{done.needsEmailConfirmation ? 'Check your e-mail' : 'Account created'}</h1>
        <p className="mt-3 text-ink-600">
          {done.needsEmailConfirmation ? (
            <>
              We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account, then log in to enroll and pay.
            </>
          ) : (
            'Your account is ready. Log in to enroll and pay.'
          )}
        </p>
        <Link to="/login" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display-sm">Create your account</h1>
      <p className="mt-2 text-ink-600">Register in three short steps. You will enroll and pay after logging in.</p>
      <div className="mt-6">
        <Steps steps={['Your details', 'Residency', 'Password']} current={step} />
      </div>

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {step === 0 && (
          <>
            <Input label="Full name" hint="Exactly as it appears on your National ID or passport — it will be printed on your certificate." required autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
            <Input label="E-mail address" type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
            <Input label="Phone number" type="tel" required autoComplete="tel" placeholder="+256 …" hint="WhatsApp number preferred; trainers use it to arrange assessments." value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
          </>
        )}
        {step === 1 && (
          <>
            <RadioCards<NationalityClass>
              name="nationality"
              legend="Which describes you?"
              value={form.nationality}
              onChange={(v) => set('nationality', v)}
              error={errors.nationality}
              options={[
                { value: 'ugandan', title: 'Ugandan student', badge: <Badge tone="brand" size="sm">Tuition {formatUGX(fallbackCourseFees.tuition_national)}</Badge>, description: 'You hold Ugandan citizenship. You will verify your identity with your National ID (NIN).' },
                { value: 'international', title: 'Non-Ugandan student', badge: <Badge tone="brand" size="sm">Tuition {formatUGX(fallbackCourseFees.tuition_international)}</Badge>, description: 'You are not a Ugandan citizen. You will verify your identity with a passport or other approved ID.' },
              ]}
            />
            <p className="text-xs text-ink-500">
              Plus a one-time registration fee of {formatUGX(fallbackCourseFees.registration_fee)}. Current fees are always shown before you pay. This choice affects your fees and cannot be changed after enrollment without contacting MCSLI.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Country of residence" required autoComplete="country-name" value={form.country} onChange={(e) => set('country', e.target.value)} error={errors.country} />
              <Input label="City / town" optionalLabel autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <Input label="Password" type="password" required autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} />
            <Input label="Confirm password" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} error={errors.confirm} />
            <Checkbox
              checked={form.terms}
              onChange={(e) => set('terms', e.target.checked)}
              error={errors.terms}
              label={
                <>
                  I agree to MCSLI's{' '}
                  <Link to="/privacy" target="_blank" className="text-brand-700 underline">
                    privacy and data policy
                  </Link>
                  , including verification of my identity for certification.
                </>
              }
            />
            {serverError && <Alert tone="danger">{serverError}</Alert>}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button type="button" onClick={next} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              Continue
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              {captcha.widget}
              <Button type="submit" loading={busy} disabled={!captcha.ready}>
                Create account
              </Button>
            </div>
          )}
        </div>
      </form>
      <p className="mt-6 text-sm text-ink-600">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
