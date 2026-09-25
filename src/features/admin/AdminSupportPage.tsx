import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LifeBuoy, Mail } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listTickets } from '@/services/community';
import { listContactMessages, setContactMessageStatus, listReports, dismissReport } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Misc';
import { TicketStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { SupportTicket, ContactMessage } from '@/types/database';
import type { TicketStatus } from '@/domain/types';

export default function AdminSupportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'tickets' | 'messages' | 'reports'>('tickets');
  const [status, setStatus] = useState<TicketStatus | ''>('open');
  const tickets = useQuery({ queryKey: ['tickets', status], queryFn: () => listTickets({ status: status || undefined }) });
  const messages = useQuery({ queryKey: ['contact-messages'], queryFn: () => listContactMessages() });
  const reports = useQuery({ queryKey: ['reports'], queryFn: listReports });
  usePageMeta({ title: 'Support', noIndex: true });
  if (tickets.isError) return <ErrorState onRetry={() => tickets.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Support" title="Support & inbox" description="Student support requests, website contact messages and discussion reports." />
      <Tabs aria-label="Support sections" value={tab} onChange={setTab} className="mb-4" tabs={[{ id: 'tickets', label: 'Support tickets', count: tickets.data?.length }, { id: 'messages', label: 'Website messages', count: (messages.data ?? []).filter((m) => m.status === 'new').length }, { id: 'reports', label: 'Reports', count: reports.data?.length }]} />
      <TabPanel id="tickets" value={tab}>
        <div className="mb-3 flex gap-2">
          {(['open', 'in_progress', 'resolved', ''] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setStatus(s)}>
              {s === '' ? 'All' : s.replace('_', ' ')}
            </Button>
          ))}
        </div>
        <DataTable<SupportTicket>
          caption="Support tickets"
          rows={tickets.data}
          loading={tickets.isLoading}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate(`/admin/support/${t.id}`)}
          empty={<EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No tickets" />}
          columns={[
            { key: 'subject', header: 'Subject', primary: true, cell: (t) => t.subject },
            { key: 'student', header: 'Student', cell: (t) => t.user?.full_name ?? '—' },
            { key: 'cat', header: 'Category', cell: (t) => t.category },
            { key: 'status', header: 'Status', cell: (t) => <TicketStatusBadge status={t.status} /> },
            { key: 'updated', header: 'Updated', cell: (t) => relativeTime(t.updated_at) },
          ]}
        />
      </TabPanel>
      <TabPanel id="messages" value={tab}>
        {messages.isLoading ? (
          <Skeleton lines={4} />
        ) : (messages.data ?? []).length === 0 ? (
          <EmptyState icon={<Mail className="h-6 w-6" />} title="No website messages" />
        ) : (
          <ul className="space-y-3">
            {(messages.data ?? []).map((m: ContactMessage) => (
              <li key={m.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {m.subject ?? '(no subject)'} <Badge size="sm" tone={m.status === 'new' ? 'accent' : 'neutral'}>{m.status}</Badge> <Badge size="sm">{m.kind}</Badge>
                    </p>
                    <p className="text-xs text-ink-500">
                      {m.full_name} · <a className="text-brand-700 hover:underline" href={`mailto:${m.email}`}>{m.email}</a>
                      {m.phone ? ` · ${m.phone}` : ''} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {m.status === 'new' && (
                      <Button size="sm" variant="outline" onClick={async () => { try { await setContactMessageStatus(m.id, 'read'); await messages.refetch(); } catch (err) { toast.error('Failed', friendlyError(err)); } }}>
                        Mark read
                      </Button>
                    )}
                    {m.status !== 'archived' && (
                      <Button size="sm" variant="ghost" onClick={async () => { try { await setContactMessageStatus(m.id, 'archived'); await messages.refetch(); } catch (err) { toast.error('Failed', friendlyError(err)); } }}>
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
      <TabPanel id="reports" value={tab}>
        {reports.isLoading ? (
          <Skeleton lines={3} />
        ) : (reports.data ?? []).length === 0 ? (
          <EmptyState title="No open reports" />
        ) : (
          <ul className="space-y-3">
            {(reports.data ?? []).map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  <span className="font-medium text-ink-900">{r.reporter?.full_name ?? 'Member'}</span> reported a {r.post_id ? 'reply' : 'thread'}: “{r.reason}” · {relativeTime(r.created_at)}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/discussions/${r.thread_id ?? ''}`)} disabled={!r.thread_id}>
                    Open thread
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { try { await dismissReport(r.id); await reports.refetch(); } catch (err) { toast.error('Failed', friendlyError(err)); } }}>
                    Dismiss
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
    </>
  );
}
