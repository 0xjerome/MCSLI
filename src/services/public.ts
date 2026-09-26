import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CertificateVerification, CohortApplicationReceipt, Course, EventRow, Json, PublicCohort } from '@/types/database';

// ---------------------------------------------------------------------------
// Cohorts (public): published cohorts, one cohort with its application questions, applications
// ---------------------------------------------------------------------------
export async function listPublicCohorts(): Promise<PublicCohort[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase().rpc('public_cohorts');
  if (error) throw error;
  return (data as PublicCohort[]) ?? [];
}

export async function getPublicCohort(slug: string): Promise<PublicCohort | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase().rpc('public_cohort', { p_slug: slug });
  if (error) throw error;
  return (data as PublicCohort | null) ?? null;
}

export interface CohortApplicationInput {
  slug: string;
  fullName: string;
  email: string;
  phone: string;
  deliveryMode: 'online' | 'physical' | 'hybrid';
  answers: Record<string, Json>;
  consent: boolean;
  /** Honeypot – must stay empty. */
  website?: string;
}
/** Deadline, validation, rate limits and duplicate checks are enforced by the database function. */
export async function submitCohortApplication(input: CohortApplicationInput): Promise<CohortApplicationReceipt> {
  const { data, error } = await getSupabase().rpc('submit_cohort_application', {
    p_slug: input.slug, p_full_name: input.fullName, p_email: input.email, p_phone: input.phone, p_delivery_mode: input.deliveryMode,
    p_answers: input.answers, p_consent: input.consent, p_website: input.website ?? null,
  });
  if (error) throw error;
  return data as CohortApplicationReceipt;
}

export async function verifyCohortApplication(token: string): Promise<{ reference: string; full_name: string; cohort: { name: string; slug: string } }> {
  const { data, error } = await getSupabase().rpc('verify_cohort_application', { p_token: token });
  if (error) throw error;
  return data as { reference: string; full_name: string; cohort: { name: string; slug: string } };
}

/**
 * Fee structure used on the public site when no course has been published in the
 * database yet. These are the fees MCSLI specified for the online course; the live
 * values come from the `courses` table (Admin → Courses).
 */
export const fallbackCourseFees = {
  title: 'Ugandan Sign Language – Online Course',
  currency: 'UGX',
  duration_months: 3,
  tuition_national: 350_000,
  tuition_international: 400_000,
  registration_fee: 20_000,
  installments_enabled: true,
  installment_count: 2,
};

export async function listPublishedCourses(): Promise<Course[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase().from('courses').select('*').eq('is_published', true).eq('is_archived', false).order('created_at');
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function listPublishedEvents(): Promise<EventRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase().from('events').select('*').eq('is_published', true).order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function verifyCertificate(number: string): Promise<CertificateVerification> {
  const { data, error } = await getSupabase().rpc('verify_certificate', { p_number: number });
  if (error) throw error;
  return data as CertificateVerification;
}

export interface ContactSubmission {
  kind: 'contact' | 'volunteer' | 'partner' | 'shop';
  full_name: string;
  email: string;
  phone?: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function submitContactMessage(input: ContactSubmission): Promise<void> {
  const { error } = await getSupabase().from('contact_messages').insert({
    kind: input.kind,
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}
