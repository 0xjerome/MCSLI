import { describe, expect, it } from 'vitest';
import { evaluateCertificateEligibility, isValidCertificateNumber, type CertificateEligibilityInput } from './certificates';
import { canAssignRole, hasAtLeast, homeRouteFor, isAdmin, isStaff } from './roles';

const complete: CertificateEligibilityInput = {
  enrollmentStatus: 'active',
  totalMonths: 3,
  monthsWithLessonsComplete: [1, 2, 3],
  monthsWithQuizzesPassed: [1, 2, 3],
  assessmentResults: { 1: 'pass', 2: 'pass', 3: 'pass' },
  finalExamPassed: true,
  finalExamRequired: true,
  paymentsComplete: true,
  finalApproval: true,
};

describe('certificate eligibility', () => {
  it('is eligible when everything is complete', () => {
    expect(evaluateCertificateEligibility(complete)).toEqual({ eligible: true, missing: [] });
  });
  it('lists every missing requirement', () => {
    const r = evaluateCertificateEligibility({ ...complete, monthsWithQuizzesPassed: [1, 2], assessmentResults: { 1: 'pass', 2: 'pass' }, finalExamPassed: false, paymentsComplete: false, finalApproval: false });
    expect(r.eligible).toBe(false);
    expect(r.missing).toEqual(['Month 3: quizzes not passed', 'Month 3: assessment not passed', 'Final examination not passed', 'Tuition and registration fee not fully confirmed', 'Final approval pending']);
  });
  it('validates certificate numbers', () => {
    expect(isValidCertificateNumber('MCSLI-2026-A7K3PQ')).toBe(true);
    expect(isValidCertificateNumber('MCSLI-2026-A7K3P0')).toBe(false); // 0 is ambiguous
    expect(isValidCertificateNumber('X-2026-A7K3PQ')).toBe(false);
  });
});

describe('roles', () => {
  it('classifies staff and admins', () => {
    expect(isStaff('TRAINER')).toBe(true);
    expect(isStaff('STUDENT')).toBe(false);
    expect(isAdmin('TRAINER')).toBe(false);
    expect(isAdmin('SUPER_ADMIN')).toBe(true);
    expect(hasAtLeast('ADMIN', 'TRAINER')).toBe(true);
    expect(hasAtLeast('TRAINER', 'ADMIN')).toBe(false);
  });
  it('routes users home by role', () => {
    expect(homeRouteFor('STUDENT')).toBe('/app');
    expect(homeRouteFor('TRAINER')).toBe('/trainer');
    expect(homeRouteFor('ADMIN')).toBe('/admin');
  });
  it('prevents privilege escalation when assigning roles', () => {
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(false);
    expect(canAssignRole('ADMIN', 'TRAINER')).toBe(true);
    expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
    expect(canAssignRole('TRAINER', 'STUDENT')).toBe(false);
  });
});
