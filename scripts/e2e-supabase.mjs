#!/usr/bin/env node
/**
 * End-to-end test of the MCSLI backend through the real Supabase HTTP APIs
 * (Auth/GoTrue, PostgREST, Storage, Edge Functions) – exactly what the browser uses.
 *
 * Local stack (default):
 *   npx supabase start
 *   node scripts/e2e-supabase.mjs            # reads URL + keys from `supabase status`
 *
 * Hosted staging/production (creates clearly labelled [TEST] records only, never touches others):
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… E2E_ALLOW_REMOTE=1 \
 *   E2E_EMAIL_DOMAIN=<a domain whose mail you can discard> node scripts/e2e-supabase.mjs
 *   With production e-mail (Resend) connected, route every test address to a mailbox you control:
 *   E2E_EMAIL_TEMPLATE="you+mcsli-e2e-{who}-{run}@gmail.com"  (invitation e-mails are really sent)
 *   On a hosted project e-mails cannot be read by the script, so confirmation/reset links are
 *   obtained with the Auth admin API (generateLink) instead of the inbox.
 *
 * Keys are read from the environment and never printed. Every record created is prefixed [TEST]
 * (course slug `test-e2e-…`, e-mails `mcsli-e2e-…`). Nothing pre-existing is modified, except that a
 * [TEST] payment method row is added (and disabled again at the end).
 */
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------
function localEnv() {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const env = Object.fromEntries(out.split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  return { url: env.API_URL, anon: env.ANON_KEY, service: env.SERVICE_ROLE_KEY, mail: env.INBUCKET_URL || env.MAILPIT_URL || 'http://127.0.0.1:54324' };
}

const remote = Boolean(process.env.SUPABASE_URL);
const cfg = remote ? { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY, mail: null } : localEnv();
if (!cfg.url || !cfg.anon || !cfg.service) {
  console.error('Missing Supabase URL/keys. Start the local stack (npx supabase start) or set SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cfg.url.replace(/\/$/, ''));
if (!isLocal && process.env.E2E_ALLOW_REMOTE !== '1') {
  console.error('Refusing to run against a hosted project without E2E_ALLOW_REMOTE=1 (creates [TEST] records).');
  process.exit(1);
}
const SITE = process.env.E2E_SITE_URL ?? 'http://localhost:5173';
const RUN = Date.now().toString(36);
const DOMAIN = process.env.E2E_EMAIL_DOMAIN ?? 'mcsli-e2e.test';
// Random per run and never printed, so leftover [TEST] accounts cannot be logged into from the logs.
const PASSWORD = `E2e-${crypto.randomUUID()}-Aa9!`;
const TEMPLATE = process.env.E2E_EMAIL_TEMPLATE; // e.g. "you+mcsli-e2e-{who}-{run}@gmail.com"
const email = (who) => (TEMPLATE ? TEMPLATE.replaceAll('{who}', who).replaceAll('{run}', RUN) : `mcsli-e2e-${who}-${RUN}@${DOMAIN}`);

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) – what an authenticator app computes from the enrolment secret. */
function totp(base32Secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32Secret.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
  return String(code).padStart(6, '0');
}

// ---------------------------------------------------------------------------
// tiny test harness
// ---------------------------------------------------------------------------
const results = [];
let section = '';
function begin(name) {
  section = name;
  console.log(`\n▶ ${name}`);
}
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ section, name, ok: true });
    console.log(`  ✓ ${name}${detail ? `  (${detail})` : ''}`);
  } catch (e) {
    results.push({ section, name, ok: false, error: e.message });
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function denied(promise, pattern = /not authori[sz]ed|permission denied|row-level security|locked|not found|violates/i) {
  const r = await promise;
  const err = r?.error;
  if (!err) throw new Error(`expected denial, got success: ${JSON.stringify(r?.data)?.slice(0, 120)}`);
  if (pattern && !pattern.test(err.message ?? '')) throw new Error(`denied with unexpected message: ${err.message}`);
  return err.message;
}
function ok(r, what) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const newClient = () => createClient(cfg.url, cfg.anon, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce', storage: memoryStorage() } });
const service = createClient(cfg.url, cfg.service, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = newClient();

async function waitForMail(to, subjectPattern) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${cfg.mail}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const body = await res.json();
    // Mailpit search is token based: match the exact recipient ourselves
    const msg = (body.messages ?? []).find((m) => subjectPattern.test(m.Subject) && (m.To ?? []).some((t) => t.Address?.toLowerCase() === to.toLowerCase()));
    if (msg) {
      const full = await (await fetch(`${cfg.mail}/api/v1/message/${msg.ID}`)).json();
      return full;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no e-mail matching ${subjectPattern} for ${to}`);
}
const linkFrom = (html) => {
  const m = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
  if (!m) throw new Error('no verification link in e-mail');
  return m[1].replace(/&amp;/g, '&');
};
/** Follow the Auth verify link like a browser would, returning the final redirect location. */
async function followVerify(link) {
  const res = await fetch(link, { redirect: 'manual' });
  return res.headers.get('location') ?? '';
}

async function signUp(who, fullName, nationality = 'ugandan', extraMeta = {}) {
  const c = newClient();
  const data = { full_name: fullName, nationality, country: nationality === 'ugandan' ? 'Uganda' : 'Kenya', phone: '', ...extraMeta };
  if (!cfg.mail) {
    // Hosted project without custom SMTP: Supabase's built-in mailer only delivers to project team
    // members, so the account is created through the Auth admin API (same auth.users insert, same
    // profile trigger) and confirmation links are generated server-side. Nothing is e-mailed.
    const r = await service.auth.admin.createUser({ email: email(who), password: PASSWORD, email_confirm: false, user_metadata: data });
    if (r.error && /already been registered|already exists/i.test(r.error.message)) {
      // e.g. an invitation created the auth user before the (unconfigured) mailer refused the e-mail
      const p = ok(await service.from('profiles').select('id').eq('email', email(who)).single(), `find ${who}`);
      ok(await service.auth.admin.updateUserById(p.id, { password: PASSWORD, user_metadata: data }), `reset ${who}`);
      return { client: c, id: p.id, email: email(who) };
    }
    ok(r, `create ${who}`);
    return { client: c, id: r.data.user.id, email: email(who) };
  }
  const r = await c.auth.signUp({ email: email(who), password: PASSWORD, options: { emailRedirectTo: `${SITE}/login?verified=1`, data } });
  ok(r, `sign up ${who}`);
  return { client: c, id: r.data.user.id, email: email(who) };
}
async function confirmEmail(user) {
  if (cfg.mail) {
    const mail = await waitForMail(user.email, /confirm/i);
    const location = await followVerify(linkFrom(mail.HTML));
    const u = new URL(location, SITE);
    assert(u.origin + u.pathname === `${SITE}/login` && u.searchParams.get('verified') === '1' && !u.searchParams.get('error'), `confirmation redirected to ${location.replace(/(code|token|access_token|refresh_token)=[^&#]+/g, '$1=…')}`);
    return 'real e-mail link followed';
  }
  const r = await service.auth.admin.generateLink({ type: 'signup', email: user.email, password: PASSWORD, options: { redirectTo: `${SITE}/login?verified=1` } });
  ok(r, 'generateLink');
  await followVerify(r.data.properties.action_link);
  return 'admin-generated link followed';
}
async function signIn(user) {
  ok(await user.client.auth.signInWithPassword({ email: user.email, password: PASSWORD }), `sign in ${user.email}`);
}
async function sql(query, params = []) {
  // Direct database session (no end-user JWT) – local stack only; used for the audited bootstrap.
  if (!isLocal) throw new Error('direct SQL is only used against the local stack');
  const esc = params.map((p) => `'${String(p).replace(/'/g, "''")}'`);
  const q = query.replace(/\$(\d+)/g, (_, i) => esc[Number(i) - 1]);
  return execFileSync('docker', ['exec', 'supabase_db_mcsli', 'psql', '-U', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();
}
const tinyPng = () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/png' });
const tinyPdf = () => new Blob(['%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'], { type: 'application/pdf' });
const tinyMp4 = () => new Blob([Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0])], { type: 'video/mp4' });
const tinyVtt = () => new Blob(['WEBVTT\n\n00:00.000 --> 00:02.000\n[TEST] caption\n'], { type: 'text/vtt' });
const signedFetch = (url) => fetch(isLocal ? url.replace(/^https?:\/\/[^/]+/, cfg.url.replace(/\/$/, '')) : url);

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------
console.log(`MCSLI end-to-end test · ${isLocal ? 'local Supabase stack' : 'hosted project'} · run ${RUN}`);
const ctx = {};
if (isLocal) {
  // local stack only: start each run with fresh rate-limit windows (the limiter is tested at the end)
  execFileSync('docker', ['exec', 'supabase_db_mcsli', 'psql', '-U', 'postgres', '-tAc', 'delete from private.rate_limits'], { stdio: 'ignore' });
}

begin('Authentication');
await step('student registers; a manipulated form asking for SUPER_ADMIN is ignored', async () => {
  ctx.student = await signUp('student', '[TEST] Student Ugandan', 'ugandan', { role: 'SUPER_ADMIN', account_status: 'active' });
  const p = ok(await service.from('profiles').select('role, nationality, full_name').eq('id', ctx.student.id).single(), 'profile');
  assert(p.role === 'STUDENT', `role is ${p.role}`);
  assert(p.full_name === '[TEST] Student Ugandan', 'profile created from sign-up metadata');
  return 'profile row created by trigger, role STUDENT';
});
await step('login is refused until the e-mail is confirmed', async () => {
  const r = await ctx.student.client.auth.signInWithPassword({ email: ctx.student.email, password: PASSWORD });
  assert(r.error && /not confirmed/i.test(r.error.message), `unexpected: ${r.error?.message ?? 'signed in'}`);
});
await step('confirmation e-mail link verifies the address and returns to /login?verified=1', () => confirmEmail(ctx.student));
await step('email/password login, session and profile', async () => {
  await signIn(ctx.student);
  const s = (await ctx.student.client.auth.getSession()).data.session;
  assert(s?.access_token && s.refresh_token, 'session tokens');
  const me = ok(await ctx.student.client.from('profiles').select('id, role').single(), 'own profile');
  assert(me.id === ctx.student.id && me.role === 'STUDENT', 'own profile readable');
});
await step('token refresh issues a new access token', async () => {
  const before = (await ctx.student.client.auth.getSession()).data.session.access_token;
  await new Promise((r) => setTimeout(r, 1100));
  const r = ok(await ctx.student.client.auth.refreshSession(), 'refresh');
  assert(r.session.access_token !== before, 'new access token');
});
await step('forgot password → e-mail link → /reset-password → new password works', async () => {
  const c = newClient();
  // with the built-in mailer the reset e-mail cannot be sent to a test address; the link is generated instead
  if (cfg.mail) ok(await c.auth.resetPasswordForEmail(ctx.student.email, { redirectTo: `${SITE}/reset-password` }), 'reset request');
  let location;
  if (cfg.mail) {
    const mail = await waitForMail(ctx.student.email, /reset/i);
    location = await followVerify(linkFrom(mail.HTML));
  } else {
    const r = ok(await service.auth.admin.generateLink({ type: 'recovery', email: ctx.student.email, options: { redirectTo: `${SITE}/reset-password` } }), 'generateLink');
    location = await followVerify(r.properties.action_link);
  }
  assert(location.startsWith(`${SITE}/reset-password`), `reset link returned to ${location.split('?')[0]}`);
  const code = new URL(location).searchParams.get('code');
  if (code) {
    ok(await c.auth.exchangeCodeForSession(code), 'exchange PKCE code');
  } else {
    const hash = new URLSearchParams(new URL(location).hash.slice(1));
    ok(await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }), 'recovery session');
  }
  ok(await c.auth.updateUser({ password: `${PASSWORD}x` }), 'update password');
  const again = newClient();
  ok(await again.auth.signInWithPassword({ email: ctx.student.email, password: `${PASSWORD}x` }), 'login with new password');
  ok(await c.auth.updateUser({ password: PASSWORD }), 'restore password');
  // a password change ends the user's other sessions: the old session must now be refused
  const stale = await ctx.student.client.auth.getUser();
  assert(stale.error, 'sessions opened before the password change are revoked');
  await signIn(ctx.student);
  return `${code ? 'PKCE code exchanged' : 'implicit recovery session'}; older sessions revoked`;
});
await step('logout revokes the refresh token', async () => {
  const c = newClient();
  ok(await c.auth.signInWithPassword({ email: ctx.student.email, password: PASSWORD }), 'login');
  const { refresh_token } = (await c.auth.getSession()).data.session;
  ok(await c.auth.signOut(), 'sign out');
  const r = await newClient().auth.refreshSession({ refresh_token });
  assert(r.error, 'refresh after logout must fail');
  // the app signs out globally: every session of this user ends, including the test's main one
  const main = await ctx.student.client.auth.getUser();
  assert(main.error, 'global sign-out ends other sessions too');
  await signIn(ctx.student);
  return 'global sign-out; all refresh tokens revoked';
});

begin('Staff accounts (bootstrap → invitations)');
await step('create [TEST] super admin and a second student', async () => {
  ctx.super = await signUp('super', '[TEST] Super Admin');
  ctx.other = await signUp('other', '[TEST] Student Other', 'international');
  for (const u of [ctx.super, ctx.other]) {
    await confirmEmail(u);
    await signIn(u);
  }
});
await step('first SUPER_ADMIN via audited bootstrap (direct database session only)', async () => {
  const viaApi = await ctx.super.client.rpc('bootstrap_super_admin', { p_email: ctx.super.email });
  assert(viaApi.error, 'bootstrap must be refused through the API');
  if (!isLocal) {
    // hosted project: never touch real accounts; promote only this run's [TEST] account with the
    // service role (demoted, suspended and banned again in the cleanup below)
    ok(await service.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', ctx.super.id), 'promote [TEST] super admin');
    return 'hosted: [TEST] account promoted with the service role';
  }
  const existing = await sql(`select count(*) from public.profiles where role = 'SUPER_ADMIN'`);
  if (existing === '0') {
    await sql(`select public.bootstrap_super_admin($1)`, [ctx.super.email]);
  } else {
    await sql(`update public.profiles set role = 'SUPER_ADMIN' where id = $1`, [ctx.super.id]);
  }
  const role = await sql(`select role from public.profiles where id = $1`, [ctx.super.id]);
  assert(role === 'SUPER_ADMIN', `role ${role}`);
  return existing === '0' ? 'bootstrap_super_admin() + audit row' : 'super admin already existed';
});

/**
 * Invite through the invite-staff Edge Function, then accept like the invitee would.
 * Local stack: the real invitation e-mail is read from Mailpit and its link followed.
 * Hosted without SMTP: e-mail to a test address cannot be delivered, so the account is created with
 * the Auth admin API and a fresh token is issued through create_staff_invitation (same acceptance path).
 */
async function inviteAndAccept(inviter, who, role, fullName) {
  const c = newClient();
  const user = { client: c, email: email(who) };
  let token;
  if (cfg.mail) {
    const r = await inviter.client.functions.invoke('invite-staff', { body: { email: email(who), full_name: fullName, role } });
    if (r.error) throw new Error(`invite-staff: ${r.response?.status} ${await r.response?.text?.()}`);
    user.inviteEmailSent = r.data.email_sent;
    assert(r.data.email_sent === true, `invitation e-mail not sent: ${r.data.email_error}`);
    const mail = await waitForMail(user.email, /invit/i);
    const location = await followVerify(linkFrom(mail.HTML));
    const u = new URL(location, SITE);
    assert(u.origin + u.pathname === `${SITE}/accept-invite`, `invitation link returned to ${u.origin + u.pathname}`);
    token = u.searchParams.get('token');
    const hash = new URLSearchParams(u.hash.slice(1));
    ok(await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }), 'invite session');
    ok(await c.auth.updateUser({ password: PASSWORD }), 'invitee sets own password');
    user.id = (await c.auth.getUser()).data.user.id;
  } else {
    // hosted: the script cannot read the mailbox, so the token comes from the same database
    // function the Edge Function uses (the real e-mail path is exercised by the Resend step)
    const created = await signUp(who, fullName);
    await confirmEmail(created);
    Object.assign(user, created);
    await signIn(user);
    token = ok(await inviter.client.rpc('create_staff_invitation', { p_email: user.email, p_full_name: fullName, p_role: role }), 'token').token;
  }
  const acc = ok(await user.client.rpc('accept_staff_invitation', { p_token: token }), 'accept');
  assert(acc.ok === true && acc.role === role, JSON.stringify(acc));
  const reuse = ok(await user.client.rpc('accept_staff_invitation', { p_token: token }), 'reuse');
  assert(reuse.ok === false && reuse.reason === 'used', 'token is single-use');
  return user;
}

await step('SUPER_ADMIN invites an ADMIN (e-mail link → own password → role active)', async () => {
  ctx.admin = await inviteAndAccept(ctx.super, 'admin', 'ADMIN', '[TEST] Admin');
  const p = ok(await ctx.admin.client.from('profiles').select('role').eq('id', ctx.admin.id).single(), 'profile');
  assert(p.role === 'ADMIN', `role ${p.role}`);
  return cfg.mail ? 'real invitation e-mail followed' : 'hosted: acceptance via an issued token (e-mail path covered by the Resend step)';
});
await step('ADMIN invites a TRAINER; ADMIN cannot invite ADMIN; trainers/students/anonymous cannot invite', async () => {
  ctx.trainer = await inviteAndAccept(ctx.admin, 'trainer', 'TRAINER', '[TEST] Trainer');
  const tryInvite = (u, role) => u.client.functions.invoke('invite-staff', { body: { email: email(`x-${role.toLowerCase()}`), full_name: '[TEST] X', role } });
  const a = await tryInvite(ctx.admin, 'ADMIN');
  assert(a.error && a.response?.status === 403, `admin→ADMIN status ${a.response?.status}`);
  const t = await tryInvite(ctx.trainer, 'TRAINER');
  assert(t.error && t.response?.status === 403, `trainer status ${t.response?.status}`);
  const st = await tryInvite(ctx.other, 'TRAINER');
  assert(st.error && st.response?.status === 403, `student status ${st.response?.status}`);
  const res = await fetch(`${cfg.url}/functions/v1/invite-staff`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.anon }, body: JSON.stringify({ email: 'x@y.z', full_name: 'X', role: 'ADMIN' }) });
  assert(res.status === 401, `anonymous status ${res.status}`);
  await denied(ctx.admin.client.rpc('admin_set_user_role', { p_user_id: ctx.other.id, p_role: 'ADMIN' }), /super admin/);
  await denied(ctx.admin.client.rpc('admin_set_user_role', { p_user_id: ctx.super.id, p_role: 'STUDENT' }), /super admin/);
  await denied(ctx.admin.client.rpc('admin_set_account_status', { p_user_id: ctx.super.id, p_status: 'suspended' }), /super admin/);
  await denied(ctx.student.client.rpc('admin_set_user_role', { p_user_id: ctx.student.id, p_role: 'ADMIN' }));
  const upd = await ctx.admin.client.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', ctx.admin.id);
  assert(upd.error, 'ADMIN cannot promote self');
  const audit = ok(await ctx.super.client.from('audit_logs').select('action').in('action', ['staff_invitation.created', 'staff_invitation.accepted', 'staff.admin_created', 'staff.trainer_created']), 'audit');
  for (const x of ['staff_invitation.created', 'staff_invitation.accepted', 'staff.admin_created', 'staff.trainer_created']) assert(audit.some((r) => r.action === x), `audit ${x}`);
  const leaked = ok(await ctx.super.client.from('audit_logs').select('metadata').like('action', 'staff_invitation.%'), 'audit metadata');
  assert(!/[0-9a-f]{64}/.test(JSON.stringify(leaked)), 'no invitation token in audit metadata');
});
await step('invitation misuse: wrong account, cancelled and expired links are refused', async () => {
  const inv = ok(await ctx.admin.client.rpc('create_staff_invitation', { p_email: email('misuse'), p_full_name: '[TEST] Misuse', p_role: 'TRAINER' }), 'invite');
  const wrong = ok(await ctx.other.client.rpc('accept_staff_invitation', { p_token: inv.token }), 'wrong');
  assert(wrong.ok === false && wrong.reason === 'wrong_account', JSON.stringify(wrong));
  ok(await ctx.admin.client.rpc('cancel_staff_invitation', { p_invitation_id: inv.invitation_id }), 'cancel');
  const list = ok(await ctx.admin.client.rpc('list_staff_invitations'), 'list');
  assert(list.find((i) => i.id === inv.invitation_id)?.status === 'cancelled', 'cancelled');
  const forged = ok(await ctx.other.client.rpc('accept_staff_invitation', { p_token: 'f'.repeat(64) }), 'forged');
  assert(forged.ok === false && forged.reason === 'invalid', 'forged token refused');
  const staffRead = await ctx.other.client.from('staff_invitations').select('id');
  assert(staffRead.error || staffRead.data.length === 0, 'students cannot list invitations');
});

await step('Resend replaces the pending link: old link cancelled, new link valid for 24 h', async () => {
  const addr = email('resend');
  const send = () => ctx.admin.client.functions.invoke('invite-staff', { body: { email: addr, full_name: '[TEST] Resend', role: 'TRAINER' } });
  const first = await send();
  if (first.error) throw new Error(`first: ${first.response?.status} ${await first.response?.text?.()}`);
  // an immediate resend must be refused BEFORE the working link is cancelled
  const tooSoon = await send();
  assert(tooSoon.error && tooSoon.response?.status === 429, `immediate resend status ${tooSoon.response?.status}`);
  const still = ok(await ctx.admin.client.rpc('list_staff_invitations'), 'list').find((i) => i.id === first.data.invitation_id);
  assert(still?.status === 'pending', 'first link untouched by the throttled resend');
  await new Promise((r) => setTimeout(r, 61_000));
  const second = await send();
  if (second.error) throw new Error(`second: ${second.response?.status} ${await second.response?.text?.()}`);
  assert(first.data.email_sent && second.data.email_sent, `e-mails sent: ${first.data.email_sent}/${second.data.email_sent} ${second.data.email_error ?? ''}`);
  const list = ok(await ctx.admin.client.rpc('list_staff_invitations'), 'list').filter((i) => i.email === addr);
  const old = list.find((i) => i.id === first.data.invitation_id);
  const cur = list.find((i) => i.id === second.data.invitation_id);
  assert(old?.status === 'cancelled' && cur?.status === 'pending', `statuses ${old?.status}/${cur?.status}`);
  const hours = (new Date(cur.expires_at) - new Date(cur.created_at)) / 36e5;
  assert(Math.abs(hours - 24) < 0.05, `validity ${hours.toFixed(2)} h`);
  if (cfg.mail) {
    const invite = await waitForMail(addr, /invited/i); // 1st: Auth "invite user" e-mail
    // 2nd: the account now exists → magic link (or, while still unconfirmed, a confirmation e-mail);
    // either link lands on /accept-invite?token=… with a session
    const magic = await waitForMail(addr, /magic|sign-?in|confirm/i);
    const oldTok = new URL(await followVerify(linkFrom(invite.HTML)), SITE).searchParams.get('token');
    const u = new URL(await followVerify(linkFrom(magic.HTML)), SITE);
    assert(u.origin + u.pathname === `${SITE}/accept-invite`, `resend link returned to ${u.origin + u.pathname}`);
    const newTok = u.searchParams.get('token');
    assert(oldTok && newTok && oldTok !== newTok, 'distinct tokens');
    const c = newClient();
    const hash = new URLSearchParams(u.hash.slice(1));
    ok(await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }), 'session');
    ok(await c.auth.updateUser({ password: PASSWORD }), 'password');
    const stale = ok(await c.rpc('accept_staff_invitation', { p_token: oldTok }), 'old token');
    assert(stale.ok === false && stale.reason === 'cancelled', JSON.stringify(stale));
    const acc = ok(await c.rpc('accept_staff_invitation', { p_token: newTok }), 'new token');
    assert(acc.ok === true && acc.role === 'TRAINER', JSON.stringify(acc));
    ctx.resendUser = { id: (await c.auth.getUser()).data.user.id, email: addr, client: c };
    return 'both e-mails received; old link cancelled, new link accepted';
  }
  ok(await ctx.admin.client.rpc('cancel_staff_invitation', { p_invitation_id: cur.id }), 'tidy');
  return 'hosted: invitation + resend e-mails handed to Resend for the test mailbox';
});

begin('Course setup ([TEST] course, admin tools)');
await step('admin creates a 2-month [TEST] course with pricing, lessons, quiz and final exam', async () => {
  const a = ctx.admin.client;
  const course = ok(await a.from('courses').insert({ slug: `test-e2e-${RUN}`, title: `[TEST] E2E Course ${RUN}`, duration_months: 2, tuition_national: 350000, tuition_international: 400000, registration_fee: 20000, installments_enabled: true, installment_count: 2, installment_due_before_month: { 2: 2 }, requires_final_exam: true, is_published: false }).select().single(), 'course');
  const early = await a.from('courses').update({ is_published: true }).eq('id', course.id);
  assert(early.error && /cannot be published yet/.test(early.error.message), 'an empty draft cannot be published');
  ctx.course = course;
  const months = ok(await a.from('course_months').insert([1, 2].map((n) => ({ course_id: course.id, month_number: n, title: `[TEST] Month ${n}` }))).select(), 'months');
  ctx.m1 = months.find((m) => m.month_number === 1);
  ctx.m2 = months.find((m) => m.month_number === 2);
  const mods = ok(await a.from('modules').insert([ctx.m1, ctx.m2].map((m) => ({ month_id: m.id, title: `[TEST] Module M${m.month_number}` }))).select(), 'modules');
  const lessons = ok(await a.from('lessons').insert(mods.map((mo, i) => ({ module_id: mo.id, title: `[TEST] Lesson ${i + 1}`, video_url: 'https://mcsli-test.invalid/test-lesson.mp4' }))).select('id, module_id'), 'lessons');
  ctx.l1 = lessons.find((l) => l.module_id === mods.find((mo) => mo.month_id === ctx.m1.id).id).id;
  ctx.l2 = lessons.find((l) => l.module_id === mods.find((mo) => mo.month_id === ctx.m2.id).id).id;
  // real media pipeline: private course-media bucket (video + captions + thumbnail), MIME whitelist
  const media = { m1: `lessons/${RUN}/m1.mp4`, m1c: `captions/${RUN}/m1.vtt`, m1t: `thumbnails/${RUN}/m1.png`, m2: `lessons/${RUN}/m2.mp4` };
  ok(await a.storage.from('course-media').upload(media.m1, tinyMp4(), { contentType: 'video/mp4' }), 'upload video');
  ok(await a.storage.from('course-media').upload(media.m1c, tinyVtt(), { contentType: 'text/vtt' }), 'upload captions');
  ok(await a.storage.from('course-media').upload(media.m1t, tinyPng(), { contentType: 'image/png' }), 'upload thumbnail');
  ok(await a.storage.from('course-media').upload(media.m2, tinyMp4(), { contentType: 'video/mp4' }), 'upload month-2 video');
  const badType = await a.storage.from('course-media').upload(`lessons/${RUN}/evil.txt`, new Blob(['x'], { type: 'text/plain' }), { contentType: 'text/plain' });
  assert(badType.error, 'bucket refuses non-media types');
  ok(await a.from('lessons').update({ video_path: media.m1, captions_path: media.m1c, thumbnail_path: media.m1t, video_url: null }).eq('id', ctx.l1), 'lesson 1 media');
  ok(await a.from('lessons').update({ video_path: media.m2, video_url: null }).eq('id', ctx.l2), 'lesson 2 media');
  ctx.media = media;
  ctx.quiz = ok(await a.from('quizzes').insert({ month_id: ctx.m1.id, title: '[TEST] Month 1 quiz', passing_score: 70 }).select().single(), 'quiz');
  ok(await a.from('quiz_questions').insert([
    { quiz_id: ctx.quiz.id, position: 1, prompt: '[TEST] Q1', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct_answer: 'a', explanation: '[TEST] A is right' },
    { quiz_id: ctx.quiz.id, position: 2, prompt: '[TEST] Q2', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct_answer: 'b', explanation: '[TEST] B is right' },
  ]), 'quiz questions');
  ctx.exam = ok(await a.from('exams').insert({ course_id: course.id, title: '[TEST] Final exam', is_final: true, status: 'open', time_limit_minutes: 30, max_attempts: 1, passing_score: 60 }).select().single(), 'exam');
  ok(await a.from('exam_questions').insert([
    { exam_id: ctx.exam.id, position: 1, question_type: 'multiple_choice', requires_manual_grading: false, prompt: '[TEST] E1', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct_answer: 'a', points: 2 },
    { exam_id: ctx.exam.id, position: 2, question_type: 'practical', prompt: '[TEST] Practical', options: [], correct_answer: null, points: 2, requires_manual_grading: true },
  ]), 'exam questions');
  ok(await a.from('trainer_assignments').insert({ trainer_id: ctx.trainer.id, course_id: course.id }), 'assign trainer');
  const problems = ok(await a.rpc('get_course_publish_problems', { p_course_id: course.id }), 'checklist');
  assert(problems.length === 0, `publish checklist: ${problems.join('; ')}`);
  ok(await a.from('courses').update({ is_published: true }).eq('id', course.id), 'publish');
  // [TEST] payment method, enabled only for this run
  const incomplete = await a.from('payment_methods').insert({ method_type: 'mtn', display_name: `[TEST] MTN incomplete ${RUN}`, is_enabled: true, position: 98 });
  assert(incomplete.error && /merchant code/.test(incomplete.error.message), 'a method without details cannot be enabled');
  ctx.method = ok(await a.from('payment_methods').insert({ method_type: 'mtn', display_name: `[TEST] MTN ${RUN}`, merchant_code: 'TEST-000', account_name: '[TEST] MCSLI', is_enabled: true, position: 99 }).select().single(), 'test payment method');
  return `course ${course.slug}`;
});
await step('a trainer and a student cannot change courses, pricing or platform settings', async () => {
  const r1 = await ctx.trainer.client.from('courses').update({ tuition_national: 1 }).eq('id', ctx.course.id).select();
  assert(!r1.error && r1.data.length === 0, 'trainer course update must affect nothing');
  const r2 = await ctx.student.client.from('courses').update({ tuition_national: 1 }).eq('id', ctx.course.id).select();
  assert(!r2.error && r2.data.length === 0, 'student course update must affect nothing');
  await denied(ctx.trainer.client.rpc('set_platform_setting', { p_key: 'registration_open', p_value: false }));
  const s = ok(await ctx.student.client.from('platform_settings').select('*'), 'settings');
  assert(s.length === 0, 'student reads no platform settings');
});

begin('Identity verification');
await step('student submits NIN + uploads a private scan', async () => {
  ok(await ctx.student.client.rpc('submit_identity', { p_doc_type: 'national_id', p_id_number: 'CM90000000TEST', p_full_name: '[TEST] Student Ugandan', p_issuing_country: 'Uganda', p_consent: true }), 'submit identity');
  const rel = `${ctx.student.id}/${crypto.randomUUID()}.png`;
  ok(await ctx.student.client.storage.from('identity-documents').upload(rel, tinyPng(), { contentType: 'image/png' }), 'upload');
  ctx.docId = ok(await ctx.student.client.rpc('register_identity_document', { p_storage_path: `identity-documents/${rel}`, p_file_name: 'nin.png', p_mime: 'image/png', p_size: 68 }), 'register');
  ctx.docPath = rel;
  const s = ok(await ctx.student.client.rpc('get_my_identity'), 'summary')[0];
  assert(s.id_number_masked === '••••••••••TEST' && s.status === 'pending', `masked ${s.id_number_masked}`);
  return 'masked ••••••••••TEST';
});
await step("another student cannot read, sign or fetch the scan (storage + Edge Function)", async () => {
  const listed = ok(await ctx.other.client.storage.from('identity-documents').list(ctx.student.id), 'list');
  assert(listed.length === 0, 'other student lists nothing');
  const signed = await ctx.other.client.storage.from('identity-documents').createSignedUrl(ctx.docPath, 60);
  assert(signed.error || !signed.data?.signedUrl, 'other student cannot sign');
  const dl = await ctx.other.client.storage.from('identity-documents').download(ctx.docPath);
  assert(dl.error, 'other student cannot download');
  const fn = await ctx.other.client.functions.invoke('identity-document-url', { body: { document_id: ctx.docId } });
  assert(fn.error && fn.response?.status === 404, `edge function status ${fn.response?.status}`);
  const up = await ctx.other.client.storage.from('identity-documents').upload(`${ctx.student.id}/evil.png`, tinyPng(), { contentType: 'image/png' });
  assert(up.error, 'cannot upload into another folder');
});
await step('trainer and anonymous callers are refused; admin cannot bypass the audited function', async () => {
  const t = await ctx.trainer.client.functions.invoke('identity-document-url', { body: { document_id: ctx.docId } });
  assert(t.error && t.response?.status === 404, `trainer status ${t.response?.status}`);
  const res = await fetch(`${cfg.url}/functions/v1/identity-document-url`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.anon }, body: JSON.stringify({ document_id: ctx.docId }) });
  assert(res.status === 401, `anonymous status ${res.status}`);
  const direct = await ctx.admin.client.storage.from('identity-documents').createSignedUrl(ctx.docPath, 60);
  assert(direct.error || !direct.data?.signedUrl, 'admin must not sign identity URLs directly');
});
await step('admin opens the scan through the Edge Function: 120 s signed URL, audited', async () => {
  const fn = await ctx.admin.client.functions.invoke('identity-document-url', { body: { document_id: ctx.docId } });
  if (fn.error) throw new Error(`edge function: ${fn.response?.status} ${await fn.response?.text?.()}`);
  assert(fn.data.expires_in === 120 && /token=/.test(fn.data.url), 'short-lived signed URL');
  // locally the function signs with the internal gateway host (kong:8000); fetch it via the public API URL
  const signedUrl = isLocal ? fn.data.url.replace(/^https?:\/\/[^/]+/, cfg.url.replace(/\/$/, '')) : fn.data.url;
  const file = await fetch(signedUrl);
  assert(file.status === 200, `download status ${file.status}`);
  const audit = ok(await ctx.admin.client.from('audit_logs').select('action, actor_id').eq('entity_id', ctx.docId).eq('action', 'identity.document_viewed'), 'audit');
  assert(audit.length === 1 && audit[0].actor_id === ctx.admin.id, 'audit row by admin');
  const own = await ctx.student.client.functions.invoke('identity-document-url', { body: { document_id: ctx.docId } });
  assert(!own.error && own.data.url, `owner may view own scan (${own.response?.status} ${own.error ? await own.response?.text?.() : ''})`);
});
await step('admin reveals the full number (audited, never logged) and verifies the identity', async () => {
  const vid = ok(await ctx.admin.client.rpc('admin_list_identities'), 'summary').find((r) => r.user_id === ctx.student.id).id;
  ctx.vid = vid;
  const n = ok(await ctx.admin.client.rpc('admin_reveal_identity_number', { p_verification_id: vid, p_reason: '[TEST] e2e verification' }), 'reveal');
  assert(n === 'CM90000000TEST', 'decrypted number');
  await denied(ctx.trainer.client.rpc('admin_reveal_identity_number', { p_verification_id: vid }));
  await denied(ctx.other.client.rpc('admin_reveal_identity_number', { p_verification_id: vid }));
  const audit = ok(await ctx.admin.client.from('audit_logs').select('metadata').eq('entity_id', vid).eq('action', 'identity.number_revealed'), 'audit');
  assert(audit.length === 1 && !JSON.stringify(audit).includes('CM90000000'), 'audited without the number');
  ok(await ctx.admin.client.rpc('review_identity', { p_verification_id: vid, p_decision: 'verified' }), 'verify');
});

begin('Enrollment and payments');
await step('student enrolls (installments); server snapshots UGX 350,000 + 20,000 registration', async () => {
  ctx.enrollment = ok(await ctx.student.client.rpc('enroll_in_course', { p_course_id: ctx.course.id, p_plan: 'installments' }), 'enroll');
  const e = ok(await ctx.student.client.from('enrollments').select('*').eq('id', ctx.enrollment).single(), 'enrollment');
  assert(Number(e.tuition_amount) === 350000 && Number(e.registration_fee) === 20000, 'price snapshot');
  const inst = e.installments.map((i) => [i.number, Number(i.amount), i.due_before_month]);
  assert(JSON.stringify(inst) === JSON.stringify([[1, 175000, 1], [2, 175000, 2]]), `installments ${JSON.stringify(inst)}`);
  const forged = await ctx.student.client.from('enrollments').insert({ user_id: ctx.student.id, course_id: ctx.course.id, plan_type: 'full', nationality: 'ugandan', currency: 'UGX', registration_fee: 0, tuition_amount: 1, installments: [] });
  assert(forged.error, 'client-priced enrollment refused');
});
await step('international student is charged UGX 400,000', async () => {
  const id = ok(await ctx.other.client.rpc('enroll_in_course', { p_course_id: ctx.course.id, p_plan: 'full' }), 'enroll');
  const e = ok(await ctx.other.client.from('enrollments').select('tuition_amount').eq('id', id).single(), 'enrollment');
  assert(Number(e.tuition_amount) === 400000, `tuition ${e.tuition_amount}`);
  ctx.otherEnrollment = id;
});
await step('student uploads a receipt and submits registration + installment 1 (status pending)', async () => {
  const rel = `${ctx.student.id}/${crypto.randomUUID()}.pdf`;
  ok(await ctx.student.client.storage.from('payment-proofs').upload(rel, tinyPdf(), { contentType: 'application/pdf' }), 'proof upload');
  ctx.payReg = ok(await ctx.student.client.rpc('submit_payment', { p_enrollment_id: ctx.enrollment, p_purpose: 'registration', p_installment_number: null, p_method_id: ctx.method.id, p_amount: 20000, p_payer_name: '[TEST] Payer', p_reference: `TEST-REG-${RUN}`, p_paid_at: new Date().toISOString().slice(0, 10), p_proof_path: `payment-proofs/${rel}` }), 'registration');
  ctx.pay1 = ok(await ctx.student.client.rpc('submit_payment', { p_enrollment_id: ctx.enrollment, p_purpose: 'tuition', p_installment_number: 1, p_method_id: ctx.method.id, p_amount: 175000, p_payer_name: '[TEST] Payer', p_reference: `TEST-I1-${RUN}`, p_paid_at: new Date().toISOString().slice(0, 10) }), 'installment 1');
  const mine = ok(await ctx.student.client.from('payments').select('status'), 'history');
  assert(mine.length === 2 && mine.every((p) => p.status === 'pending'), 'own history, pending');
  ctx.proofPath = rel;
  assert((await ctx.other.client.storage.from('payment-proofs').createSignedUrl(rel, 60)).error, 'another student cannot sign the receipt');
  assert((await ctx.trainer.client.storage.from('payment-proofs').createSignedUrl(rel, 60)).error, 'trainers cannot open receipts');
  ok(await ctx.admin.client.storage.from('payment-proofs').createSignedUrl(rel, 60), 'admin reviews the receipt');
  const traversal = await ctx.student.client.storage.from('payment-proofs').upload(`${ctx.student.id}/../${ctx.other.id}/evil.pdf`, tinyPdf(), { contentType: 'application/pdf' });
  assert(traversal.error, 'path traversal refused');
});
await step('student cannot confirm own payment; others cannot see it; trainer cannot confirm', async () => {
  const upd = await ctx.student.client.from('payments').update({ status: 'confirmed' }).eq('id', ctx.pay1).select();
  assert(!upd.error && upd.data.length === 0, 'direct status update affects nothing');
  await denied(ctx.student.client.rpc('review_payment', { p_payment_id: ctx.pay1, p_decision: 'confirmed' }));
  await denied(ctx.trainer.client.rpc('review_payment', { p_payment_id: ctx.pay1, p_decision: 'confirmed' }));
  const seen = ok(await ctx.other.client.from('payments').select('id').eq('user_id', ctx.student.id), 'other');
  assert(seen.length === 0, 'other student sees none');
  const proof = await ctx.other.client.storage.from('payment-proofs').list(ctx.student.id);
  assert((proof.data ?? []).length === 0, 'other student cannot list receipts');
});
await step('month 1 locked before confirmation (financial gate)', async () => {
  const map = ok(await ctx.student.client.rpc('get_my_course_map', { p_enrollment_id: ctx.enrollment }), 'map');
  assert(map[0].access.allowed === false, 'month 1 locked');
  const lessons = ok(await ctx.student.client.from('lessons').select('id').eq('id', ctx.l1), 'lessons');
  assert(lessons.length === 0, 'lesson hidden by RLS');
});
await step('admin moves to review, rejects a bad submission, confirms the valid ones', async () => {
  const bad = ok(await ctx.student.client.rpc('submit_payment', { p_enrollment_id: ctx.enrollment, p_purpose: 'tuition', p_installment_number: 1, p_method_id: ctx.method.id, p_amount: 1000, p_payer_name: '[TEST] Payer', p_reference: `TEST-BAD-${RUN}`, p_paid_at: new Date().toISOString().slice(0, 10) }), 'bad');
  ok(await ctx.admin.client.rpc('review_payment', { p_payment_id: bad, p_decision: 'under_review', p_note: null }), 'under review');
  ok(await ctx.admin.client.rpc('review_payment', { p_payment_id: bad, p_decision: 'rejected', p_note: '[TEST] amount does not match' }), 'reject');
  ok(await ctx.admin.client.rpc('review_payment', { p_payment_id: ctx.payReg, p_decision: 'confirmed', p_note: null }), 'confirm reg');
  ok(await ctx.admin.client.rpc('review_payment', { p_payment_id: ctx.pay1, p_decision: 'confirmed', p_note: null }), 'confirm i1');
  const e = ok(await ctx.student.client.from('enrollments').select('status').eq('id', ctx.enrollment).single(), 'enrollment');
  assert(e.status === 'active', `enrollment ${e.status}`);
  const statuses = ok(await ctx.student.client.from('payments').select('status, receipt_number').order('submitted_at'), 'payments');
  assert(statuses.filter((p) => p.status === 'confirmed').every((p) => /^RCPT-/.test(p.receipt_number)), 'receipt numbers');
  const audit = ok(await ctx.admin.client.from('audit_logs').select('action').eq('target_user_id', ctx.student.id).in('action', ['payment.confirmed', 'payment.rejected']), 'audit');
  assert(audit.length === 3, `audit rows ${audit.length}`);
  const notes = ok(await ctx.student.client.from('notifications').select('type'), 'notifications');
  for (const t of ['payment_confirmed', 'payment_rejected', 'month_unlocked']) assert(notes.some((n) => n.type === t), `notification ${t}`);
});

begin('Learning, quiz and assessments');
await step('month 1 content opens; month 2 content stays hidden and unusable', async () => {
  const l = ok(await ctx.student.client.from('lessons').select('id'), 'lessons');
  assert(l.some((x) => x.id === ctx.l1) && !l.some((x) => x.id === ctx.l2), 'only month 1 lesson visible');
  await denied(ctx.student.client.rpc('save_lesson_progress', { p_lesson_id: ctx.l2, p_position_seconds: 5, p_completed: true }), /locked/);
  ok(await ctx.student.client.rpc('save_lesson_progress', { p_lesson_id: ctx.l1, p_position_seconds: 12, p_completed: true }), 'complete lesson');
});
await step('course media: signed URLs only for unlocked months, only for enrolled students/staff; no student uploads', async () => {
  const sign = (c, p) => c.storage.from('course-media').createSignedUrl(p, 60);
  const s = ok(await sign(ctx.student.client, ctx.media.m1), 'student month-1 video');
  assert(/token=/.test(s.signedUrl), 'signed');
  const res = await signedFetch(s.signedUrl);
  assert(res.status === 200, `download status ${res.status}`);
  ok(await sign(ctx.student.client, ctx.media.m1c), 'captions');
  ok(await sign(ctx.student.client, ctx.media.m1t), 'thumbnail');
  assert((await sign(ctx.student.client, ctx.media.m2)).error, 'locked month video not signable');
  assert((await sign(ctx.other.client, ctx.media.m1)).error, 'enrolled-but-unpaid student cannot sign');
  assert((await sign(anon, ctx.media.m1)).error, 'anonymous cannot sign');
  ok(await sign(ctx.trainer.client, ctx.media.m2), 'assigned trainer');
  const up = await ctx.student.client.storage.from('course-media').upload(`lessons/${RUN}/student.mp4`, tinyMp4(), { contentType: 'video/mp4' });
  assert(up.error, 'students cannot upload course media');
  const listed = ok(await ctx.student.client.storage.from('course-media').list(`lessons/${RUN}`), 'list');
  assert(!listed.some((f) => f.name === 'm2.mp4'), 'locked media is not even listed');
});
await step('quiz: answers hidden from the browser; failed attempt reveals nothing; pass scored server-side', async () => {
  const direct = await ctx.student.client.from('quiz_questions').select('correct_answer').eq('quiz_id', ctx.quiz.id);
  assert(direct.error, 'correct_answer column not readable');
  const qs = ok(await ctx.student.client.from('quiz_questions_student').select('id, position').eq('quiz_id', ctx.quiz.id).order('position'), 'questions');
  const fail = ok(await ctx.student.client.rpc('submit_quiz_attempt', { p_quiz_id: ctx.quiz.id, p_answers: { [qs[0].id]: 'b', [qs[1].id]: 'a' } }), 'fail');
  assert(fail.score === 0 && !fail.passed && fail.answers_revealed === false && fail.questions.every((q) => q.correct_answer === null), 'failed attempt hides answers');
  const pass = ok(await ctx.student.client.rpc('submit_quiz_attempt', { p_quiz_id: ctx.quiz.id, p_answers: { [qs[0].id]: 'a', [qs[1].id]: 'b' } }), 'pass');
  assert(pass.score === 100 && pass.passed && pass.attempt_number === 2, 'passed on attempt 2');
  const forged = await ctx.student.client.from('quiz_attempts').insert({ quiz_id: ctx.quiz.id, enrollment_id: ctx.enrollment, attempt_number: 9, answers: {}, score: 100, passed: true });
  assert(forged.error, 'cannot write own score');
  const tr = ok(await ctx.trainer.client.from('quiz_attempts').select('score').eq('enrollment_id', ctx.enrollment), 'trainer view');
  assert(tr.length === 2, 'assigned trainer sees score history');
});
await step('trainer records NOT PASSED → month 2 locked, reassessment created, student notified', async () => {
  const aid = ok(await ctx.trainer.client.rpc('schedule_assessment', { p_enrollment_id: ctx.enrollment, p_month_id: ctx.m1.id, p_scheduled_at: new Date().toISOString() }), 'schedule');
  ok(await ctx.trainer.client.rpc('record_assessment_result', { p_assessment_id: aid, p_score: 45, p_result: 'not_passed', p_feedback: '[TEST] practise fingerspelling' }), 'record');
  const map = ok(await ctx.student.client.rpc('get_my_course_map', { p_enrollment_id: ctx.enrollment }), 'map');
  const codes = map[1].access.reasons.map((r) => r.code);
  assert(!map[1].access.allowed && codes.includes('previous_month_assessment_not_passed'), `codes ${codes}`);
  const re = ok(await ctx.trainer.client.from('assessments').select('id').eq('enrollment_id', ctx.enrollment).eq('status', 'scheduled').eq('is_reassessment', true), 'reassessment');
  assert(re.length === 1, 'reassessment scheduled');
  ctx.reassessment = re[0].id;
  const alter = await ctx.student.client.from('assessment_attempts').update({ result: 'pass' }).eq('enrollment_id', ctx.enrollment).select();
  assert(!alter.error && alter.data.length === 0, 'student cannot alter result');
});
await step('reassessment PASS + installment 2 NOT confirmed → month 2 still LOCKED', async () => {
  ok(await ctx.trainer.client.rpc('record_assessment_result', { p_assessment_id: ctx.reassessment, p_score: 85, p_result: 'pass', p_feedback: '[TEST] well done' }), 'record pass');
  const map = ok(await ctx.student.client.rpc('get_my_course_map', { p_enrollment_id: ctx.enrollment }), 'map');
  const codes = map[1].access.reasons.map((r) => r.code);
  assert(!map[1].access.allowed && JSON.stringify(codes) === JSON.stringify(['installment_unconfirmed']), `codes ${codes}`);
  const hist = ok(await ctx.student.client.from('assessment_attempts').select('attempt_number, result').order('attempt_number'), 'history');
  assert(JSON.stringify(hist) === JSON.stringify([{ attempt_number: 1, result: 'not_passed' }, { attempt_number: 2, result: 'pass' }]), 'both attempts visible');
});
await step('installment 2 confirmed + PASS → month 2 UNLOCKED (student notified)', async () => {
  const p2 = ok(await ctx.student.client.rpc('submit_payment', { p_enrollment_id: ctx.enrollment, p_purpose: 'tuition', p_installment_number: 2, p_method_id: ctx.method.id, p_amount: 175000, p_payer_name: '[TEST] Payer', p_reference: `TEST-I2-${RUN}`, p_paid_at: new Date().toISOString().slice(0, 10) }), 'installment 2');
  ok(await ctx.admin.client.rpc('review_payment', { p_payment_id: p2, p_decision: 'confirmed' }), 'confirm');
  const map = ok(await ctx.student.client.rpc('get_my_course_map', { p_enrollment_id: ctx.enrollment }), 'map');
  assert(map[1].access.allowed === true, JSON.stringify(map[1].access.reasons));
  const n = ok(await ctx.student.client.from('notifications').select('title').eq('type', 'month_unlocked'), 'notifications');
  assert(n.some((x) => /Month 2/.test(x.title)), 'month 2 unlocked notification');
  ok(await ctx.student.client.rpc('save_lesson_progress', { p_lesson_id: ctx.l2, p_position_seconds: 12, p_completed: true }), 'month 2 lesson');
  ok(await ctx.student.client.storage.from('course-media').createSignedUrl(ctx.media.m2, 60), 'month-2 video now signable');
});
await step('admin override requires a reason and is audited; trainers cannot override', async () => {
  await denied(ctx.trainer.client.rpc('override_month_unlock', { p_enrollment_id: ctx.otherEnrollment, p_month_id: ctx.m2.id, p_reason: '[TEST] trainer attempt' }));
  await denied(ctx.admin.client.rpc('override_month_unlock', { p_enrollment_id: ctx.otherEnrollment, p_month_id: ctx.m2.id, p_reason: 'short' }), /reason/);
  const oid = ok(await ctx.admin.client.rpc('override_month_unlock', { p_enrollment_id: ctx.otherEnrollment, p_month_id: ctx.m2.id, p_reason: '[TEST] assessed in person, recorded late' }), 'override');
  const audit = ok(await ctx.admin.client.from('audit_logs').select('metadata').eq('entity_id', oid).eq('action', 'month.override_unlock'), 'audit');
  assert(audit.length === 1 && /recorded late/.test(audit[0].metadata.reason), 'audited with reason');
  const map = ok(await ctx.other.client.rpc('get_my_course_map', { p_enrollment_id: ctx.otherEnrollment }), 'map');
  assert(!map[1].access.allowed, 'override never waives unpaid tuition');
  ok(await ctx.admin.client.rpc('revoke_month_override', { p_override_id: oid, p_reason: '[TEST] cleanup' }), 'revoke');
});
await step('month 2 assessment PASS by trainer', async () => {
  const aid = ok(await ctx.trainer.client.rpc('schedule_assessment', { p_enrollment_id: ctx.enrollment, p_month_id: ctx.m2.id, p_scheduled_at: null }), 'schedule');
  ok(await ctx.trainer.client.rpc('record_assessment_result', { p_assessment_id: aid, p_score: 90, p_result: 'pass' }), 'record');
});

begin('Final examination');
await step('start (server deadline), autosave, resume, submit', async () => {
  const s = ok(await ctx.student.client.rpc('start_exam_attempt', { p_exam_id: ctx.exam.id }), 'start');
  assert(s.deadline_at && s.question_order.length === 2, 'deadline + questions');
  ctx.attempt = s.attempt_id;
  const qs = ok(await ctx.student.client.from('exam_questions_student').select('id, question_type').eq('exam_id', ctx.exam.id), 'questions');
  const mc = qs.find((q) => q.question_type !== 'practical').id;
  const pr = qs.find((q) => q.question_type === 'practical').id;
  const saved = ok(await ctx.student.client.rpc('save_exam_answers', { p_attempt_id: ctx.attempt, p_answers: { [mc]: 'a', [pr]: '[TEST] signed my introduction' } }), 'autosave');
  assert(saved.saved === true, 'autosaved');
  const resumed = ok(await ctx.student.client.rpc('start_exam_attempt', { p_exam_id: ctx.exam.id }), 'resume');
  assert(resumed.resumed && resumed.answers[mc] === 'a', 'resumed with answers');
  const sub = ok(await ctx.student.client.rpc('submit_exam_attempt', { p_attempt_id: ctx.attempt }), 'submit');
  assert(sub.needs_manual_grading === true, 'practical needs grading');
  const again = ok(await ctx.student.client.rpc('save_exam_answers', { p_attempt_id: ctx.attempt, p_answers: { [mc]: 'b' } }), 'late save');
  assert(again.saved === false, 'no changes after submission');
  await denied(ctx.student.client.rpc('start_exam_attempt', { p_exam_id: ctx.exam.id }), /maximum attempts/);
  ctx.practical = pr;
});
await step('score hidden until release; trainer grades; results released', async () => {
  const hidden = ok(await ctx.student.client.rpc('my_exam_attempts', { p_enrollment_id: ctx.enrollment }), 'hidden').find((a) => a.id === ctx.attempt);
  assert(hidden.total_score === null, 'score hidden before grading/release');
  const raw = await ctx.student.client.from('exam_attempts').select('total_score');
  assert(raw.error, 'score column not readable directly');
  await denied(ctx.student.client.rpc('grade_exam_attempt', { p_attempt_id: ctx.attempt, p_manual_scores: { [ctx.practical]: 2 } }));
  const g = ok(await ctx.trainer.client.rpc('grade_exam_attempt', { p_attempt_id: ctx.attempt, p_manual_scores: { [ctx.practical]: 2 }, p_feedback: '[TEST] clear signing' }), 'grade');
  assert(Number(g.total_score) === 100 && g.passed, `total ${g.total_score}`);
  ok(await ctx.trainer.client.rpc('release_exam_results', { p_exam_id: ctx.exam.id }), 'release');
  const shown = ok(await ctx.student.client.rpc('my_exam_attempts', { p_enrollment_id: ctx.enrollment }), 'released').find((a) => a.id === ctx.attempt);
  assert(Number(shown.total_score) === 100 && shown.passed, 'score visible after release');
});

begin('Certificate');
await step('eligibility lists missing final approval; student cannot issue', async () => {
  const el = ok(await ctx.student.client.rpc('get_certificate_eligibility', { p_enrollment_id: ctx.enrollment }), 'eligibility');
  assert(!el.eligible && JSON.stringify(el.missing) === JSON.stringify(['Final approval pending']), JSON.stringify(el.missing));
  await denied(ctx.student.client.rpc('issue_certificate', { p_enrollment_id: ctx.enrollment }));
  await denied(ctx.other.client.rpc('get_certificate_eligibility', { p_enrollment_id: ctx.enrollment }));
});
await step('trainer approves; admin issues MCSLI-YYYY-XXXXXX; student notified', async () => {
  ok(await ctx.trainer.client.rpc('approve_enrollment_completion', { p_enrollment_id: ctx.enrollment }), 'approve');
  await denied(ctx.trainer.client.rpc('issue_certificate', { p_enrollment_id: ctx.enrollment }));
  const id = ok(await ctx.admin.client.rpc('issue_certificate', { p_enrollment_id: ctx.enrollment }), 'issue');
  ctx.cert = ok(await ctx.student.client.from('certificates').select('*').eq('id', id).single(), 'certificate');
  assert(/^MCSLI-\d{4}-[A-Z2-9]{6}$/.test(ctx.cert.certificate_number), ctx.cert.certificate_number);
  const n = ok(await ctx.student.client.from('notifications').select('type').eq('type', 'certificate_issued'), 'notification');
  assert(n.length === 1, 'certificate notification');
  return ctx.cert.certificate_number;
});
await step('public verification (anonymous) returns only safe fields', async () => {
  const v = ok(await anon.rpc('verify_certificate', { p_number: ctx.cert.certificate_number.toLowerCase() }), 'verify');
  assert(v.found && v.status === 'issued' && v.student_name === '[TEST] Student Ugandan', 'found');
  const keys = Object.keys(v).sort().join(',');
  assert(keys === 'certificate_number,certificate_title,completion_date,course_title,found,issued_at,revoked_at,status,student_name', keys);
  const nf = ok(await anon.rpc('verify_certificate', { p_number: 'MCSLI-2000-ZZZZZZ' }), 'not found');
  assert(nf.found === false, 'unknown number');
  const table = await anon.from('certificates').select('*');
  assert(table.error && /permission denied/i.test(table.error.message), 'anonymous cannot read the certificates table at all');
});
await step('revoke → verification shows revoked; reissue → new number verifies', async () => {
  ok(await ctx.admin.client.rpc('revoke_certificate', { p_certificate_id: ctx.cert.id, p_reason: '[TEST] name correction' }), 'revoke');
  const v = ok(await anon.rpc('verify_certificate', { p_number: ctx.cert.certificate_number }), 'verify revoked');
  assert(v.status === 'revoked' && v.revoked_at, 'revoked');
  const newId = ok(await ctx.admin.client.rpc('reissue_certificate', { p_certificate_id: ctx.cert.id, p_reason: '[TEST] corrected name', p_student_name: '[TEST] Student Ugandan (corrected)' }), 'reissue');
  const c2 = ok(await ctx.student.client.from('certificates').select('certificate_number').eq('id', newId).single(), 'new cert');
  const v2 = ok(await anon.rpc('verify_certificate', { p_number: c2.certificate_number }), 'verify new');
  assert(v2.status === 'issued' && v2.student_name.includes('corrected'), 'reissued');
  const audit = ok(await ctx.admin.client.from('audit_logs').select('action').eq('target_user_id', ctx.student.id).like('action', 'certificate.%'), 'audit');
  assert(['certificate.issued', 'certificate.revoked', 'certificate.reissued'].every((a) => audit.some((x) => x.action === a)), 'certificate audit trail');
});

begin('Support, discussions, notifications');
await step('support ticket: private to the student, admin replies, student notified', async () => {
  const t = ok(await ctx.student.client.from('support_tickets').insert({ user_id: ctx.student.id, category: 'payment', subject: '[TEST] receipt question' }).select().single(), 'ticket');
  ok(await ctx.student.client.from('support_messages').insert({ ticket_id: t.id, author_id: ctx.student.id, body: '[TEST] where is my receipt?' }), 'message');
  const other = ok(await ctx.other.client.from('support_tickets').select('id').eq('id', t.id), 'other');
  assert(other.length === 0, 'other student cannot see ticket');
  const tr = ok(await ctx.trainer.client.from('support_tickets').select('id').eq('id', t.id), 'trainer');
  assert(tr.length === 0, 'unassigned trainer cannot see ticket');
  ok(await ctx.admin.client.from('support_messages').insert({ ticket_id: t.id, author_id: ctx.admin.id, is_staff: true, body: '[TEST] receipt RCPT sent' }), 'admin reply');
  ok(await ctx.admin.client.rpc('update_ticket_status', { p_ticket_id: t.id, p_status: 'resolved' }), 'resolve');
  const n = ok(await ctx.student.client.from('notifications').select('type').eq('type', 'support_response'), 'notification');
  assert(n.length === 1, 'support notification');
});
await step('discussion: enrolled student posts, trainer announces and moderates, others cannot edit', async () => {
  const th = ok(await ctx.student.client.from('discussion_threads').insert({ course_id: ctx.course.id, author_id: ctx.student.id, title: '[TEST] question', body: '[TEST] how do I sign THANK YOU?' }).select().single(), 'thread');
  const fake = await ctx.student.client.from('discussion_threads').insert({ course_id: ctx.course.id, author_id: ctx.student.id, title: '[TEST] fake', body: 'x', is_announcement: true });
  assert(fake.error, 'student cannot announce');
  ok(await ctx.trainer.client.from('discussion_threads').insert({ course_id: ctx.course.id, author_id: ctx.trainer.id, title: '[TEST] announcement', body: '[TEST] assessments next week', is_announcement: true }), 'announcement');
  const edit = await ctx.other.client.from('discussion_threads').update({ body: 'hacked' }).eq('id', th.id).select();
  assert(!edit.error && edit.data.length === 0, 'other user cannot edit');
  ok(await ctx.other.client.from('discussion_reports').insert({ thread_id: th.id, reporter_id: ctx.other.id, reason: '[TEST] report' }), 'report');
  ok(await ctx.trainer.client.rpc('moderate_discussion', { p_thread_id: th.id, p_hidden: true }), 'moderate');
  const unhide = await ctx.student.client.from('discussion_threads').update({ is_hidden: false }).eq('id', th.id);
  assert(unhide.error, 'author cannot un-hide');
});
await step('notifications: own only, cannot be forged or rewritten, mark as read works', async () => {
  const others = ok(await ctx.other.client.from('notifications').select('id').eq('user_id', ctx.student.id), 'others');
  assert(others.length === 0, "cannot read another's notifications");
  const forge = await ctx.other.client.from('notifications').insert({ user_id: ctx.student.id, type: 'system', title: '[TEST] fake' });
  assert(forge.error, 'cannot create notifications');
  const rpc = await ctx.other.client.rpc('fn_notify', { p_user: ctx.student.id, p_type: 'system', p_title: 'x' });
  assert(rpc.error, 'fn_notify not callable');
  const one = ok(await ctx.student.client.from('notifications').select('id').limit(1).single(), 'one');
  const rewrite = await ctx.student.client.from('notifications').update({ title: 'rewritten' }).eq('id', one.id);
  assert(rewrite.error, 'cannot rewrite title');
  const n = ok(await ctx.student.client.rpc('mark_notifications_read', { p_ids: null }), 'mark read');
  assert(n > 0, 'marked');
  const types = ok(await ctx.student.client.from('notifications').select('type'), 'types').map((x) => x.type);
  return `${new Set(types).size} notification types received: ${[...new Set(types)].join(', ')}`;
});

begin('Negative security checks (anonymous + cross-user)');
await step('anonymous: private tables refuse REST access outright; the public catalogue and contact form still work', async () => {
  for (const t of ['profiles', 'enrollments', 'payments', 'identity_verifications', 'identity_documents', 'assessment_attempts', 'notifications', 'audit_logs', 'platform_settings', 'support_tickets', 'certificates', 'site_content', 'staff_invitations', 'email_outbox', 'payment_methods']) {
    const r = await anon.from(t).select('*').limit(1);
    assert(r.error && /permission denied/i.test(r.error.message), `anon ${t}: ${r.error?.message ?? 'rows returned'}`);
  }
  assert(ok(await anon.from('courses').select('id').eq('id', ctx.course.id), 'catalogue').length === 1, 'published course visible');
  assert(Array.isArray(ok(await anon.rpc('get_site_content_public'), 'site content')), 'public content');
  ok(await anon.from('contact_messages').insert({ full_name: '[TEST] Visitor', email: `mcsli-e2e-contact-${RUN}@mcsli-e2e.test`, body: `[TEST] contact ${RUN}` }), 'contact form');
  assert((await anon.from('contact_messages').select('id')).error, 'anon cannot read messages');
  for (const [fn, args] of [['admin_dashboard_stats', {}], ['review_payment', { p_payment_id: ctx.pay1, p_decision: 'confirmed' }], ['enroll_in_course', { p_course_id: ctx.course.id, p_plan: 'full' }], ['issue_certificate', { p_enrollment_id: ctx.enrollment }], ['get_my_course_map', { p_enrollment_id: ctx.enrollment }]]) {
    const r = await anon.rpc(fn, args);
    assert(r.error, `anon rpc ${fn}`);
  }
  const pub = ok(await anon.rpc('get_public_settings'), 'public settings');
  assert(!('identity_retention_days' in pub), 'public settings subset only');
});
await step("cross-student: profile, payments, assessments, certificates, identity", async () => {
  const c = ctx.other.client;
  for (const [t, col] of [['profiles', 'id'], ['payments', 'user_id'], ['certificates', 'user_id'], ['identity_documents', 'user_id']]) {
    const r = ok(await c.from(t).select('*').eq(col, ctx.student.id), t);
    assert(r.length === 0, `other student read ${t}`);
  }
  const aa = ok(await c.from('assessment_attempts').select('*').eq('enrollment_id', ctx.enrollment), 'attempts');
  assert(aa.length === 0, 'other student read assessments');
  const idsum = ok(await c.rpc('get_my_identity'), 'identity');
  assert(idsum.length === 0, 'other student read identity summary');
  const adminList = await c.rpc('admin_list_identities');
  assert(adminList.error, 'student cannot list identities');
  const totals = await c.rpc('fn_confirmed_totals', { p_enrollment_id: ctx.enrollment });
  assert(totals.error, 'payment totals helper not callable');
});
await step('manipulated user_metadata cannot grant a role', async () => {
  ok(await ctx.student.client.auth.updateUser({ data: { role: 'SUPER_ADMIN', account_status: 'active', is_admin: true } }), 'metadata update');
  const p = ok(await ctx.student.client.from('profiles').select('role').eq('id', ctx.student.id).single(), 'profile');
  assert(p.role === 'STUDENT', `role ${p.role}`);
  await denied(ctx.student.client.rpc('admin_dashboard_stats'));
  assert(ok(await ctx.student.client.rpc('is_admin'), 'is_admin') === false, 'is_admin() false');
  assert((await ctx.student.client.from('profiles').update({ role: 'ADMIN' }).eq('id', ctx.student.id)).error, 'direct role write refused');
});
await step('guessed identifiers reveal nothing', async () => {
  const rnd = crypto.randomUUID();
  await denied(ctx.other.client.rpc('get_my_course_map', { p_enrollment_id: rnd }));
  await denied(ctx.other.client.rpc('authorize_identity_document_access', { p_document_id: rnd }), /not found/);
  await denied(ctx.other.client.rpc('authorize_identity_document_access', { p_document_id: ctx.docId }), /not found/);
  assert(ok(await ctx.other.client.from('payments').select('id').eq('id', ctx.pay1), 'payment by id').length === 0, 'guessed payment id');
  assert(ok(await ctx.other.client.from('identity_documents').select('id').eq('id', ctx.docId), 'document by id').length === 0, 'guessed document id');
  assert(ok(await ctx.other.client.from('lessons').select('id').eq('id', ctx.l2), 'lesson by id').length === 0, 'guessed locked lesson id');
  assert(ok(await anon.rpc('verify_certificate', { p_number: 'MCSLI-2026-AAAAAA' }), 'certificate').found === false, 'guessed certificate number');
});
await step('trainer boundaries: no payment configuration, settings, staff administration or identity data', async () => {
  const t = ctx.trainer.client;
  const pm = await t.from('payment_methods').update({ is_enabled: false }).eq('id', ctx.method.id).select();
  assert(!pm.error && pm.data.length === 0, 'trainer cannot edit payment methods');
  assert(ok(await t.from('platform_settings').select('*'), 'settings').length === 0, 'no platform settings');
  await denied(t.rpc('review_payment', { p_payment_id: ctx.pay1, p_decision: 'confirmed' }));
  await denied(t.rpc('admin_set_user_role', { p_user_id: ctx.other.id, p_role: 'TRAINER' }));
  await denied(t.rpc('admin_list_identities'));
  await denied(t.rpc('admin_reveal_identity_number', { p_verification_id: ctx.vid }));
  assert((await t.rpc('list_staff_invitations')).error, 'no invitation list');
  assert((await t.storage.from('identity-documents').createSignedUrl(ctx.docPath, 60)).error, 'no identity scans');
});
await step('auth redirect allow-list: /accept-invite?token=… and /reset-password survive on every production host', async () => {
  if (isLocal) return 'local stack: site host only';
  const hosts = ['https://mcsli.org', 'https://www.mcsli.org', 'https://mcsli.vercel.app'];
  for (const h of hosts) {
    for (const [type, path] of [['magiclink', '/accept-invite?token=redirect-check'], ['recovery', '/reset-password']]) {
      const r = ok(await service.auth.admin.generateLink({ type, email: ctx.other.email, options: { redirectTo: `${h}${path}` } }), `link ${h}${path}`);
      const loc = await followVerify(r.properties.action_link);
      assert(loc.startsWith(`${h}${path}`), `${type} → ${loc.replace(/(access_token|refresh_token|code)=[^&#]+/g, '$1=…').slice(0, 140)}`);
    }
  }
  return `${hosts.length} hosts × 2 flows kept their destination`;
});
await step('a suspended account cannot act; it works again after reactivation', async () => {
  ok(await ctx.admin.client.rpc('admin_set_account_status', { p_user_id: ctx.other.id, p_status: 'suspended', p_reason: '[TEST] suspension check' }), 'suspend');
  assert((await ctx.other.client.from('discussion_threads').insert({ course_id: ctx.course.id, author_id: ctx.other.id, title: '[TEST] suspended', body: 'x' })).error, 'suspended account cannot post');
  await denied(ctx.other.client.rpc('submit_identity', { p_doc_type: 'passport', p_id_number: 'P1234567', p_full_name: '[TEST] Other', p_issuing_country: 'Kenya', p_consent: true }), /suspended/);
  ok(await ctx.admin.client.rpc('admin_set_account_status', { p_user_id: ctx.other.id, p_status: 'active', p_reason: '[TEST] reactivated' }), 'reactivate');
  ok(await ctx.other.client.from('discussion_threads').insert({ course_id: ctx.course.id, author_id: ctx.other.id, title: '[TEST] back', body: '[TEST] reactivated' }), 'posts again');
});
await step('certificate verification rate limit (30 / 10 min per client)', async () => {
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await anon.rpc('verify_certificate', { p_number: `MCSLI-2000-RATE${String(i).padStart(2, '0')}` });
    if (r.error && /Too many verification requests/.test(r.error.message)) limited = true;
  }
  assert(limited, 'rate limit triggered');
  return 'blocked after the limit';
});

// ---------------------------------------------------------------------------
// cleanup of mutable configuration created by this run (records stay, labelled [TEST])
// ---------------------------------------------------------------------------
// Nothing privileged or publicly visible is left behind: the [TEST] course is unpublished and
// archived, the [TEST] payment method disabled, and [TEST] staff accounts demoted and suspended.
begin('Staff two-factor authentication');
await step('TOTP enrol + verify raises the session to aal2; a wrong code is refused', async () => {
  const e = ok(await ctx.super.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: '[TEST] e2e' }), 'enroll');
  assert((await ctx.super.client.auth.mfa.challengeAndVerify({ factorId: e.id, code: '000000' })).error, 'wrong code refused');
  ok(await ctx.super.client.auth.mfa.challengeAndVerify({ factorId: e.id, code: totp(e.totp.secret) }), 'verify');
  const aal = ok(await ctx.super.client.auth.mfa.getAuthenticatorAssuranceLevel(), 'aal');
  assert(aal.currentLevel === 'aal2', `aal ${aal.currentLevel}`);
});
await step('require_staff_mfa: only an aal2 super admin can enable it; aal1 staff are then blocked by the database; students unaffected', async () => {
  if (!isLocal) return 'skipped on the hosted project (would affect real staff); enforced on the local stack';
  const fresh = newClient();
  ok(await fresh.auth.signInWithPassword({ email: ctx.super.email, password: PASSWORD }), 'aal1 login');
  await denied(fresh.rpc('set_platform_setting', { p_key: 'require_staff_mfa', p_value: true }), /two-factor/);
  ok(await ctx.super.client.rpc('set_platform_setting', { p_key: 'require_staff_mfa', p_value: true }), 'enable (aal2)');
  assert(ok(await anon.rpc('get_public_settings'), 'settings').require_staff_mfa === true, 'published to the app');
  await denied(ctx.admin.client.rpc('admin_dashboard_stats'));
  assert(ok(await ctx.admin.client.from('payments').select('id'), 'payments').length === 0, 'aal1 admin reads nothing');
  await denied(ctx.trainer.client.rpc('trainer_dashboard_stats'));
  assert(ok(await fresh.from('audit_logs').select('id').limit(1), 'audit').length === 0, 'aal1 super-admin session reads nothing');
  ok(await ctx.student.client.rpc('get_my_course_map', { p_enrollment_id: ctx.enrollment }), 'students unaffected');
  const e = ok(await ctx.admin.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: '[TEST] e2e' }), 'enroll admin');
  ok(await ctx.admin.client.auth.mfa.challengeAndVerify({ factorId: e.id, code: totp(e.totp.secret) }), 'verify admin');
  ok(await ctx.admin.client.rpc('admin_dashboard_stats'), 'aal2 admin works');
  ok(await ctx.super.client.rpc('set_platform_setting', { p_key: 'require_staff_mfa', p_value: false }), 'disable');
  ok(await ctx.trainer.client.rpc('trainer_dashboard_stats'), 'trainer works again');
});

begin('Cleanup');
await step('remove [TEST] course, files, invitations, messages and payment method; ban + suspend [TEST] accounts', async () => {
  const all = [ctx.student, ctx.other, ctx.super, ctx.admin, ctx.trainer, ctx.resendUser].filter(Boolean);
  const ids = all.map((u) => u.id);
  if (ctx.course) {
    ok(await service.from('enrollments').delete().eq('course_id', ctx.course.id), 'enrollments');
    ok(await service.from('courses').delete().eq('id', ctx.course.id), 'course');
  }
  if (ctx.method) ok(await service.from('payment_methods').delete().eq('id', ctx.method.id), 'payment method');
  ok(await service.from('support_tickets').delete().in('user_id', ids), 'tickets');
  ok(await service.from('email_outbox').delete().in('user_id', ids), 'outbox');
  ok(await service.from('staff_invitations').delete().like('email', `%mcsli-e2e-%${RUN}%`), 'invitations');
  ok(await service.from('contact_messages').delete().like('body', `[TEST] contact ${RUN}%`), 'contact message');
  for (const [bucket, paths] of [['identity-documents', [ctx.docPath]], ['payment-proofs', [ctx.proofPath]], ['course-media', Object.values(ctx.media ?? {})]]) {
    const p = paths.filter(Boolean);
    if (p.length) await service.storage.from(bucket).remove(p);
  }
  const staff = [ctx.super, ctx.admin, ctx.trainer, ctx.resendUser].filter(Boolean).map((u) => u.id);
  if (staff.length) ok(await service.from('profiles').update({ role: 'STUDENT', account_status: 'suspended' }).in('id', staff), 'demote staff');
  const left = ok(await service.from('profiles').select('id').in('id', staff).neq('role', 'STUDENT'), 'check');
  assert(left.length === 0, 'no privileged [TEST] accounts remain');
  // every [TEST] account is banned from signing in again (audit rows reference them and are immutable)
  for (const u of all) ok(await service.auth.admin.updateUserById(u.id, { ban_duration: '876000h' }), `ban ${u.email}`);
  ok(await service.from('profiles').update({ account_status: 'suspended' }).in('id', all.map((u) => u.id)), 'suspend all');
  return `course, files, invitations, messages removed; ${staff.length} [TEST] staff demoted; ${all.length} [TEST] accounts banned + suspended`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed${failed.length ? ` · ${failed.length} FAILED` : ''}`);
if (process.env.E2E_JSON) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.E2E_JSON, JSON.stringify({ run: RUN, target: isLocal ? 'local' : 'hosted', at: new Date().toISOString(), results }, null, 2));
}
process.exit(failed.length ? 1 : 0);
