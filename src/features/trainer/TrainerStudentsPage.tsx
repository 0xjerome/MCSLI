import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { listEnrollments, listAllCourses } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { EnrollmentStatusBadge } from '@/components/StatusBadges';
import { ErrorState, EmptyState } from '@/components/ui/Misc';
import { formatDate } from '@/lib/utils';
import type { EnrollmentStatus } from '@/domain/types';
import type { EnrollmentRow } from '@/services/staff';

/** Students list for trainers (assigned courses only, enforced by RLS) and admins (all). */
export default function TrainerStudentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/admin') ? '/admin/enrollments' : '/trainer/students';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EnrollmentStatus | ''>('active');
  const [courseId, setCourseId] = useState('');
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const q = useQuery({ queryKey: ['enrollments', status, courseId, search], queryFn: () => listEnrollments({ status: status || undefined, courseId: courseId || undefined, search: search || undefined }) });
  usePageMeta({ title: 'Students', noIndex: true });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Students" title={base.startsWith('/admin') ? 'Enrollments' : 'My students'} description="Learners enrolled in the courses assigned to you." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input label={<span className="sr-only">Search</span>} placeholder="Search by name or e-mail" value={search} onChange={(e) => setSearch(e.target.value)} leftAddon={<Search className="h-4 w-4" aria-hidden="true" />} />
        <Select label={<span className="sr-only">Status</span>} value={status} onChange={(e) => setStatus(e.target.value as EnrollmentStatus | '')} options={[{ value: '', label: 'All statuses' }, { value: 'pending_payment', label: 'Awaiting payment' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'suspended', label: 'Suspended' }, { value: 'withdrawn', label: 'Withdrawn' }]} />
        <Select label={<span className="sr-only">Course</span>} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={[{ value: '', label: 'All courses' }, ...(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
      </div>
      <DataTable<EnrollmentRow>
        caption="Students"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`${base}/${r.id}`)}
        empty={<EmptyState title="No students match" description="Try a different filter." />}
        columns={[
          { key: 'name', header: 'Student', primary: true, cell: (r) => r.student?.full_name ?? '—' },
          { key: 'course', header: 'Course', cell: (r) => r.course?.title },
          { key: 'cohort', header: 'Cohort', cell: (r) => r.cohort?.name ?? '—', hideOnMobile: true },
          { key: 'plan', header: 'Plan', cell: (r) => (r.plan_type === 'full' ? 'Full' : 'Installments') },
          { key: 'status', header: 'Status', cell: (r) => <EnrollmentStatusBadge status={r.status} /> },
          { key: 'since', header: 'Enrolled', cell: (r) => formatDate(r.created_at), hideOnMobile: true },
        ]}
      />
    </>
  );
}
