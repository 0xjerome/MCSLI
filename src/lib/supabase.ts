import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { reportError } from './observability';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the browser has a Supabase project to talk to. The public site works without it. */
export const isSupabaseConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Client = SupabaseClient<any, 'public', any>;

let client: Client | null = null;

export function getSupabase(): Client {
  if (!isSupabaseConfigured) {
    throw new SupabaseNotConfiguredError();
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      global: { headers: { 'x-client-info': 'mcsli-platform' } },
    });
  }
  return client;
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).');
    this.name = 'SupabaseNotConfiguredError';
  }
}

export const PERMISSION_MESSAGE = 'You do not have permission to perform this action.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again, or contact MCSLI support if it keeps happening.';

// Messages that come from Postgres/PostgREST internals rather than from MCSLI's business rules.
const INTERNAL_PATTERN = /violates|relation "|column "|function .*does not exist|syntax error|constraint|null value|invalid input syntax|operator does not exist|could not|schema cache|PGRST|duplicate key|out of range|deadlock|canceling statement|pg_|SQLSTATE/i;

/**
 * Normalises Supabase/Postgres errors into short, safe user-facing messages.
 * Raw database/security errors never reach the learner; the original error is passed to
 * reportError() (redacted) for developer diagnostics.
 */
export function friendlyError(e: unknown, context?: string): string {
  if (e instanceof SupabaseNotConfiguredError) return 'The learning platform is not connected to a database yet.';
  const err = e as { message?: string; code?: string; details?: string; hint?: string; status?: number } | null;
  const msg = err?.message ?? '';
  const code = err?.code ?? '';
  reportError(e, context);
  if (!msg) return GENERIC_MESSAGE;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect e-mail or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your e-mail address first. Check your inbox for the verification link.';
  if (/User already registered|already been registered/i.test(msg)) return 'An account with this e-mail already exists. Try logging in instead.';
  if (/Password should be|weak password/i.test(msg)) return 'Password must be at least 8 characters.';
  if (/rate limit|too many requests|security purposes, you can only request/i.test(msg) && !/^Too many (verification requests|messages)/.test(msg)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/JWT expired|invalid JWT|refresh token|session (missing|expired|not found)/i.test(msg)) return 'Your session has expired. Please log in again.';
  if (code === '42501' || /row-level security|permission denied|not authori[sz]ed|forbidden/i.test(msg)) return PERMISSION_MESSAGE;
  if (code === 'PGRST116') return 'We could not find what you were looking for.';
  if (code === '42883' || code === '42P01' || code === 'PGRST202' || code === 'PGRST205') return 'This feature is not available yet. Please contact MCSLI support.';
  if (code === '23503') return 'This item is linked to other records and cannot be changed.';
  if (code === '23514' || code === '22P02' || code === '23502') return 'Some of the information entered is not valid. Please check the form and try again.';
  if (code === '23505' && /duplicate key/i.test(msg)) return 'This has already been recorded.';
  if (INTERNAL_PATTERN.test(msg)) return GENERIC_MESSAGE;
  // Business-rule errors raised by MCSLI's SQL functions (P0001/P0002/22023/23505) are written for people.
  const clean = msg.replace(/^(error|ERROR):\s*/i, '').trim();
  return (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 300);
}
