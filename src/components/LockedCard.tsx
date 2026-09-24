import { Lock, CreditCard, ClipboardCheck, Ban } from 'lucide-react';
import type { LockReason } from '@/domain/types';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const iconFor = (code: LockReason['code']) => {
  switch (code) {
    case 'registration_fee_unconfirmed':
    case 'tuition_unconfirmed':
    case 'installment_unconfirmed':
      return <CreditCard className="h-5 w-5" aria-hidden="true" />;
    case 'previous_month_assessment_pending':
    case 'previous_month_assessment_not_passed':
    case 'previous_month_incomplete':
      return <ClipboardCheck className="h-5 w-5" aria-hidden="true" />;
    case 'enrollment_inactive':
      return <Ban className="h-5 w-5" aria-hidden="true" />;
    default:
      return <Lock className="h-5 w-5" aria-hidden="true" />;
  }
};

const actionFor = (code: LockReason['code']) => {
  switch (code) {
    case 'registration_fee_unconfirmed':
    case 'tuition_unconfirmed':
    case 'installment_unconfirmed':
      return { to: '/app/payments', label: 'Go to payments' };
    case 'previous_month_assessment_pending':
    case 'previous_month_assessment_not_passed':
      return { to: '/app/assessments', label: 'View assessments' };
    case 'enrollment_inactive':
      return { to: '/app/help', label: 'Contact support' };
    default:
      return null;
  }
};

/**
 * Explains exactly why content is locked. Never leaves the learner guessing.
 */
export function LockedCard({ title, reasons, className, compact }: { title: string; reasons: LockReason[]; className?: string; compact?: boolean }) {
  const primaryAction = reasons.map((r) => actionFor(r.code)).find(Boolean);
  return (
    <div className={cn('rounded-2xl border border-ink-200 bg-ink-50 text-ink-800', compact ? 'p-4' : 'p-5 sm:p-6', className)} role="region" aria-label={`${title} is locked`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink-500 shadow-card" aria-hidden="true">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-ink-900">{title} is locked</p>
          <p className="text-sm text-ink-600">Here's what needs to happen before it opens:</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {reasons.map((r, i) => (
          <li key={`${r.code}-${i}`} className="flex gap-3 rounded-xl bg-white p-3 text-sm shadow-card">
            <span className="mt-0.5 shrink-0 text-brand-600">{iconFor(r.code)}</span>
            <span>{r.message}</span>
          </li>
        ))}
      </ul>
      {primaryAction && (
        <ButtonLink to={primaryAction.to} variant="secondary" size="sm" className="mt-4">
          {primaryAction.label}
        </ButtonLink>
      )}
    </div>
  );
}
