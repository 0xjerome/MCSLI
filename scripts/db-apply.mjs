#!/usr/bin/env node
/**
 * Applies the SQL migrations (and optionally the development seed) to a Postgres database.
 *
 *   node scripts/db-apply.mjs                # apply migrations to $DATABASE_URL
 *   node scripts/db-apply.mjs --seed         # migrations + supabase/seed/dev_seed.sql
 *   node scripts/db-apply.mjs --reset        # drop & recreate the public schema first (DANGEROUS – dev only)
 *   node scripts/db-apply.mjs --local        # also apply tests/db/shim.sql (plain Postgres without Supabase)
 *
 * For a hosted Supabase project use `supabase db push` (see docs/SUPABASE_SETUP.md); this script exists
 * so the schema can be validated and tested without the Supabase CLI or Docker.
 *
 * SAFETY: --reset and --seed are refused unless the database host is local (localhost, 127.0.0.1,
 * ::1, a Docker service name) – demo data and schema resets can never reach production by accident.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (or TEST_DATABASE_URL) first.');
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres', 'supabase_db_mcsli'].includes(host);
if ((args.has('--reset') || args.has('--seed')) && !isLocal) {
  console.error(`Refusing to ${args.has('--reset') ? 'reset' : 'seed'} a non-local database (${host || 'unknown host'}).`);
  console.error('Demo seeds and resets are for local development only. Use `supabase db push` for hosted projects.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (args.has('--reset')) {
    console.log('Resetting public schema…');
    await client.query('drop schema if exists public cascade; create schema public;');
    if (args.has('--local')) await client.query('drop schema if exists auth cascade; drop schema if exists storage cascade; drop schema if exists private cascade; drop schema if exists vault cascade;');
  }
  if (args.has('--local')) {
    console.log('Applying Supabase shim…');
    await client.query(readFileSync(join(root, 'tests/db/shim.sql'), 'utf8'));
  }
  const dir = join(root, 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    process.stdout.write(`Applying ${f}… `);
    await client.query(readFileSync(join(dir, f), 'utf8'));
    console.log('ok');
  }
  if (args.has('--seed')) {
    process.stdout.write('Applying development seed… ');
    await client.query(readFileSync(join(root, 'supabase/seed/dev_seed.sql'), 'utf8'));
    console.log('ok');
  }
  console.log('Done.');
} catch (e) {
  console.error('\nFAILED:', e.message);
  if (e.position) console.error('at position', e.position);
  process.exitCode = 1;
} finally {
  await client.end();
}
