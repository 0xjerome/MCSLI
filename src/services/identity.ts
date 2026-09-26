import { getSupabase } from '@/lib/supabase';
import type { IdentityDocument, IdentitySummary } from '@/types/database';
import type { IdentityDocType } from '@/domain/types';
import { validateUpload } from './payments';

const sb = () => getSupabase();
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function getMyIdentity(): Promise<IdentitySummary | null> {
  const rows = must(await sb().rpc('get_my_identity')) as IdentitySummary[] | null;
  return rows?.[0] ?? null;
}

export async function listMyIdentityDocuments(): Promise<IdentityDocument[]> {
  return must(await sb().from('identity_documents').select('*').is('deleted_at', null).order('uploaded_at', { ascending: false })) as IdentityDocument[];
}

export async function submitIdentity(input: { docType: IdentityDocType; idNumber: string; fullName: string; issuingCountry: string; consent: boolean }): Promise<string> {
  return must(
    await sb().rpc('submit_identity', {
      p_doc_type: input.docType,
      p_id_number: input.idNumber,
      p_full_name: input.fullName,
      p_issuing_country: input.issuingCountry,
      p_consent: input.consent,
    }),
  ) as string;
}

/**
 * Upload an identification document to the caller's private folder and register it.
 * The path is namespaced by user id; storage RLS refuses any other prefix.
 */
export async function uploadIdentityDocument(userId: string, file: File): Promise<string> {
  const err = validateUpload(file);
  if (err) throw new Error(err);
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const rel = `${userId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb().storage.from('identity-documents').upload(rel, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const path = `identity-documents/${rel}`;
  try {
    return must(await sb().rpc('register_identity_document', { p_storage_path: path, p_file_name: file.name.slice(0, 120), p_mime: file.type, p_size: file.size })) as string;
  } catch (e) {
    // keep storage consistent with the database
    await sb().storage.from('identity-documents').remove([rel]);
    throw e;
  }
}

export async function deleteIdentityDocument(documentId: string): Promise<void> {
  must(await sb().rpc('delete_identity_document', { p_document_id: documentId }));
}

/** Owner-only short-lived link (students previewing their own upload). Admin access goes through the audited Edge Function. */
export async function myDocumentUrl(path: string): Promise<string> {
  const rel = path.replace(/^identity-documents\//, '');
  const res = await sb().storage.from('identity-documents').createSignedUrl(rel, 120);
  if (res.error) throw res.error;
  return res.data.signedUrl;
}
