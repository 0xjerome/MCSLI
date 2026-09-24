import type { NationalityClass, PaymentPlanType } from './types';

/**
 * Course fee configuration. Values come from the `courses` table (admin editable);
 * nothing here is hard-coded to a specific price.
 */
export interface CourseFeeConfig {
  currency: string;
  tuitionNational: number;
  tuitionInternational: number;
  registrationFee: number;
  installmentsEnabled: boolean;
  /** Number of tuition installments when the installment plan is chosen (>= 2). */
  installmentCount: number;
  /**
   * Optional explicit installment amounts (admin editable). When omitted the
   * tuition is split into equal parts with any rounding remainder on the last one.
   */
  installmentAmounts?: { national?: number[]; international?: number[] };
  /** Month number that requires installment N (1-based) to be confirmed before it unlocks. Index = installment number. */
  installmentDueBeforeMonth?: Record<number, number>;
}

export interface FeeSchedule {
  currency: string;
  nationality: NationalityClass;
  plan: PaymentPlanType;
  registrationFee: number;
  tuition: number;
  /** Ordered tuition installments (1 entry for the full plan). */
  installments: { number: number; amount: number; dueBeforeMonth: number }[];
  total: number;
}

export function tuitionFor(config: CourseFeeConfig, nationality: NationalityClass): number {
  return nationality === 'ugandan' ? config.tuitionNational : config.tuitionInternational;
}

/**
 * Splits tuition into `count` installments. Uses explicit admin amounts when
 * they are present and sum to the tuition; otherwise equal parts, remainder on
 * the final installment so the sum is exact.
 */
export function splitInstallments(tuition: number, count: number, explicit?: number[]): number[] {
  if (count < 1 || !Number.isFinite(count)) throw new Error('installment count must be >= 1');
  if (explicit && explicit.length === count && explicit.every((n) => n > 0)) {
    const sum = explicit.reduce((a, b) => a + b, 0);
    if (sum === tuition) return [...explicit];
  }
  const base = Math.floor(tuition / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = tuition - base * (count - 1);
  return parts;
}

export function buildFeeSchedule(config: CourseFeeConfig, nationality: NationalityClass, plan: PaymentPlanType): FeeSchedule {
  const tuition = tuitionFor(config, nationality);
  if (plan === 'installments' && !config.installmentsEnabled) {
    throw new Error('Installment plan is not enabled for this course');
  }
  const count = plan === 'installments' ? Math.max(2, config.installmentCount) : 1;
  const explicit = nationality === 'ugandan' ? config.installmentAmounts?.national : config.installmentAmounts?.international;
  const amounts = splitInstallments(tuition, count, plan === 'installments' ? explicit : undefined);
  const installments = amounts.map((amount, i) => ({
    number: i + 1,
    amount,
    dueBeforeMonth: i === 0 ? 1 : config.installmentDueBeforeMonth?.[i + 1] ?? i + 1,
  }));
  return {
    currency: config.currency,
    nationality,
    plan,
    registrationFee: config.registrationFee,
    tuition,
    installments,
    total: config.registrationFee + tuition,
  };
}

/**
 * Given confirmed payments, compute what is outstanding.
 * `confirmedRegistration` and `confirmedTuition` are sums of confirmed payments per purpose.
 */
export function outstandingBalance(schedule: FeeSchedule, confirmedRegistration: number, confirmedTuition: number) {
  return {
    registration: Math.max(0, schedule.registrationFee - confirmedRegistration),
    tuition: Math.max(0, schedule.tuition - confirmedTuition),
    total: Math.max(0, schedule.total - confirmedRegistration - confirmedTuition),
  };
}

/** Which installment number is the next one still not fully covered by confirmed tuition. */
export function nextInstallmentDue(schedule: FeeSchedule, confirmedTuition: number): FeeSchedule['installments'][number] | null {
  let cumulative = 0;
  for (const inst of schedule.installments) {
    cumulative += inst.amount;
    if (confirmedTuition < cumulative) return inst;
  }
  return null;
}
