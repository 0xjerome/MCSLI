import { describe, expect, it } from 'vitest';
import { buildFeeSchedule, nextInstallmentDue, outstandingBalance, splitInstallments, type CourseFeeConfig } from './pricing';

const config: CourseFeeConfig = {
  currency: 'UGX',
  tuitionNational: 350_000,
  tuitionInternational: 400_000,
  registrationFee: 20_000,
  installmentsEnabled: true,
  installmentCount: 2,
  installmentDueBeforeMonth: { 2: 2 },
};

describe('pricing', () => {
  it('charges Ugandan students the national tuition plus registration fee', () => {
    const s = buildFeeSchedule(config, 'ugandan', 'full');
    expect(s.tuition).toBe(350_000);
    expect(s.registrationFee).toBe(20_000);
    expect(s.total).toBe(370_000);
    expect(s.installments).toEqual([{ number: 1, amount: 350_000, dueBeforeMonth: 1 }]);
  });

  it('charges non-Ugandan students the international tuition', () => {
    const s = buildFeeSchedule(config, 'international', 'full');
    expect(s.tuition).toBe(400_000);
    expect(s.total).toBe(420_000);
  });

  it('keeps the registration fee separate from tuition', () => {
    const s = buildFeeSchedule(config, 'ugandan', 'installments');
    expect(s.registrationFee + s.tuition).toBe(s.total);
    expect(s.installments.reduce((a, i) => a + i.amount, 0)).toBe(s.tuition);
  });

  it('splits tuition into two equal installments, second due before month 2', () => {
    const s = buildFeeSchedule(config, 'ugandan', 'installments');
    expect(s.installments).toEqual([
      { number: 1, amount: 175_000, dueBeforeMonth: 1 },
      { number: 2, amount: 175_000, dueBeforeMonth: 2 },
    ]);
    const intl = buildFeeSchedule(config, 'international', 'installments');
    expect(intl.installments.map((i) => i.amount)).toEqual([200_000, 200_000]);
  });

  it('uses admin-configured installment amounts when they sum to the tuition', () => {
    const s = buildFeeSchedule({ ...config, installmentAmounts: { national: [200_000, 150_000] } }, 'ugandan', 'installments');
    expect(s.installments.map((i) => i.amount)).toEqual([200_000, 150_000]);
  });

  it('ignores admin installment amounts that do not sum to the tuition', () => {
    const s = buildFeeSchedule({ ...config, installmentAmounts: { national: [100_000, 100_000] } }, 'ugandan', 'installments');
    expect(s.installments.map((i) => i.amount)).toEqual([175_000, 175_000]);
  });

  it('puts the rounding remainder on the last installment', () => {
    expect(splitInstallments(100_001, 2)).toEqual([50_000, 50_001]);
    expect(splitInstallments(100_000, 3)).toEqual([33_333, 33_333, 33_334]);
  });

  it('refuses the installment plan when disabled', () => {
    expect(() => buildFeeSchedule({ ...config, installmentsEnabled: false }, 'ugandan', 'installments')).toThrow();
  });

  it('computes outstanding balance and next installment', () => {
    const s = buildFeeSchedule(config, 'ugandan', 'installments');
    expect(outstandingBalance(s, 20_000, 175_000)).toEqual({ registration: 0, tuition: 175_000, total: 175_000 });
    expect(nextInstallmentDue(s, 0)?.number).toBe(1);
    expect(nextInstallmentDue(s, 175_000)?.number).toBe(2);
    expect(nextInstallmentDue(s, 350_000)).toBeNull();
  });
});
