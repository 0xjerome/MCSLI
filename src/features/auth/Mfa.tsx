import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { getSupabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, PageLoader } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import type { Factor } from '@supabase/supabase-js';

/**
 * Two-factor authentication (TOTP) for staff, using Supabase Auth MFA.
 * The QR code / secret are shown only to the signed-in user during enrolment and are never stored
 * or sent anywhere by MCSLI. Enforcement lives in the database: when the super admin turns on
 * "Require two-factor authentication for staff", staff privileges need an aal2 session.
 */

export async function getAal() {
  const { data, error } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

async function staffMfaRequired(): Promise<boolean> {
  const { data } = await getSupabase().rpc('get_public_settings');
  return (data as Record<string, unknown> | null)?.require_staff_mfa === true;
}

/** Wraps the trainer/admin areas: asks for the code when the account has TOTP, requires enrolment when enforced. */
export function StaffMfaGate({ children }: { children: ReactNode }) {
  const state = useQuery({
    queryKey: ['mfa-gate'],
    queryFn: async () => ({ aal: await getAal(), required: await staffMfaRequired() }),
    staleTime: 30_000,
  });
  if (state.isLoading) return <PageLoader label="Checking account security" />;
  if (state.isError || !state.data) return <>{children}</>; // the database still enforces MFA when required
  const { aal, required } = state.data;
  if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return (
      <Centered>
        <MfaChallenge onVerified={() => state.refetch()} />
      </Centered>
    );
  }
  if (required && aal.currentLevel !== 'aal2') {
    return (
      <Centered>
        <Alert tone="warning" title="Two-factor authentication is required for staff" className="mb-4">
          MCSLI requires an authenticator app for trainer and administrator accounts. Set it up once below; you will then enter a 6-digit code when you sign in.
        </Alert>
        <MfaEnroll onEnrolled={() => state.refetch()} />
      </Centered>
    );
  }
  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="container-x mx-auto max-w-lg py-12">{children}</div>;
}

export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const { signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const sb = getSupabase();
      const { data: factors, error: fErr } = await sb.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const totp = factors.totp[0];
      if (!totp) throw new Error('No authenticator is set up for this account.');
      const { error: vErr } = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code.trim() });
      if (vErr) throw vErr;
      onVerified();
    } catch (err) {
      setError(/invalid|code/i.test((err as Error).message) ? 'That code is not valid. Check the time on your phone and try the newest code.' : friendlyError(err, 'mfa-challenge'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Enter your authentication code" description="Open your authenticator app and enter the 6-digit code for MCSLI." />
      <form onSubmit={submit} className="space-y-4">
        <Input name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-autofocus />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button type="submit" loading={busy} leftIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}>
            Verify
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function MfaEnroll({ onEnrolled }: { onEnrolled: () => void }) {
  const [enrolment, setEnrolment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const sb = getSupabase();
      // remove abandoned, unverified enrolments first
      const { data: existing } = await sb.auth.mfa.listFactors();
      for (const f of (existing?.all ?? []).filter((x) => x.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: eErr } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `MCSLI ${new Date().toISOString().slice(0, 10)}` });
      if (eErr) throw eErr;
      setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      setError(friendlyError(err, 'mfa-enroll'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrolment) return;
    setBusy(true);
    setError('');
    try {
      const { error: vErr } = await getSupabase().auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
      if (vErr) throw vErr;
      setEnrolment(null);
      onEnrolled();
    } catch (err) {
      setError(/invalid|code/i.test((err as Error).message) ? 'That code is not valid. Try the newest code from the app.' : friendlyError(err, 'mfa-verify'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Set up an authenticator app" description="Use Google Authenticator, Microsoft Authenticator, Authy or 1Password." />
      {!enrolment ? (
        <Button onClick={start} loading={busy} leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
          Start set-up
        </Button>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li>Scan this QR code with your authenticator app.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <img src={enrolment.qr} alt="QR code for adding MCSLI to your authenticator app" className="h-44 w-44 rounded-xl border border-ink-200 bg-white p-2" />
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-700">Can't scan? Enter the key manually</summary>
            <code className="mt-2 block break-all rounded-lg bg-ink-50 p-2 text-xs">{enrolment.secret}</code>
          </details>
          <Input name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <Button type="submit" loading={busy}>
            Verify and turn on
          </Button>
        </form>
      )}
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Card>
  );
}

/** Profile section for staff: status, enrol, remove. */
export function MfaSettings() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await getSupabase().auth.mfa.listFactors();
    if (e) setError(friendlyError(e));
    else setFactors(data.totp);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (factors === null) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-ink-900">Two-factor authentication</h2>
        {factors.length ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}
      </div>
      {factors.length ? (
        <p className="text-sm text-ink-600">
          Your account is protected by an authenticator app ({factors.map((f) => f.friendly_name ?? 'TOTP').join(', ')}). To move it to a new phone, set up the new phone first, then contact the super administrator if you lose access.
        </p>
      ) : (
        <MfaEnroll onEnrolled={() => void load()} />
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
