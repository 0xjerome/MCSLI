import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CreditCard, ClipboardCheck, Unlock, Megaphone, FileText, Award, LifeBuoy, MessageSquare, ShieldCheck, type LucideIcon } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { listNotifications, markNotificationsRead } from '@/services/community';
import { PageHeader } from '@/app/layouts/Shell';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton, ErrorState } from '@/components/ui/Misc';
import { cn, relativeTime } from '@/lib/utils';
import type { NotificationType } from '@/domain/types';

const icons: Partial<Record<NotificationType, LucideIcon>> = {
  payment_confirmed: CreditCard,
  payment_rejected: CreditCard,
  identity_verified: ShieldCheck,
  identity_rejected: ShieldCheck,
  assessment_scheduled: ClipboardCheck,
  assessment_passed: ClipboardCheck,
  reassessment_required: ClipboardCheck,
  month_unlocked: Unlock,
  trainer_announcement: Megaphone,
  exam_available: FileText,
  exam_graded: FileText,
  certificate_issued: Award,
  support_response: LifeBuoy,
  discussion_reply: MessageSquare,
};

const tones: Partial<Record<NotificationType, string>> = {
  payment_rejected: 'text-danger-600 bg-danger-50',
  identity_rejected: 'text-danger-600 bg-danger-50',
  reassessment_required: 'text-warning-600 bg-warning-50',
  month_unlocked: 'text-success-600 bg-success-50',
  assessment_passed: 'text-success-600 bg-success-50',
  payment_confirmed: 'text-success-600 bg-success-50',
  certificate_issued: 'text-accent-600 bg-accent-50',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(50) });
  usePageMeta({ title: 'Notifications', noIndex: true });

  const markAll = async () => {
    await markNotificationsRead();
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['unread-count'] });
  };
  const markOne = async (id: string) => {
    await markNotificationsRead([id]);
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['unread-count'] });
  };

  const unread = (q.data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : 'You are all caught up.'} actions={unread > 0 ? <Button variant="outline" size="sm" onClick={markAll} leftIcon={<CheckCheck className="h-4 w-4" aria-hidden="true" />}>Mark all read</Button> : undefined} />
      {q.isLoading ? (
        <Skeleton lines={6} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications yet" description="Payment confirmations, assessment results, unlocked months and replies will appear here." />
      ) : (
        <ul className="divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
          {(q.data ?? []).map((n) => {
            const Icon = icons[n.type] ?? Bell;
            const tone = tones[n.type] ?? 'text-brand-600 bg-brand-50';
            const inner = (
              <>
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)} aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', n.read_at ? 'text-ink-800' : 'font-semibold text-ink-900')}>{n.title}</span>
                  {n.body && <span className="block text-sm text-ink-600">{n.body}</span>}
                  <span className="block text-xs text-ink-500">{relativeTime(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-500" aria-label="Unread" />}
              </>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link to={n.link} onClick={() => !n.read_at && markOne(n.id)} className={cn('flex gap-3 px-4 py-3 hover:bg-ink-50', !n.read_at && 'bg-brand-50/30')}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => !n.read_at && markOne(n.id)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-ink-50', !n.read_at && 'bg-brand-50/30')}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
