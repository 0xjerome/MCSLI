/**
 * Production observability hook.
 *
 * No monitoring provider is configured for MCSLI yet, so by default errors are only written to the
 * browser console in development builds. To connect Sentry, Logflare, Better Stack, etc., call
 * `setErrorReporter()` once in src/main.tsx with a function that forwards the (already redacted)
 * event. See docs/SUPABASE_SETUP.md → "Observability".
 *
 * Every event passes through `redact()` first: identification numbers, e-mail addresses, phone
 * numbers, JWTs and long digit runs never leave the browser.
 */

export type ErrorArea = 'auth' | 'payment' | 'assessment' | 'exam' | 'identity' | 'storage' | 'edge-function' | 'database' | 'network' | 'unknown';

export interface ErrorEvent {
  area: ErrorArea;
  message: string;
  code?: string;
  context?: string;
  at: string;
}

type Reporter = (event: ErrorEvent) => void;

let reporter: Reporter | null = null;

export function setErrorReporter(fn: Reporter | null): void {
  reporter = fn;
}

/** Remove anything that could identify a person or grant access. */
export function redact(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[A-Z]{2}[A-Z0-9]{12}\b/g, '[id-number]') // Ugandan NIN shape
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .slice(0, 500);
}

export function classifyError(e: unknown): ErrorArea {
  const err = e as { message?: string; name?: string; code?: string; status?: number } | null;
  const msg = `${err?.name ?? ''} ${err?.message ?? ''}`;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'network';
  if (/AuthApiError|AuthError|login|password|session|JWT|e-?mail not confirmed/i.test(msg)) return 'auth';
  if (/FunctionsHttpError|FunctionsFetchError|FunctionsRelayError/.test(msg)) return 'edge-function';
  if (/StorageError|storage|bucket|object/i.test(msg)) return 'storage';
  if (/payment|receipt|installment/i.test(msg)) return 'payment';
  if (/assessment|reassessment/i.test(msg)) return 'assessment';
  if (/exam|attempt/i.test(msg)) return 'exam';
  if (/identity|identification|document/i.test(msg)) return 'identity';
  if (err?.code) return 'database';
  return 'unknown';
}

export function reportError(e: unknown, context?: string, area?: ErrorArea): void {
  const err = e as { message?: string; code?: string } | null;
  const event: ErrorEvent = {
    area: area ?? classifyError(e),
    message: redact(err?.message ?? String(e)),
    code: err?.code,
    context,
    at: new Date().toISOString(),
  };
  if (import.meta.env.DEV) {
    console.error('[mcsli]', event);
  }
  try {
    reporter?.(event);
  } catch {
    // never let monitoring break the app
  }
}
