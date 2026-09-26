/**
 * Cohort status derivation – mirrors public.fn_cohort_phase / fn_cohort_applications_state in
 * migration 20260927140000 so the UI can label cohorts consistently (the database remains the
 * authority: submissions are refused server-side after the deadline).
 */
export type CohortPhase = 'upcoming' | 'in_progress' | 'completed';
export type CohortApplicationsState = 'open' | 'closed' | 'opening_soon';
export type CohortStatusOverride = 'applications_open' | 'applications_closed' | 'completed' | null;
export type DeliveryMode = 'online' | 'physical' | 'hybrid';

export interface CohortStatusInput {
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
  application_opens_at: string | null;
  application_deadline: string | null;
  status_override: CohortStatusOverride;
}

const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`) : null);

export function cohortPhase(c: CohortStatusInput, now = new Date()): CohortPhase {
  if (c.status_override === 'completed') return 'completed';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = day(c.end_date);
  if (end && end < today) return 'completed';
  const start = day(c.start_date);
  if (start && start <= today) return 'in_progress';
  return 'upcoming';
}

export function cohortApplicationsState(c: CohortStatusInput, now = new Date()): CohortApplicationsState {
  if (c.status_override === 'applications_open') return 'open';
  if (c.status_override === 'applications_closed' || c.status_override === 'completed') return 'closed';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = day(c.end_date);
  if (end && end < today) return 'closed';
  if (!c.is_open) return 'closed';
  if (c.application_opens_at && now < new Date(c.application_opens_at)) return 'opening_soon';
  if (c.application_deadline && now > new Date(c.application_deadline)) return 'closed';
  return 'open';
}

/** One human label combining both dimensions, e.g. for a card badge. */
export function cohortStatusLabel(phase: CohortPhase, applications: CohortApplicationsState): { label: string; tone: 'success' | 'info' | 'neutral' | 'warning' | 'brand' } {
  if (phase === 'completed') return { label: 'Completed', tone: 'neutral' };
  if (phase === 'in_progress') return applications === 'open' ? { label: 'In progress · applications open', tone: 'success' } : { label: 'In progress', tone: 'brand' };
  if (applications === 'open') return { label: 'Applications open', tone: 'success' };
  if (applications === 'opening_soon') return { label: 'Applications opening soon', tone: 'info' };
  return { label: 'Upcoming · applications closed', tone: 'warning' };
}

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = { online: 'Online', physical: 'Physical (Kampala)', hybrid: 'Online & physical' };

/** Human-readable application identifier, e.g. MCSLI-C9-2026-000123 (never used for authorisation). */
export const APPLICATION_REFERENCE_PATTERN = /^MCSLI-C(\d{1,3}|X)-\d{4}-\d{6}$/;
