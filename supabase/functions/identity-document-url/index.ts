// Supabase Edge Function: identity-document-url
//
// Issues a short-lived signed URL for a private identity document AFTER verifying that the
// caller is an ADMIN/SUPER_ADMIN (or the document's owner) and writing an audit_logs row.
// The service-role key never leaves this function.
//
// Deploy:  supabase functions deploy identity-document-url
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// Request:  POST { "document_id": "<uuid>" }   with the user's Authorization: Bearer <jwt>
// Response: { "url": "https://…signed…", "expires_in": 120 }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client acting as the caller (RLS applies) – used to identify the user and their role.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorised' }, 401);
  const uid = userData.user.id;

  let body: { document_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  const documentId = body.document_id;
  if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: 'document_id required' }, 400);

  // Privileged client for the lookup, audit row and signed URL.
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: profile } = await admin.from('profiles').select('role, account_status').eq('id', uid).single();
  const { data: doc } = await admin.from('identity_documents').select('id, user_id, storage_path, deleted_at').eq('id', documentId).single();
  if (!doc || doc.deleted_at) return json({ error: 'not found' }, 404);

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const isOwner = doc.user_id === uid;
  if (!(isAdmin || isOwner) || profile?.account_status !== 'active') return json({ error: 'forbidden' }, 403);

  const relPath = doc.storage_path.replace(/^identity-documents\//, '');
  const { data: signed, error: signErr } = await admin.storage.from('identity-documents').createSignedUrl(relPath, 120);
  if (signErr || !signed) return json({ error: 'could not sign url' }, 500);

  await admin.from('audit_logs').insert({
    actor_id: uid,
    actor_role: profile?.role ?? null,
    action: isAdmin ? 'identity.document_viewed' : 'identity.document_viewed_by_owner',
    entity_type: 'identity_document',
    entity_id: doc.id,
    target_user_id: doc.user_id,
    metadata: { via: 'edge-function', ip: req.headers.get('x-forwarded-for') ?? null },
  });

  return json({ url: signed.signedUrl, expires_in: 120 });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
