import { useCaptcha } from '@/features/auth/Captcha';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotConfigured } from '@/app/guards';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';

export default function LoginPage() {
  const { signIn, configured, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);
  usePageMeta({ title: 'Log in', noIndex: true });
  const captcha = useCaptcha();

  if (!configured) return <NotConfigured />;
  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setUnconfirmed(false);
    if (!email || !password) {
      setError('Enter your e-mail and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password, captcha.token);
      // When there is no remembered destination, stay on /login briefly and let
      // RedirectIfAuthed route from the freshly loaded profile role. Hard-coding /app
      // sends ADMIN/SUPER_ADMIN accounts to the student shell.
      if (from) navigate(from, { replace: true });
    } catch (err) {
      captcha.reset();
      const msg = friendlyError(err);
      setError(msg);
      if (/confirm your e-mail/i.test(msg)) setUnconfirmed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-display-sm">Welcome back</h1>
      <p className="mt-2 text-ink-600">Log in to continue learning.</p>
      {params.get('verified') && (
        <Alert tone="success" className="mt-6" title="E-mail verified">
          Your e-mail address is confirmed. You can log in now.
        </Alert>
      )}
      {params.get('reset') && (
        <Alert tone="success" className="mt-6" title="Password updated">
          Log in with your new password.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <Input label="E-mail address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <Alert
            tone="danger"
            action={
              unconfirmed && !resent ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await resendVerification(email, captcha.token);
                      setResent(true);
                    } catch (err) {
                      setError(friendlyError(err));
                    }
                  }}
                >
                  Resend verification e-mail
                </Button>
              ) : resent ? (
                <span className="text-xs">Verification e-mail sent.</span>
              ) : undefined
            }
          >
            {error}
          </Alert>
        )}
        {captcha.widget}
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={!captcha.ready}>
          Log in
        </Button>
      </form>
      <div className="mt-6 flex flex-col gap-2 text-sm text-ink-600">
        <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          Forgot your password?
        </Link>
        <p>
          New to MCSLI Online?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
