/**
 * Domain types shared by the UI, services and pure business rules.
 * The Postgres enums in supabase/migrations/0001_types.sql are the source of truth;
 * keep these unions in sync.
 */

export const USER_ROLES = ['STUDENT', 'TRAINER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type AccountStatus = 'active' | 'suspended';
export type NationalityClass = 'ugandan' | 'international';

export type IdentityStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type IdentityDocType = 'national_id' | 'passport' | 'other';

export type EnrollmentStatus = 'pending_payment' | 'active' | 'completed' | 'withdrawn' | 'suspended';
export type PaymentPlanType = 'full' | 'installments';
export type PaymentPurpose = 'registration' | 'tuition';
export type PaymentMethodType = 'bank' | 'mtn' | 'airtel';
export type PaymentStatus = 'pending' | 'under_review' | 'confirmed' | 'rejected';

export type AssessmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type AssessmentResult = 'pass' | 'not_passed';

export type ExamStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'results_released';
export type ExamAttemptStatus = 'in_progress' | 'submitted' | 'graded';
export type QuestionType = 'multiple_choice' | 'video_multiple_choice' | 'matching' | 'practical';

export type CertificateStatus = 'issued' | 'revoked';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketCategory = 'payment' | 'course' | 'technical' | 'identity' | 'other';

export type NotificationType =
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'identity_verified'
  | 'identity_rejected'
  | 'assessment_scheduled'
  | 'assessment_passed'
  | 'reassessment_required'
  | 'month_unlocked'
  | 'trainer_announcement'
  | 'exam_available'
  | 'exam_graded'
  | 'certificate_issued'
  | 'support_response'
  | 'discussion_reply'
  | 'system';

/** A single reason a month is locked. Rendered by <LockedCard/>. */
export type LockReasonCode =
  | 'enrollment_inactive'
  | 'registration_fee_unconfirmed'
  | 'tuition_unconfirmed'
  | 'installment_unconfirmed'
  | 'previous_month_assessment_pending'
  | 'previous_month_assessment_not_passed'
  | 'previous_month_incomplete'
  | 'month_not_published';

export interface LockReason {
  code: LockReasonCode;
  message: string;
  /** Extra data such as the installment number or previous month number. */
  meta?: Record<string, string | number | boolean | null>;
}

export interface MonthAccess {
  allowed: boolean;
  reasons: LockReason[];
  /** True when access was granted through an admin override. */
  overridden?: boolean;
}
