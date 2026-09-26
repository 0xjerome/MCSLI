import { describe, expect, it } from 'vitest';
import { APPLICATION_REFERENCE_PATTERN, cohortApplicationsState, cohortPhase, cohortStatusLabel, type CohortStatusInput } from './cohorts';

const base: CohortStatusInput = { start_date: null, end_date: null, is_open: true, application_opens_at: null, application_deadline: null, status_override: null };
const now = new Date('2026-09-27T12:00:00Z');

describe('cohort status derivation', () => {
  it('derives current / upcoming / completed from dates', () => {
    expect(cohortPhase({ ...base, start_date: '2026-10-05' }, now)).toBe('upcoming');
    expect(cohortPhase({ ...base, start_date: '2026-09-01', end_date: '2026-12-01' }, now)).toBe('in_progress');
    expect(cohortPhase({ ...base, start_date: '2026-01-01', end_date: '2026-04-01' }, now)).toBe('completed');
    expect(cohortPhase({ ...base, status_override: 'completed' }, now)).toBe('completed');
  });

  it('applications: manual switch, opening time and deadline are all respected', () => {
    expect(cohortApplicationsState(base, now)).toBe('open');
    expect(cohortApplicationsState({ ...base, is_open: false }, now)).toBe('closed');
    expect(cohortApplicationsState({ ...base, application_opens_at: '2026-10-01T00:00:00Z' }, now)).toBe('opening_soon');
    expect(cohortApplicationsState({ ...base, application_deadline: '2026-09-20T23:59:59Z' }, now)).toBe('closed');
    expect(cohortApplicationsState({ ...base, application_deadline: '2026-09-30T23:59:59Z' }, now)).toBe('open');
    expect(cohortApplicationsState({ ...base, end_date: '2026-01-01' }, now)).toBe('closed');
  });

  it('staff overrides win over dates', () => {
    expect(cohortApplicationsState({ ...base, is_open: false, status_override: 'applications_open' }, now)).toBe('open');
    expect(cohortApplicationsState({ ...base, status_override: 'applications_closed' }, now)).toBe('closed');
    expect(cohortApplicationsState({ ...base, status_override: 'completed' }, now)).toBe('closed');
  });

  it('labels combine both dimensions', () => {
    expect(cohortStatusLabel('upcoming', 'open').label).toBe('Applications open');
    expect(cohortStatusLabel('upcoming', 'opening_soon').label).toBe('Applications opening soon');
    expect(cohortStatusLabel('in_progress', 'closed').label).toBe('In progress');
    expect(cohortStatusLabel('completed', 'closed').label).toBe('Completed');
  });

  it('recognises the application reference format', () => {
    expect(APPLICATION_REFERENCE_PATTERN.test('MCSLI-C9-2026-000123')).toBe(true);
    expect(APPLICATION_REFERENCE_PATTERN.test('MCSLI-CX-2026-000001')).toBe(true);
    expect(APPLICATION_REFERENCE_PATTERN.test('C9-2026-1')).toBe(false);
  });
});
