#!/usr/bin/env node
/**
 * Step 1 of bootstrapping the first SUPER_ADMIN (admin@mcsli.org by default).
 *
 * Sends a Supabase Auth invitation e-mail. The owner of the mailbox opens it, lands on
 * <site>/accept-invite, and chooses their OWN password there (nobody else ever sees it). Their e-mail
 * address is confirmed by following the link. Step 2 (after they have done that):
 *
 *   npx supabase db query --linked "select public.bootstrap_super_admin('admin@mcsli.org')"
 *
 * which is refused through the API, refused while the address is unconfirmed, refused once any
 * SUPER_ADMIN exists, and audited as profile.super_admin_bootstrapped.
 *
 * Usage (keys are read from the logged-in Supabase CLI and never printed):
 *   node scripts/invite-first-super-admin.mjs [--email admin@mcsli.org] [--site https://mcsli.org]
 * --site must be in the Auth redirect allow-list and serve the deployed app (for example
 * https://mcsli.vercel.app before the mcsli.org DNS points at Vercel).
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const email = arg('email', 'admin@mcsli.org').toLowerCase();
const site = arg('site', 'https://mcsli.org').replace(/\/$/, '');
const ref = arg('project-ref', 'midvngbooepderxboqru');
const url = `https://${ref}.supabase.co`;

function keys() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) return { service: process.env.SUPABASE_SERVICE_ROLE_KEY, anon: process.env.SUPABASE_ANON_KEY };
  const out = execFileSync('npx', ['supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'env', '--agent', 'no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const env = Object.fromEntries(out.split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  return { service: env.SUPABASE_SERVICE_ROLE_KEY, anon: env.SUPABASE_ANON_KEY };
}

const k = keys();
if (!k.service || !k.anon) {
  console.error('Could not read the project keys. Run `npx supabase login` first.');
  process.exit(1);
}
const admin = createClient(url, k.service, { auth: { persistSession: false } });

const { data: supers } = await admin.from('profiles').select('id').eq('role', 'SUPER_ADMIN').limit(1);
if (supers?.length) {
  console.error('A SUPER_ADMIN already exists. Invite further staff from Admin → Staff.');
  process.exit(1);
}
const redirectTo = `${site}/accept-invite`;
const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
let error;
if (!existing) {
  ({ error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: 'MCSLI Administrator' } }));
} else {
  const mailer = createClient(url, k.anon, { auth: { persistSession: false, flowType: 'implicit' } });
  ({ error } = await mailer.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } }));
}
if (error) {
  console.error(`Not sent: ${error.message}`);
  process.exit(1);
}
console.log(`Invitation e-mail sent to ${email}. The link opens ${redirectTo}. It expires; if it has, run this script again.`);
console.log(`After the password is set, run:\n  npx supabase db query --linked "select public.bootstrap_super_admin('${email}')"`);
