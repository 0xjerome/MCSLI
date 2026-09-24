import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotConfigured } from '@/app/guards';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';

/** Landing page for the password-recovery link (Supabase sets a recovery session). */
export default function ResetPasswordPage() {
  const { updatePassword, configured, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  usePageMeta({ title: 'Choose a new password', noIndex: true });

  useEffect(() => {
    // Give supabase-js a moment to exchange the recovery token from the URL.
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (!configured) return <NotConfigured />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      await signOut();
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-display-sm">Choose a new password</h1>
      {ready && !session ? (
        <Alert tone="warning" className="mt-6" title="This reset link is invalid or has expired">
          <Link to="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
          <Input label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
          <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!session}>
            Update password
          </Button>
        </form>
      )}
    </div>
  );
}
