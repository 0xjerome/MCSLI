// Supabase Edge Function: invite-staff
//
// Sends an MCSLI staff invitation (ADMIN or TRAINER).
//
//  1. The gateway requires a valid user JWT (verify_jwt = true).
//  2. public.create_staff_invitation() runs AS THE CALLER: it enforces who may invite whom
//     (SUPER_ADMIN → ADMIN/TRAINER, ADMIN → TRAINER), stores only a hash of the single-use token,
//     audits the invitation and returns the token to this function.
//  3. The token is placed only in the e-mail link (<site>/accept-invite?token=…):
//       – new address:      Supabase Auth "Invite user" e-mail (auth.admin.inviteUserByEmail)
//       – existing account: Supabase Auth "Magic link" e-mail (signInWithOtp, no new user)
//     E-mails go through the project's SMTP provider (Resend in production).
//  4. The invitee signs in through that link, sets a password and accepts; the role is granted by
//     public.accept_staff_invitation() only for the invited, confirmed address before expiry.
//
// The token and the invitee's details are never logged. Secrets are injected by the platform.
// APP_SITE_URL is retained as a fallback, but production invitations prefer the approved MCSLI
// browser origin that initiated the request so a stale custom-domain setting cannot break invites.
// Optional: ALLOWED_ORIGINS (comma separated) to restrict CORS.
//
// Request:  POST { "email": "...", "full_name": "...", "role": "ADMIN" | "TRAINER" }
// Response: 200 { "invitation_id": "...", "email_sent": true }
//           200 { "invitation_id": "...", "email_sent": false, "email_error": "<safe reason>" }
//           400 invalid request · 401 not signed in · 403 not permitted · 409 already staff · 500 misconfigured

import { createClient } from 'npm:@supabase/supabase-js@2';

const APPROVED_APP_ORIGINS = new Set([
  'https://mcsli.org',
  'https://www.mcsli.org',
  'https://mcsli.vercel.app',
]);

function normalizeOrigin(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

function invitationSite(req: Request): string | null {
  const requestOrigin = normalizeOrigin(req.headers.get('Origin'));
  if (APPROVED_APP_ORIGINS.has(requestOrigin)) return requestOrigin;

  const configured = normalizeOrigin(Deno.env.get('APP_SITE_URL'));
  if (APPROVED_APP_ORIGINS.has(configured)) return configured;

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configured)) return configured;

  // Current production app while the custom-domain cutover is being completed.
  return 'https://mcsli.vercel.app';
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function log(level: 'info' | 'warn' | 'error', event: string, extra: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ fn: 'invite-staff', event, ...extra }));
}

// Map provider errors to reasons that are safe to show an administrator.
function safeEmailError(message: string): string {
  if (/rate limit/i.test(message)) return 'E-mail rate limit reached. Try again later.';
  if (/not authorized|not allowed|smtp|sending/i.test(message)) return 'The e-mail provider refused the message. Check the SMTP (Resend) configuration.';
  return 'The invitation e-mail could not be sent.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/.test(authHeader)) return json(req, { error: 'unauthorised' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const site = invitationSite(req);
  if (!url || !anon || !serviceRole || !site) {
    log('error', 'misconfigured', { site_configured: Boolean(site) });
    return json(req, { error: 'service unavailable' }, 500);
  }

  let body: { email?: unknown; full_name?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'invalid request' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const role = body.role === 'ADMIN' || body.role === 'TRAINER' ? body.role : null;
  if (!email || !fullName || !role) return json(req, { error: 'invalid request' }, 400);

  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(req, { error: 'unauthorised' }, 401);

  const { data: inv, error: invErr } = await asUser.rpc('create_staff_invitation', { p_email: email, p_full_name: fullName, p_role: role, p_valid_days: 1 });
  if (invErr || !inv?.token) {
    const code = invErr?.code ?? '';
    log('warn', 'invitation_refused', { code });
    if (code === '42501') return json(req, { error: invErr?.message ?? 'forbidden' }, 403);
    if (code === '23505') return json(req, { error: invErr?.message ?? 'already staff' }, 409);
    if (code === '22023') return json(req, { error: invErr?.message ?? 'invalid request' }, 400);
    return json(req, { error: 'invitation could not be created' }, 500);
  }

  const redirectTo = `${site}/accept-invite?token=${inv.token}`;
  let emailError: string | null = null;
  if (!inv.existing_account) {
    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } });
    if (error) emailError = error.message;
  } else {
    const mailer = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } });
    const { error } = await mailer.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (error) emailError = error.message;
  }

  if (emailError) {
    log('error', 'email_failed', { role, existing_account: Boolean(inv.existing_account), reason: safeEmailError(emailError) });
    return json(req, { invitation_id: inv.invitation_id, email_sent: false, email_error: safeEmailError(emailError) });
  }
  log('info', 'invitation_sent', { role, existing_account: Boolean(inv.existing_account), redirect_host: new URL(site).hostname });
  return json(req, { invitation_id: inv.invitation_id, email_sent: true });
});
