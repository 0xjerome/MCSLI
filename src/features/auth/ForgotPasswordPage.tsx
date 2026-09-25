import { useCaptcha } from '@/features/auth/Captcha';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotConfigured } from '@/app/guards';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';

export default function ForgotPasswordPage() {
  const { requestPasswordReset, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  usePageMeta({ title: 'Reset your password', noIndex: true });
  const captcha = useCaptcha();
  if (!configured) return <NotConfigured />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return setError('Enter the e-mail address you registered with.');
    setError('');
    setState('busy');
    try {
      await requestPasswordReset(email, captcha.token);
      setState('sent');
    } catch (err) {
      captcha.reset();
      setError(friendlyError(err));
      setState('idle');
    }
  };

  return (
    <div>
      <h1 className="text-display-sm">Reset your password</h1>
      <p className="mt-2 text-ink-600">Enter your e-mail and we'll send you a link to choose a new password.</p>
      {state === 'sent' ? (
        <Alert tone="success" className="mt-6" title="Check your e-mail">
          If an account exists for {email}, a reset link is on its way. The link expires after a short time.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
          <Input label="E-mail address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          {captcha.widget}
          <Button type="submit" size="lg" fullWidth loading={state === 'busy'} disabled={!captcha.ready}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
