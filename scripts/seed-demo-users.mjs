#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY – creates demo accounts through the Supabase Auth admin API
 * (users must be created by Auth; they cannot be inserted with plain SQL on a hosted project).
 *
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-users.mjs
 *
 * Creates (all with password  Demo-Pass-2026! ):
 *   demo.student@mcsli.test   STUDENT   (Ugandan)
 *   demo.intl@mcsli.test      STUDENT   (international)
 *   demo.trainer@mcsli.test   TRAINER   (assigned to the [DEMO] course)
 *   demo.admin@mcsli.test     ADMIN
 *   demo.super@mcsli.test     SUPER_ADMIN
 *
 * Every account is clearly a demo account (e-mail domain .test). Delete them before going live:
 *   delete from auth.users where email like '%@mcsli.test';
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never commit these).');
  process.exit(1);
}
// Demo accounts are for local development only: refuse anything that is not a local Supabase stack
// (supabase start → http://127.0.0.1:54321) unless explicitly allowed for a disposable staging project.
const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(url);
if (process.env.NODE_ENV === 'production' || /mcsli\.org/.test(process.env.SITE_ENV ?? '') || (!isLocalUrl && process.env.ALLOW_DEMO_SEED !== 'staging')) {
  console.error('Refusing to seed demo users outside a local Supabase stack.');
  console.error('For a disposable staging project only, set ALLOW_DEMO_SEED=staging. Never on production.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = 'Demo-Pass-2026!';
const users = [
  { email: 'demo.student@mcsli.test', full_name: '[DEMO] Student Ugandan', nationality: 'ugandan', country: 'Uganda', role: 'STUDENT' },
  { email: 'demo.intl@mcsli.test', full_name: '[DEMO] Student International', nationality: 'international', country: 'Kenya', role: 'STUDENT' },
  { email: 'demo.trainer@mcsli.test', full_name: '[DEMO] Trainer', nationality: 'ugandan', country: 'Uganda', role: 'TRAINER' },
  { email: 'demo.admin@mcsli.test', full_name: '[DEMO] Admin', nationality: 'ugandan', country: 'Uganda', role: 'ADMIN' },
  { email: 'demo.super@mcsli.test', full_name: '[DEMO] Super Admin', nationality: 'ugandan', country: 'Uganda', role: 'SUPER_ADMIN' },
];

const DEMO_COURSE = '11111111-1111-1111-1111-111111111111';
const DEMO_COHORT = '77777777-7777-7777-7777-777777777701';

for (const u of users) {
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, nationality: u.nationality, country: u.country, phone: '+256700000000' },
  });
  if (error && !/already/i.test(error.message)) {
    console.error(u.email, error.message);
    continue;
  }
  let id = data?.user?.id;
  if (!id) {
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
    id = list.users.find((x) => x.email === u.email)?.id;
  }
  if (!id) continue;
  // Service-role connection: the protect_profile trigger allows role changes (auth.uid() is null).
  await sb.from('profiles').update({ role: u.role }).eq('id', id);
  if (u.role === 'TRAINER') {
    await sb.from('trainer_assignments').upsert({ trainer_id: id, course_id: DEMO_COURSE, cohort_id: DEMO_COHORT }, { onConflict: 'trainer_id,course_id,cohort_id', ignoreDuplicates: true });
  }
  console.log(`ok  ${u.email}  ${u.role}`);
}
console.log(`\nPassword for all demo accounts: ${PASSWORD}`);
