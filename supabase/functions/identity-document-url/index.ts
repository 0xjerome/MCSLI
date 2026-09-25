// Supabase Edge Function: identity-document-url
//
// Issues a short-lived (120 s) signed URL for one private identity document.
//
//  1. The gateway rejects requests without a valid user JWT (verify_jwt = true in config.toml).
//  2. The function calls public.authorize_identity_document_access() AS THE CALLER. That database
//     function checks the caller (document owner, or an active ADMIN/SUPER_ADMIN), writes the
//     audit_logs row, and only then returns the object path. Not-found and not-permitted are
//     indistinguishable, so document ids cannot be probed (no IDOR oracle).
//  3. Only after a successful, audited authorisation does the service-role client sign the path.
//     Storage policies do not let admins sign identity-document URLs themselves, so this function
//     is the only staff route to a scan.
//
// Nothing sensitive is logged: no JWTs, no document paths, no identification numbers.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// Optional: ALLOWED_ORIGINS="https://mcsli.org,https://www.mcsli.org" (comma separated) to restrict CORS.
//
// Request:  POST { "document_id": "<uuid>" }  with  Authorization: Bearer <user access token>
// Response: 200 { "url": "https://…", "expires_in": 120 }
//           400 invalid request · 401 not signed in · 404 not found or not permitted · 500 unavailable

import { createClient } from 'npm:@supabase/supabase-js@2';

const SIGNED_URL_TTL_SECONDS = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Structured, non-sensitive log line for Supabase's function logs / a log drain.
function log(level: 'info' | 'warn' | 'error', event: string, extra: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ fn: 'identity-document-url', event, ...extra }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/.test(authHeader)) return json(req, { error: 'unauthorised' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceRole) {
    log('error', 'misconfigured');
    return json(req, { error: 'service unavailable' }, 500);
  }

  let documentId: unknown;
  try {
    documentId = (await req.json())?.document_id;
  } catch {
    return json(req, { error: 'invalid request' }, 400);
  }
  if (typeof documentId !== 'string' || !UUID.test(documentId)) return json(req, { error: 'invalid request' }, 400);

  // Acting as the caller: RLS and the SQL authorisation apply.
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(req, { error: 'unauthorised' }, 401);

  const { data: path, error: authzErr } = await asUser.rpc('authorize_identity_document_access', { p_document_id: documentId });
  if (authzErr || typeof path !== 'string' || !path) {
    // P0002 (not found / not permitted) and 42501 (inactive account) look the same to the caller.
    log('warn', 'denied', { code: authzErr?.code ?? 'no_path' });
    return json(req, { error: 'not found' }, 404);
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signErr } = await admin.storage.from('identity-documents').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    log('error', 'sign_failed', { status: (signErr as { statusCode?: string } | null)?.statusCode ?? null });
    return json(req, { error: 'document unavailable' }, 500);
  }

  log('info', 'issued');
  return json(req, { url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });
});
