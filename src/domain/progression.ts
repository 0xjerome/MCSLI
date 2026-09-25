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
  /**
   * Month numbers whose required lessons are not all completed or whose required quizzes are not
   * all passed. Month N+1 stays locked until Month N is complete (and its assessment passed).
   */
  incompleteMonths?: number[];
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

export function academicGate(input: Pick<ProgressionInput, 'monthNumber' | 'assessmentResults' | 'incompleteMonths'>): LockReason[] {
  const { monthNumber, assessmentResults, incompleteMonths = [] } = input;
  if (monthNumber <= 1) return [];
  const prev = monthNumber - 1;
  const reasons: LockReason[] = [];
  if (incompleteMonths.includes(prev)) {
    reasons.push({
      code: 'previous_month_incomplete',
      message: `Finish the required lessons and quizzes of Month ${prev} to continue.`,
      meta: { month: prev },
    });
  }
  const result = assessmentResults[prev];
  if (result === 'pass') return reasons;
  if (result === 'not_passed') {
    return [
      ...reasons,
      {
        code: 'previous_month_assessment_not_passed',
        message: `Your Month ${prev} assessment requires another attempt. Review the material and your trainer will reassess you.`,
        meta: { month: prev },
      },
    ];
  }
  return [
    ...reasons,
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
