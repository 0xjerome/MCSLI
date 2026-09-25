import { CheckCircle2, Clock, Lock, XCircle, AlertCircle, ShieldCheck, FileQuestion, Ban, CircleDot, Award } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { AssessmentResult, CertificateStatus, EnrollmentStatus, ExamStatus, IdentityStatus, PaymentStatus, TicketStatus } from '@/domain/types';

type Spec = { label: string; tone: BadgeTone; icon: React.ReactNode };
const icon = (I: React.ComponentType<{ className?: string }>) => <I className="h-3.5 w-3.5" aria-hidden="true" />;

const payment: Record<PaymentStatus, Spec> = {
  pending: { label: 'Pending', tone: 'neutral', icon: icon(Clock) },
  under_review: { label: 'Under review', tone: 'info', icon: icon(CircleDot) },
  confirmed: { label: 'Confirmed', tone: 'success', icon: icon(CheckCircle2) },
  rejected: { label: 'Rejected', tone: 'danger', icon: icon(XCircle) },
};
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = payment[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

const identity: Record<IdentityStatus, Spec> = {
  not_submitted: { label: 'Not submitted', tone: 'neutral', icon: icon(FileQuestion) },
  pending: { label: 'Pending verification', tone: 'warning', icon: icon(Clock) },
  verified: { label: 'Verified', tone: 'success', icon: icon(ShieldCheck) },
  rejected: { label: 'Resubmission required', tone: 'danger', icon: icon(AlertCircle) },
};
export function IdentityStatusBadge({ status }: { status: IdentityStatus }) {
  const s = identity[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

const enrollment: Record<EnrollmentStatus, Spec> = {
  pending_payment: { label: 'Awaiting payment', tone: 'warning', icon: icon(Clock) },
  active: { label: 'Active', tone: 'success', icon: icon(CheckCircle2) },
  completed: { label: 'Completed', tone: 'brand', icon: icon(Award) },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', icon: icon(Ban) },
  suspended: { label: 'Suspended', tone: 'danger', icon: icon(Lock) },
};
export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const s = enrollment[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

export function AssessmentResultBadge({ result, size }: { result: AssessmentResult | null | undefined; size?: 'sm' | 'md' }) {
  if (!result) return <Badge tone="neutral" icon={icon(Clock)} size={size}>Awaiting assessment</Badge>;
  return result === 'pass' ? (
    <Badge tone="success" icon={icon(CheckCircle2)} size={size}>Passed</Badge>
  ) : (
    <Badge tone="danger" icon={icon(XCircle)} size={size}>Not passed – reassessment required</Badge>
  );
}

const exam: Record<ExamStatus, Spec> = {
  draft: { label: 'Draft', tone: 'neutral', icon: icon(CircleDot) },
  scheduled: { label: 'Scheduled', tone: 'info', icon: icon(Clock) },
  open: { label: 'Open now', tone: 'success', icon: icon(CheckCircle2) },
  closed: { label: 'Closed', tone: 'neutral', icon: icon(Lock) },
  results_released: { label: 'Results released', tone: 'brand', icon: icon(Award) },
};
export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const s = exam[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

const ticket: Record<TicketStatus, Spec> = {
  open: { label: 'Open', tone: 'warning', icon: icon(CircleDot) },
  in_progress: { label: 'In progress', tone: 'info', icon: icon(Clock) },
  resolved: { label: 'Resolved', tone: 'success', icon: icon(CheckCircle2) },
};
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const s = ticket[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  return status === 'issued' ? <Badge tone="success" icon={icon(Award)}>Valid</Badge> : <Badge tone="danger" icon={icon(Ban)}>Revoked</Badge>;
}

export function LockBadge({ locked }: { locked: boolean }) {
  return locked ? <Badge tone="neutral" icon={icon(Lock)}>Locked</Badge> : <Badge tone="success" icon={icon(CheckCircle2)}>Unlocked</Badge>;
}
