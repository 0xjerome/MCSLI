import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

/** Normalises Supabase/Postgres errors into short, safe user-facing messages. */
export function friendlyError(e: unknown): string {
  if (e instanceof SupabaseNotConfiguredError) return 'The learning platform is not connected to a database yet.';
  const err = e as { message?: string; code?: string; details?: string } | null;
  const msg = err?.message ?? '';
  if (!msg) return 'Something went wrong. Please try again.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect e-mail or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your e-mail address first. Check your inbox for the verification link.';
  if (/User already registered|already been registered/i.test(msg)) return 'An account with this e-mail already exists. Try logging in instead.';
  if (/Password should be/i.test(msg)) return 'Password must be at least 8 characters.';
  if (/row-level security|permission denied|not authorised|not authorized/i.test(msg)) return "You don't have permission to do that.";
  if (/JWT expired|session/i.test(msg)) return 'Your session has expired. Please log in again.';
  // Business-rule errors raised by our SQL functions are already human readable.
  return msg.replace(/^(error|ERROR):\s*/i, '').slice(0, 300);
}
