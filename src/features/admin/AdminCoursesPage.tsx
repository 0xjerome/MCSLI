import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, BookOpen } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listAllCourses, saveCourse, saveMonth } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Checkbox } from '@/components/ui/Field';
import { EmptyState, ErrorState, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatUGX, slugify } from '@/lib/utils';
import type { Course } from '@/types/database';

export function CourseForm({ initial, onSaved, onCancel }: { initial?: Partial<Course>; onSaved: (id: string) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title')).trim();
    const duration = Math.max(1, Number(fd.get('duration_months')) || 1);
    const natAmounts = String(fd.get('inst_national')).split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
    const intlAmounts = String(fd.get('inst_international')).split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
    setBusy(true);
    setError('');
    try {
      const id = await saveCourse({
        id: initial?.id,
        title,
        slug: String(fd.get('slug')).trim() || slugify(title),
        short_description: String(fd.get('short_description')).trim() || null,
        description: String(fd.get('description')).trim() || null,
        duration_months: duration,
        currency: String(fd.get('currency')).trim() || 'UGX',
        tuition_national: Number(fd.get('tuition_national')) || 0,
        tuition_international: Number(fd.get('tuition_international')) || 0,
        registration_fee: Number(fd.get('registration_fee')) || 0,
        installments_enabled: fd.get('installments_enabled') === 'on',
        installment_count: Math.max(2, Number(fd.get('installment_count')) || 2),
        installment_amounts: natAmounts.length || intlAmounts.length ? { ...(natAmounts.length ? { national: natAmounts } : {}), ...(intlAmounts.length ? { international: intlAmounts } : {}) } : null,
        installment_due_before_month: { '2': Math.max(1, Number(fd.get('installment_2_due')) || 2) },
        quiz_passing_score: Math.min(100, Math.max(0, Number(fd.get('quiz_passing_score')) || 70)),
        requires_final_exam: fd.get('requires_final_exam') === 'on',
        certificate_title: String(fd.get('certificate_title')).trim() || 'Certificate of Completion',
        is_published: fd.get('is_published') === 'on',
        is_archived: fd.get('is_archived') === 'on',
      });
      if (!initial?.id) {
        for (let m = 1; m <= duration; m++) await saveMonth({ course_id: id, month_number: m, title: `Month ${m}`, requires_assessment: true, is_published: true });
      }
      onSaved(id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="title" label="Course title" required defaultValue={initial?.title ?? ''} data-autofocus />
        <Input name="slug" label="URL slug" optionalLabel defaultValue={initial?.slug ?? ''} hint="Leave empty to generate from the title." />
      </div>
      <Input name="short_description" label="Short description" optionalLabel defaultValue={initial?.short_description ?? ''} />
      <Textarea name="description" label="Full description" optionalLabel rows={3} defaultValue={initial?.description ?? ''} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name="duration_months" type="number" min={1} max={24} label="Duration (months)" required defaultValue={initial?.duration_months ?? 3} hint={initial?.id ? 'Add/remove months in the curriculum tab.' : 'Months are created automatically.'} />
        <Input name="currency" label="Currency" defaultValue={initial?.currency ?? 'UGX'} />
        <Input name="quiz_passing_score" type="number" min={0} max={100} label="Default quiz pass mark (%)" defaultValue={initial?.quiz_passing_score ?? 70} />
      </div>
      <fieldset className="rounded-xl border border-ink-200 p-4">
        <legend className="px-1 text-sm font-semibold">Fees</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input name="tuition_national" type="number" min={0} label="Tuition – Ugandan students" required defaultValue={initial?.tuition_national ?? 350000} />
          <Input name="tuition_international" type="number" min={0} label="Tuition – non-Ugandan students" required defaultValue={initial?.tuition_international ?? 400000} />
          <Input name="registration_fee" type="number" min={0} label="Registration fee (separate)" required defaultValue={initial?.registration_fee ?? 20000} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="pt-6">
            <Checkbox name="installments_enabled" label="Allow installments" defaultChecked={initial?.installments_enabled ?? true} />
          </div>
          <Input name="installment_count" type="number" min={2} max={12} label="Number of installments" defaultValue={initial?.installment_count ?? 2} />
          <Input name="installment_2_due" type="number" min={1} label="Installment 2 required before month" defaultValue={initial?.installment_due_before_month?.['2'] ?? 2} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input name="inst_national" label="Custom installment amounts – Ugandan" optionalLabel placeholder="e.g. 200000, 150000" defaultValue={initial?.installment_amounts?.national?.join(', ') ?? ''} hint="Comma-separated; must add up to tuition, otherwise equal split is used." />
          <Input name="inst_international" label="Custom installment amounts – non-Ugandan" optionalLabel placeholder="e.g. 250000, 150000" defaultValue={initial?.installment_amounts?.international?.join(', ') ?? ''} />
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="certificate_title" label="Certificate title" defaultValue={initial?.certificate_title ?? 'Certificate of Completion'} />
        <div className="space-y-2 pt-6">
          <Checkbox name="requires_final_exam" label="Final examination required for certificate" defaultChecked={initial?.requires_final_exam ?? true} />
          <Checkbox name="is_published" label="Published (visible to the public and open for enrollment)" defaultChecked={initial?.is_published ?? false} />
          <Checkbox name="is_archived" label="Archived" defaultChecked={initial?.is_archived ?? false} />
        </div>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save course
        </Button>
      </div>
    </form>
  );
}

export default function AdminCoursesPage() {
  const navigate = useNavigate();
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const [creating, setCreating] = useState(false);
  usePageMeta({ title: 'Courses', noIndex: true });
  if (courses.isError) return <ErrorState onRetry={() => courses.refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Curriculum" title="Courses" description="Create courses, set fees and installment rules, and build the month → module → lesson curriculum." actions={<Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>New course</Button>} />
      <DataTable<Course>
        caption="Courses"
        rows={courses.data}
        loading={courses.isLoading}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/admin/courses/${c.id}`)}
        empty={<EmptyState icon={<BookOpen className="h-6 w-6" />} title="No courses yet" action={<Button variant="outline" onClick={() => setCreating(true)}>Create the first course</Button>} />}
        columns={[
          { key: 'title', header: 'Course', primary: true, cell: (c) => c.title },
          { key: 'months', header: 'Months', cell: (c) => c.duration_months },
          { key: 'nat', header: 'Tuition (UG)', cell: (c) => formatUGX(Number(c.tuition_national), c.currency), align: 'right' },
          { key: 'intl', header: 'Tuition (intl)', cell: (c) => formatUGX(Number(c.tuition_international), c.currency), align: 'right' },
          { key: 'reg', header: 'Registration', cell: (c) => formatUGX(Number(c.registration_fee), c.currency), align: 'right', hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (c) => (c.is_archived ? <Badge size="sm">Archived</Badge> : c.is_published ? <Badge tone="success" size="sm">Published</Badge> : <Badge tone="warning" size="sm">Draft</Badge>) },
        ]}
      />
      <Dialog open={creating} onClose={() => setCreating(false)} title="New course" size="xl">
        <CourseForm onCancel={() => setCreating(false)} onSaved={(id) => navigate(`/admin/courses/${id}`)} />
      </Dialog>
    </>
  );
}
