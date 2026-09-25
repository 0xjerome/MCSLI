import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { listProfiles } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Pagination, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/types/database';
import type { UserRole } from '@/domain/types';

export default function AdminStudentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('STUDENT');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['profiles', role, search, page], queryFn: () => listProfiles({ role: role || undefined, search: search || undefined, page }) });
  usePageMeta({ title: 'Students', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const pageCount = Math.max(1, Math.ceil((q.data?.count ?? 0) / 25));

  return (
    <>
      <PageHeader eyebrow="People" title="Students & accounts" description="Every account on the platform. Open a student to manage identity, enrollment, payments and status." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input label={<span className="sr-only">Search</span>} placeholder="Search name, e-mail or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} leftAddon={<Search className="h-4 w-4" aria-hidden="true" />} />
        <Select label={<span className="sr-only">Role</span>} value={role} onChange={(e) => { setRole(e.target.value as UserRole | ''); setPage(1); }} options={[{ value: '', label: 'All roles' }, { value: 'STUDENT', label: 'Students' }, { value: 'TRAINER', label: 'Trainers' }, { value: 'ADMIN', label: 'Admins' }, { value: 'SUPER_ADMIN', label: 'Super admins' }]} />
      </div>
      <DataTable<Profile>
        caption="Accounts"
        rows={q.data?.rows}
        loading={q.isLoading}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/admin/students/${p.id}`)}
        empty={<EmptyState title="No accounts match" />}
        columns={[
          { key: 'name', header: 'Name', primary: true, cell: (p) => p.full_name },
          { key: 'email', header: 'E-mail', cell: (p) => p.email },
          { key: 'phone', header: 'Phone', cell: (p) => p.phone ?? '—', hideOnMobile: true },
          { key: 'nat', header: 'Classification', cell: (p) => (p.nationality === 'ugandan' ? 'Ugandan' : 'International') },
          { key: 'role', header: 'Role', cell: (p) => <Badge tone={p.role === 'STUDENT' ? 'neutral' : 'brand'} size="sm">{p.role}</Badge> },
          { key: 'status', header: 'Account', cell: (p) => (p.account_status === 'active' ? <Badge tone="success" size="sm">Active</Badge> : <Badge tone="danger" size="sm">Suspended</Badge>) },
          { key: 'joined', header: 'Joined', cell: (p) => formatDate(p.created_at), hideOnMobile: true },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} className="mt-4" />
    </>
  );
}
