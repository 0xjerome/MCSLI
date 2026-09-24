import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { isStaff } from '@/domain/roles';
import { getTicket, listTicketMessages, replyToTicket, setTicketStatus } from '@/services/community';
import { Card } from '@/components/ui/Card';
import { Textarea, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Skeleton, ErrorState, Avatar, Alert } from '@/components/ui/Misc';
import { TicketStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDateTime } from '@/lib/utils';
import type { TicketStatus } from '@/domain/types';

export default function TicketPage() {
  const { ticketId = '' } = useParams();
  const { user, role } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const staff = isStaff(role);
  const ticket = useQuery({ queryKey: ['ticket', ticketId], queryFn: () => getTicket(ticketId) });
  const messages = useQuery({ queryKey: ['ticket-messages', ticketId], queryFn: () => listTicketMessages(ticketId), enabled: Boolean(ticket.data) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: ticket.data?.subject ?? 'Support request', noIndex: true });
  const backTo = location.pathname.startsWith('/admin') ? '/admin/support' : '/app/help';

  if (ticket.isLoading) return <Skeleton className="h-96" />;
  if (ticket.isError) return <ErrorState onRetry={() => ticket.refetch()} />;
  if (!ticket.data) return <ErrorState title="Request not found" />;
  const t = ticket.data;

  const reply = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await replyToTicket({ ticketId: t.id, authorId: user.id, isStaff: staff, body: String(fd.get('body')) });
      await qc.invalidateQueries({ queryKey: ['ticket-messages', t.id] });
      await qc.invalidateQueries({ queryKey: ['ticket', t.id] });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (s: TicketStatus) => {
    try {
      await setTicketStatus(t.id, s);
      await qc.invalidateQueries({ queryKey: ['ticket', t.id] });
      await qc.invalidateQueries({ queryKey: ['my-tickets'] });
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Status updated');
    } catch (err) {
      toast.error('Could not update', friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display-sm">{t.subject}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {staff && t.user ? `${t.user.full_name} · ` : ''}
            {t.category} · opened {formatDateTime(t.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={t.status} />
          {staff ? (
            <Select label={<span className="sr-only">Change status</span>} value={t.status} onChange={(e) => changeStatus(e.target.value as TicketStatus)} options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }]} wrapperClassName="w-40" />
          ) : (
            t.status !== 'resolved' && (
              <Button variant="outline" size="sm" onClick={() => changeStatus('resolved')}>
                Mark resolved
              </Button>
            )
          )}
        </div>
      </div>

      <ol className="mt-6 space-y-3" aria-label="Conversation">
        {messages.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          (messages.data ?? []).map((m) => (
            <li key={m.id} className={cn('flex gap-3', m.is_staff && 'flex-row-reverse')}>
              <Avatar name={m.author?.full_name} size="sm" />
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.is_staff ? 'bg-brand-600 text-white' : 'bg-white text-ink-800 shadow-card')}>
                <p className={cn('mb-1 text-xs', m.is_staff ? 'text-brand-100' : 'text-ink-500')}>
                  {m.is_staff ? `MCSLI · ${m.author?.full_name ?? 'Staff'}` : m.author?.full_name ?? 'You'} · {formatDateTime(m.created_at)}
                </p>
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
            </li>
          ))
        )}
      </ol>

      {t.status === 'resolved' && !staff ? (
        <Alert tone="success" className="mt-6" title="Resolved">
          This request is resolved. Open a new request if you need more help.
        </Alert>
      ) : (
        <Card className="mt-6">
          <form onSubmit={reply} className="space-y-3">
            <Textarea name="body" label={staff ? 'Reply to the student' : 'Reply'} required minLength={1} rows={4} />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" loading={busy}>
              Send reply
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
