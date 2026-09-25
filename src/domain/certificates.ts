import type { AssessmentResult, EnrollmentStatus, PaymentStatus } from './types';

export interface CertificateEligibilityInput {
  enrollmentStatus: EnrollmentStatus;
  totalMonths: number;
  /** Month numbers whose required lessons are all completed. */
  monthsWithLessonsComplete: number[];
  /** Month numbers whose required quizzes are all passed. */
  monthsWithQuizzesPassed: number[];
  assessmentResults: Record<number, AssessmentResult | undefined>;
  finalExamPassed: boolean | null;
  finalExamRequired: boolean;
  /** Registration + tuition fully confirmed. */
  paymentsComplete: boolean;
  /** Final approval by trainer/admin. */
  finalApproval: boolean;
}

export interface CertificateEligibility {
  eligible: boolean;
  missing: string[];
}

export function evaluateCertificateEligibility(i: CertificateEligibilityInput): CertificateEligibility {
  const missing: string[] = [];
  if (!['active', 'completed'].includes(i.enrollmentStatus)) missing.push('Enrollment is not active');
  for (let m = 1; m <= i.totalMonths; m++) {
    if (!i.monthsWithLessonsComplete.includes(m)) missing.push(`Month ${m}: lessons not completed`);
    if (!i.monthsWithQuizzesPassed.includes(m)) missing.push(`Month ${m}: quizzes not passed`);
    if (i.assessmentResults[m] !== 'pass') missing.push(`Month ${m}: assessment not passed`);
  }
  if (i.finalExamRequired && i.finalExamPassed !== true) missing.push('Final examination not passed');
  if (!i.paymentsComplete) missing.push('Tuition and registration fee not fully confirmed');
  if (!i.finalApproval) missing.push('Final approval pending');
  return { eligible: missing.length === 0, missing };
}

/** Certificate number format: MCSLI-YYYY-XXXXXX (uppercase base-32-ish, no ambiguous chars). */
export function isValidCertificateNumber(n: string): boolean {
  return /^MCSLI-\d{4}-[A-HJ-NP-Z2-9]{6}$/.test(n);
}

export function paymentIsCounted(status: PaymentStatus): boolean {
  return status === 'confirmed';
}
