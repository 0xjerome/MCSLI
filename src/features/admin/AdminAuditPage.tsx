import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { listAudit } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Pagination, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/types/database';

export default function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['audit', action, page], queryFn: () => listAudit({ action: action || undefined, page }) });
  usePageMeta({ title: 'Audit log', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const pageCount = Math.max(1, Math.ceil((q.data?.count ?? 0) / 50));

  return (
    <>
      <PageHeader eyebrow="Security" title="Audit log" description="Every sensitive action: payment decisions, identity reveals and reviews, assessment results, month overrides, certificate issue/revoke, role and status changes, content edits." />
      <div className="mb-4 max-w-sm">
        <Input label={<span className="sr-only">Filter by action</span>} placeholder="Filter by action prefix, e.g. payment., month., identity." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} leftAddon={<Search className="h-4 w-4" aria-hidden="true" />} />
      </div>
      <DataTable<AuditLog>
        caption="Audit log"
        rows={q.data?.rows}
        loading={q.isLoading}
        rowKey={(a) => String(a.id)}
        empty={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit entries" />}
        columns={[
          { key: 'when', header: 'When', cell: (a) => <span className="whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</span> },
          { key: 'action', header: 'Action', primary: true, cell: (a) => <Badge size="sm" tone={a.action.includes('override') || a.action.includes('reveal') || a.action.includes('revoked') ? 'warning' : 'neutral'}>{a.action}</Badge> },
          { key: 'actor', header: 'By', cell: (a) => `${a.actor?.full_name ?? 'system'}${a.actor_role ? ` (${a.actor_role})` : ''}` },
          { key: 'target', header: 'Target user', cell: (a) => a.target?.full_name ?? '—' },
          { key: 'entity', header: 'Entity', cell: (a) => <span className="text-xs text-ink-500">{a.entity_type} {a.entity_id ? `· ${a.entity_id.slice(0, 8)}…` : ''}</span>, hideOnMobile: true },
          { key: 'meta', header: 'Details', cell: (a) => <span className="block max-w-xs truncate text-xs text-ink-600" title={JSON.stringify(a.metadata)}>{Object.entries(a.metadata ?? {}).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ') || '—'}</span> },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} className="mt-4" />
    </>
  );
}
