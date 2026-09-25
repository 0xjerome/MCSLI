import { describe, expect, it } from 'vitest';
import { buildFeeSchedule, type CourseFeeConfig } from './pricing';
import { evaluateMonthAccess, highestUnlockedMonth, requiredTuitionBeforeMonth, type ProgressionInput } from './progression';

const config: CourseFeeConfig = {
  currency: 'UGX',
  tuitionNational: 350_000,
  tuitionInternational: 400_000,
  registrationFee: 20_000,
  installmentsEnabled: true,
  installmentCount: 2,
  installmentDueBeforeMonth: { 2: 2 },
};

const full = buildFeeSchedule(config, 'ugandan', 'full');
const inst = buildFeeSchedule(config, 'ugandan', 'installments');

const base = (over: Partial<ProgressionInput>): ProgressionInput => ({
  enrollmentStatus: 'active',
  schedule: full,
  confirmedRegistration: 20_000,
  confirmedTuition: 350_000,
  monthNumber: 1,
  assessmentResults: {},
  overrides: [],
  ...over,
});

const codes = (r: ReturnType<typeof evaluateMonthAccess>) => r.reasons.map((x) => x.code);

describe('course progression', () => {
  it('unlocks month 1 once registration and the first required payment are confirmed', () => {
    expect(evaluateMonthAccess(base({})).allowed).toBe(true);
    expect(evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 175_000 })).allowed).toBe(true);
  });

  it('locks month 1 until the registration fee is confirmed', () => {
    const r = evaluateMonthAccess(base({ confirmedRegistration: 0 }));
    expect(r.allowed).toBe(false);
    expect(codes(r)).toContain('registration_fee_unconfirmed');
  });

  it('locks month 1 until the first installment / full tuition is confirmed', () => {
    expect(codes(evaluateMonthAccess(base({ confirmedTuition: 0 })))).toContain('tuition_unconfirmed');
    expect(codes(evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 100_000 })))).toContain('tuition_unconfirmed');
  });

  it('keeps month 2 locked until the month 1 assessment is recorded as a pass', () => {
    const pending = evaluateMonthAccess(base({ monthNumber: 2 }));
    expect(pending.allowed).toBe(false);
    expect(codes(pending)).toEqual(['previous_month_assessment_pending']);

    const passed = evaluateMonthAccess(base({ monthNumber: 2, assessmentResults: { 1: 'pass' } }));
    expect(passed.allowed).toBe(true);
  });

  it('keeps month 2 locked after a NOT PASSED assessment regardless of payment', () => {
    const r = evaluateMonthAccess(base({ monthNumber: 2, assessmentResults: { 1: 'not_passed' } }));
    expect(r.allowed).toBe(false);
    expect(codes(r)).toEqual(['previous_month_assessment_not_passed']);
    expect(r.reasons[0]!.message).toMatch(/another attempt/i);
  });

  it('a full-tuition student who passed month 1 has no installment condition for month 2', () => {
    const r = evaluateMonthAccess(base({ monthNumber: 2, assessmentResults: { 1: 'pass' } }));
    expect(r.allowed).toBe(true);
  });

  it('an installment student needs BOTH the month 1 pass AND the confirmed second installment for month 2', () => {
    const passedButUnpaid = evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 175_000, monthNumber: 2, assessmentResults: { 1: 'pass' } }));
    expect(passedButUnpaid.allowed).toBe(false);
    expect(codes(passedButUnpaid)).toEqual(['installment_unconfirmed']);
    expect(passedButUnpaid.reasons[0]!.message).toMatch(/installment 2 must be confirmed before Month 2/);

    const paidButNotPassed = evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 350_000, monthNumber: 2 }));
    expect(paidButNotPassed.allowed).toBe(false);
    expect(codes(paidButNotPassed)).toEqual(['previous_month_assessment_pending']);

    const both = evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 350_000, monthNumber: 2, assessmentResults: { 1: 'pass' } }));
    expect(both.allowed).toBe(true);
  });

  it('reports both financial and academic reasons together when both fail', () => {
    const r = evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 175_000, monthNumber: 2, assessmentResults: { 1: 'not_passed' } }));
    expect(codes(r)).toEqual(['installment_unconfirmed', 'previous_month_assessment_not_passed']);
  });

  it('admin override bypasses the academic gate only, never the payment gate', () => {
    const academicOnly = evaluateMonthAccess(base({ monthNumber: 2, assessmentResults: { 1: 'not_passed' }, overrides: [2] }));
    expect(academicOnly.allowed).toBe(true);
    expect(academicOnly.overridden).toBe(true);

    const unpaid = evaluateMonthAccess(base({ schedule: inst, confirmedTuition: 175_000, monthNumber: 2, assessmentResults: { 1: 'not_passed' }, overrides: [2] }));
    expect(unpaid.allowed).toBe(false);
    expect(codes(unpaid)).toEqual(['installment_unconfirmed']);
  });

  it('locks everything when the enrollment is not active', () => {
    const r = evaluateMonthAccess(base({ enrollmentStatus: 'suspended' }));
    expect(r.allowed).toBe(false);
    expect(codes(r)).toContain('enrollment_inactive');
  });

  it('computes the highest unlocked month', () => {
    const input = { ...base({ schedule: inst, confirmedTuition: 175_000, assessmentResults: { 1: 'pass' as const } }) };
    expect(highestUnlockedMonth(input, 3)).toBe(1);
    expect(highestUnlockedMonth({ ...input, confirmedTuition: 350_000 }, 3)).toBe(2);
    expect(highestUnlockedMonth({ ...input, confirmedTuition: 350_000, assessmentResults: { 1: 'pass', 2: 'pass' } }, 3)).toBe(3);
  });

  it('required tuition before a month follows the installment schedule', () => {
    expect(requiredTuitionBeforeMonth(inst, 1)).toBe(175_000);
    expect(requiredTuitionBeforeMonth(inst, 2)).toBe(350_000);
    expect(requiredTuitionBeforeMonth(full, 1)).toBe(350_000);
  });

  describe('Month 2 unlock truth table (academic AND financial)', () => {
    const month2 = (over: Partial<ProgressionInput>) => evaluateMonthAccess(base({ monthNumber: 2, ...over }));
    it('FULL PAYMENT + FAILED ASSESSMENT = LOCKED', () => {
      const r = month2({ assessmentResults: { 1: 'not_passed' } });
      expect(r.allowed).toBe(false);
      expect(codes(r)).toEqual(['previous_month_assessment_not_passed']);
    });
    it('INSTALLMENT 2 CONFIRMED + FAILED ASSESSMENT = LOCKED', () => {
      const r = month2({ schedule: inst, confirmedTuition: 350_000, assessmentResults: { 1: 'not_passed' } });
      expect(codes(r)).toEqual(['previous_month_assessment_not_passed']);
    });
    it('PASSED ASSESSMENT + INSTALLMENT 2 NOT CONFIRMED = LOCKED', () => {
      const r = month2({ schedule: inst, confirmedTuition: 175_000, assessmentResults: { 1: 'pass' } });
      expect(codes(r)).toEqual(['installment_unconfirmed']);
    });
    it('PASSED ASSESSMENT + INSTALLMENT 2 CONFIRMED = UNLOCKED', () => {
      expect(month2({ schedule: inst, confirmedTuition: 350_000, assessmentResults: { 1: 'pass' } }).allowed).toBe(true);
    });
    it('PASSED ASSESSMENT + FULL PAYMENT = UNLOCKED', () => {
      expect(month2({ assessmentResults: { 1: 'pass' } }).allowed).toBe(true);
    });
    it('PASSED ASSESSMENT + FULL PAYMENT but Month 1 lessons/quizzes unfinished = LOCKED', () => {
      const r = month2({ assessmentResults: { 1: 'pass' }, incompleteMonths: [1] });
      expect(codes(r)).toEqual(['previous_month_incomplete']);
    });
    it('an admin override bypasses the academic conditions but never payment', () => {
      expect(month2({ assessmentResults: { 1: 'not_passed' }, incompleteMonths: [1], overrides: [2] }).allowed).toBe(true);
      expect(codes(month2({ schedule: inst, confirmedTuition: 175_000, overrides: [2] }))).toEqual(['installment_unconfirmed']);
    });
  });
});
