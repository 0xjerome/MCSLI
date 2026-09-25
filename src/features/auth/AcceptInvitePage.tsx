import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { getSupabase, friendlyError, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeRouteFor } from '@/domain/roles';
import type { UserRole } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, PageLoader } from '@/components/ui/Misc';

type AcceptResult = { ok: boolean; role?: UserRole; reason?: string; message?: string };

/**
 * Landing page for staff invitation e-mails (and the first super-admin set-up link).
 *
 *  1. Supabase verifies the e-mailed link and redirects here with a session in the URL fragment
 *     (server-sent invitation links use the implicit format, which the PKCE client does not pick up
 *     by itself), so the session is established explicitly and the fragment removed.
 *  2. The invitee chooses their own password (never e-mailed, never chosen by an administrator).
 *  3. accept_staff_invitation(token) grants the role – only for the invited, confirmed address.
 */
export default function AcceptInvitePage() {
  usePageMeta({ title: 'Accept invitation', noIndex: true });
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const [linkError, setLinkError] = useState('');
  const [establishing, setEstablishing] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<AcceptResult | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return setEstablishing(false);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const clean = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (hash.get('error_description') || hash.get('error')) {
      setLinkError(/expired|invalid/i.test(hash.get('error_description') ?? '') ? 'This link has expired or was already used. Ask MCSLI to send a new invitation.' : 'This link could not be used. Ask MCSLI to send a new invitation.');
      clean();
      setEstablishing(false);
      return;
    }
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if (access && refresh) {
      getSupabase()
        .auth.setSession({ access_token: access, refresh_token: refresh })
        .then(({ error: e }) => {
          if (e) setLinkError('This link has expired or was already used. Ask MCSLI to send a new invitation.');
        })
        .finally(() => {
          clean();
          setEstablishing(false);
        });
    } else {
      setEstablishing(false);
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      const sb = getSupabase();
      const { error: pErr } = await sb.auth.updateUser({ password });
      if (pErr) throw pErr;
      if (token) {
        const { data, error: aErr } = await sb.rpc('accept_staff_invitation', { p_token: token });
        if (aErr) throw aErr;
        const r = data as AcceptResult;
        if (!r.ok) {
          setError(r.message ?? 'This invitation could not be accepted.');
          return;
        }
        setDone(r);
      } else {
        setDone({ ok: true });
      }
      await refreshProfile();
    } catch (err) {
      setError(friendlyError(err, 'accept-invite'));
    } finally {
      setBusy(false);
    }
  };

  if (establishing) return <PageLoader label="Opening your invitation" />;

  return (
    <div className="mx-auto w-full max-w-md">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden="true">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-display-sm">{token ? 'Join the MCSLI team' : 'Set up your MCSLI account'}</h1>
      {linkError ? (
        <Alert tone="danger" className="mt-4">
          {linkError}
        </Alert>
      ) : !session ? (
        <Alert tone="warning" className="mt-4" title="Open the link from your invitation e-mail">
          This page needs the personal link from your MCSLI invitation e-mail. If it has expired, ask the administrator who invited you to send a new one.
        </Alert>
      ) : done ? (
        <div className="mt-4 space-y-4">
          <Alert tone="success" title="You're all set">
            {done.role ? `Your ${done.role === 'ADMIN' ? 'administrator' : 'trainer'} account is active.` : 'Your password has been saved.'} For your security, set up two-factor authentication from your profile.
          </Alert>
          <Button onClick={() => navigate(homeRouteFor(done.role ?? null), { replace: true })}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <p className="text-sm text-ink-600">
            Signed in as <strong>{session.user.email}</strong>. Choose a password for your account{token ? ' to accept the invitation' : ''}.
          </p>
          <Input name="password" type="password" label="New password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters. Use a long, unique password." />
          <Input name="confirm" type="password" label="Confirm password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">
            {token ? 'Save password and accept' : 'Save password'}
          </Button>
        </form>
      )}
    </div>
  );
}
