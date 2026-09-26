#!/usr/bin/env node
/**
 * Production e-mail delivery check: exercises the REAL sign-up confirmation and password-reset
 * paths of the hosted project (Supabase Auth → custom SMTP → Resend) for a mailbox you control.
 *
 *   node scripts/email-delivery-check.mjs you+mcsli-check@gmail.com [--site https://www.mcsli.org]
 *
 * What happens:
 *   1. a [TEST] student account is created through the normal sign-up API → "Confirm your
 *      e-mail" message is sent to the address;
 *   2. after the mailer's 60-second per-user interval, a password-reset message is sent;
 *   3. the account is banned so nobody can sign in with it; delete it later from Supabase → Users.
 * Then check the inbox (links must land on <site>/login?verified=1 and <site>/reset-password) and
 * Resend → Logs (both messages "Delivered").
 *
 * Keys are read from the logged-in Supabase CLI; nothing is printed except the outcome.
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const to = process.argv[2];
const site = (process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : 'https://www.mcsli.org').replace(/\/$/, '');
const ref = 'midvngbooepderxboqru';
if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
  console.error('Usage: node scripts/email-delivery-check.mjs <address you control> [--site https://www.mcsli.org]');
  process.exit(1);
}
const env = execFileSync('npx', ['supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'env', '--agent', 'no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const key = (name) => env.match(new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'))?.[1];
const url = `https://${ref}.supabase.co`;
const anon = createClient(url, key('SUPABASE_ANON_KEY'), { auth: { persistSession: false, flowType: 'pkce' } });
const admin = createClient(url, key('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const password = `Check-${crypto.randomUUID()}-Aa1!`; // never printed; the account is banned at the end
const t0 = Date.now();

// 1. real sign-up (same call the registration form makes)
const su = await anon.auth.signUp({ email: to, password, options: { emailRedirectTo: `${site}/login?verified=1`, data: { full_name: '[TEST] E-mail delivery check', nationality: 'ugandan', country: 'Uganda' } } });
if (su.error) {
  console.error(`sign-up refused: ${su.error.message}`);
  process.exit(1);
}
const userId = su.data.user?.id;
console.log(`1/3 confirmation e-mail requested for ${to} (user ${userId})`);

// 2. password reset needs a confirmed address; the mailer allows one e-mail per address per minute
await admin.auth.admin.updateUserById(userId, { email_confirm: true });
const wait = 61_000 - (Date.now() - t0);
if (wait > 0) await new Promise((r) => setTimeout(r, wait));
const rs = await anon.auth.resetPasswordForEmail(to, { redirectTo: `${site}/reset-password` });
if (rs.error) console.error(`password reset refused: ${rs.error.message}`);
else console.log(`2/3 password-reset e-mail requested for ${to}`);

// 3. make the account unusable (records stay for inspection; delete from Supabase → Users later)
await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
await admin.from('profiles').update({ account_status: 'suspended' }).eq('id', userId);
console.log('3/3 [TEST] account banned + suspended');
console.log(`Now check the inbox for "Confirm" and "Reset" messages from MCSLI <no-reply@mcsli.org>, and Resend → Logs for two "Delivered" entries to ${to}.`);
