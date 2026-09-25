#!/usr/bin/env node
/**
 * Promote the FIRST MCSLI super administrator. Intentional, one-time, audited.
 *
 *   DATABASE_URL='<direct Postgres connection string>' node scripts/bootstrap-super-admin.mjs you@mcsli.org
 *
 * Preconditions (enforced in SQL by public.bootstrap_super_admin):
 *   - the person has registered through the website and confirmed their e-mail;
 *   - no SUPER_ADMIN exists yet (afterwards, roles are granted in Admin → Trainers & staff);
 *   - the call comes from a direct database session, never through the public API.
 * The promotion is written to audit_logs as `profile.super_admin_bootstrapped`.
 *
 * Equivalent without Node: run  select public.bootstrap_super_admin('you@mcsli.org');
 * in the Supabase dashboard → SQL Editor.
 *
 * The connection string contains the database password: pass it through the environment for this
 * one command only; never commit it or put it in .env files that are shared.
 */
import pg from 'pg';

const email = process.argv[2];
const url = process.env.DATABASE_URL;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: DATABASE_URL=... node scripts/bootstrap-super-admin.mjs <email>');
  process.exit(1);
}
if (!url) {
  console.error('Set DATABASE_URL to the project\'s direct Postgres connection string (Supabase → Connect).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query('select public.bootstrap_super_admin($1) as id', [email]);
  console.log(`OK: ${email} is now SUPER_ADMIN (profile ${rows[0].id}). This action is recorded in audit_logs.`);
} catch (e) {
  console.error(`Not changed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
