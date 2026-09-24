import { getSupabase } from '@/lib/supabase';
import type { Payment, PaymentMethod } from '@/types/database';
import type { PaymentPurpose } from '@/domain/types';

const sb = () => getSupabase();
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUpload(file: File, allowed = ALLOWED_PROOF_TYPES, max = MAX_UPLOAD_BYTES): string | null {
  if (!allowed.includes(file.type)) return 'Only JPG, PNG, WEBP images or PDF files are accepted.';
  if (file.size > max) return `File is too large (max ${Math.round(max / 1024 / 1024)} MB).`;
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return must(await sb().from('payment_methods').select('*').order('position')) as PaymentMethod[];
}

export async function listMyPayments(enrollmentId?: string): Promise<Payment[]> {
  let q = sb().from('payments').select('*').order('submitted_at', { ascending: false });
  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId);
  return must(await q) as Payment[];
}

/** Uploads a proof file to the caller's private folder and returns the storage path. */
export async function uploadPaymentProof(userId: string, file: File): Promise<string> {
  const err = validateUpload(file);
  if (err) throw new Error(err);
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const res = await sb().storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false });
  if (res.error) throw res.error;
  return `payment-proofs/${path}`;
}

export interface SubmitPaymentInput {
  enrollmentId: string;
  purpose: PaymentPurpose;
  installmentNumber: number | null;
  methodId: string;
  amount: number;
  payerName: string;
  reference: string;
  paidAt: string; // YYYY-MM-DD
  proofPath?: string | null;
}

export async function submitPayment(i: SubmitPaymentInput): Promise<string> {
  return must(
    await sb().rpc('submit_payment', {
      p_enrollment_id: i.enrollmentId,
      p_purpose: i.purpose,
      p_installment_number: i.installmentNumber,
      p_method_id: i.methodId,
      p_amount: i.amount,
      p_payer_name: i.payerName,
      p_reference: i.reference,
      p_paid_at: i.paidAt,
      p_proof_path: i.proofPath ?? null,
    }),
  ) as string;
}

/** Signed URL for a proof the caller is allowed to see (owner or admin, enforced by storage RLS). */
export async function proofUrl(path: string): Promise<string> {
  const rel = path.replace(/^payment-proofs\//, '');
  const res = await sb().storage.from('payment-proofs').createSignedUrl(rel, 300);
  if (res.error) throw res.error;
  return res.data.signedUrl;
}
