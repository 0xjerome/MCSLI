import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const ROOT = join(__dirname, '..', '..');

export const DEMO = {
  course: '11111111-1111-1111-1111-111111111111',
  month1: '22222222-2222-2222-2222-222222222201',
  month2: '22222222-2222-2222-2222-222222222202',
  month3: '22222222-2222-2222-2222-222222222203',
  lesson11: '44444444-4444-4444-4444-444444444011',
  lesson21: '44444444-4444-4444-4444-444444444021',
  quiz1: '55555555-5555-5555-5555-555555555501',
  finalExam: '66666666-6666-6666-6666-666666666601',
  cohort: '77777777-7777-7777-7777-777777777701',
};

export interface TestUser {
  id: string;
  email: string;
}

export function requireUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required, e.g. postgresql://postgres@127.0.0.1:5433/mcsli_test');
  return url;
}

/** Recreate schema, apply shim + migrations + dev seed. */
export async function resetDatabase(client: pg.Client) {
  await client.query('drop schema if exists public cascade; create schema public; drop schema if exists auth cascade; drop schema if exists storage cascade; drop schema if exists private cascade; drop schema if exists vault cascade;');
  await client.query(readFileSync(join(ROOT, 'tests/db/shim.sql'), 'utf8'));
  const dir = join(ROOT, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(dir, f), 'utf8'));
  }
  await client.query(readFileSync(join(ROOT, 'supabase/seed/dev_seed.sql'), 'utf8'));
}

export async function createUser(client: pg.Client, email: string, meta: Record<string, string> = {}, role?: string): Promise<TestUser> {
  const { rows } = await client.query<{ id: string }>(
    `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id`,
    [email, JSON.stringify({ full_name: email.split('@')[0]!.replace(/[._]/g, ' '), ...meta })],
  );
  const id = rows[0]!.id;
  if (role) await client.query(`update public.profiles set role = $1 where id = $2`, [role, id]);
  return { id, email };
}

/**
 * Run `fn` as an authenticated user (RLS enforced) inside a transaction that is committed.
 * Mirrors what PostgREST does: SET ROLE authenticated + request.jwt.claims.
 */
export async function asUser<T>(client: pg.Client, user: TestUser | null, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  await client.query('begin');
  try {
    if (user) {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user.id, role: 'authenticated', email: user.email })]);
      await client.query('set local role authenticated');
    } else {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
      await client.query('set local role anon');
    }
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

/** Expect a query to be rejected (RLS/authorisation). Returns the error message. */
export async function expectDenied(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('expected the operation to be denied');
}

export async function confirmAllPayments(client: pg.Client, admin: TestUser, enrollmentId: string) {
  const { rows } = await client.query(`select id from public.payments where enrollment_id = $1 and status <> 'confirmed'`, [enrollmentId]);
  for (const r of rows) {
    await asUser(client, admin, (q) => q(`select public.review_payment($1, 'confirmed', 'ok')`, [r.id]));
  }
}
