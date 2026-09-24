import type { AssessmentResult, EnrollmentStatus, LockReason, MonthAccess } from './types';
import type { FeeSchedule } from './pricing';

/**
 * Inputs needed to decide whether a month is accessible.
 * The SQL function `fn_month_access` implements exactly the same rules; the
 * TypeScript version powers instant UI explanations and unit tests.
 */
export interface ProgressionInput {
  enrollmentStatus: EnrollmentStatus;
  schedule: FeeSchedule;
  /** Sum of confirmed registration-fee payments. */
  confirmedRegistration: number;
  /** Sum of confirmed tuition payments (any installment). */
  confirmedTuition: number;
  /** Month number being requested (1-based). */
  monthNumber: number;
  /** Latest assessment result per month number (undefined = no completed attempt yet). */
  assessmentResults: Record<number, AssessmentResult | undefined>;
  /** Month numbers with an active admin override. */
  overrides: number[];
  /** Whether the month has published content. */
  monthPublished?: boolean;
}

/** Financial eligibility: how much confirmed tuition is required before `monthNumber` opens. */
export function requiredTuitionBeforeMonth(schedule: FeeSchedule, monthNumber: number): number {
  return schedule.installments.filter((i) => i.dueBeforeMonth <= monthNumber).reduce((a, i) => a + i.amount, 0);
}

export function financialGate(input: Pick<ProgressionInput, 'schedule' | 'confirmedRegistration' | 'confirmedTuition' | 'monthNumber'>): LockReason[] {
  const reasons: LockReason[] = [];
  const { schedule, confirmedRegistration, confirmedTuition, monthNumber } = input;
  if (confirmedRegistration < schedule.registrationFee) {
    reasons.push({ code: 'registration_fee_unconfirmed', message: 'Your registration fee must be confirmed before you can start the course.' });
  }
  const required = requiredTuitionBeforeMonth(schedule, monthNumber);
  if (confirmedTuition < required) {
    // Find the first installment not yet covered.
    let cumulative = 0;
    let missing = schedule.installments[0]!;
    for (const inst of schedule.installments) {
      cumulative += inst.amount;
      if (confirmedTuition < cumulative && inst.dueBeforeMonth <= monthNumber) {
        missing = inst;
        break;
      }
    }
    if (schedule.plan === 'full' || missing.number === 1) {
      reasons.push({
        code: 'tuition_unconfirmed',
        message: schedule.plan === 'full' ? 'Your tuition payment must be confirmed before this month becomes available.' : 'Your first tuition installment must be confirmed before you can start the course.',
        meta: { installment: missing.number },
      });
    } else {
      reasons.push({
        code: 'installment_unconfirmed',
        message: `Your tuition installment ${missing.number} must be confirmed before Month ${monthNumber} becomes available.`,
        meta: { installment: missing.number, month: monthNumber },
      });
    }
  }
  return reasons;
}

export function academicGate(input: Pick<ProgressionInput, 'monthNumber' | 'assessmentResults'>): LockReason[] {
  const { monthNumber, assessmentResults } = input;
  if (monthNumber <= 1) return [];
  const prev = monthNumber - 1;
  const result = assessmentResults[prev];
  if (result === 'pass') return [];
  if (result === 'not_passed') {
    return [
      {
        code: 'previous_month_assessment_not_passed',
        message: `Your Month ${prev} assessment requires another attempt. Review the material and your trainer will reassess you.`,
        meta: { month: prev },
      },
    ];
  }
  return [
    {
      code: 'previous_month_assessment_pending',
      message: `Complete your Month ${prev} assessment to continue. Month ${monthNumber} unlocks after your trainer records a pass.`,
      meta: { month: prev },
    },
  ];
}

/**
 * THE core business rule: a month is accessible only when the enrollment is
 * active AND the financial gate AND the academic gate are satisfied. An admin
 * override bypasses the academic gate only (it never waives payment).
 */
export function evaluateMonthAccess(input: ProgressionInput): MonthAccess {
  const reasons: LockReason[] = [];
  if (input.monthPublished === false) {
    reasons.push({ code: 'month_not_published', message: 'This month is not yet available. MCSLI will publish it soon.' });
  }
  if (input.enrollmentStatus !== 'active' && input.enrollmentStatus !== 'completed') {
    reasons.push({ code: 'enrollment_inactive', message: 'Your enrollment is not active. Contact MCSLI support if you think this is a mistake.' });
  }
  reasons.push(...financialGate(input));
  const overridden = input.overrides.includes(input.monthNumber);
  if (!overridden) reasons.push(...academicGate(input));
  return { allowed: reasons.length === 0, reasons, overridden: overridden && reasons.length === 0 };
}

/** Highest month number that is currently accessible (0 if none). */
export function highestUnlockedMonth(input: Omit<ProgressionInput, 'monthNumber'>, totalMonths: number): number {
  let highest = 0;
  for (let m = 1; m <= totalMonths; m++) {
    if (evaluateMonthAccess({ ...input, monthNumber: m }).allowed) highest = m;
    else break;
  }
  return highest;
}
