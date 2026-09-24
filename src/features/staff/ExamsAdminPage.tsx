import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listExamsStaff, listAllCourses, listMonths, saveExam } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Field';
import { EmptyState, ErrorState, Alert } from '@/components/ui/Misc';
import { ExamStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { Exam } from '@/types/database';

type Row = Exam & { course: { title: string } };

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function ExamForm({ initial, courses, onSaved, onCancel }: { initial?: Partial<Exam>; courses: { id: string; title: string }[]; onSaved: (id: string) => void; onCancel: () => void }) {
  const [courseId, setCourseId] = useState(initial?.course_id ?? courses[0]?.id ?? '');
  const months = useQuery({ queryKey: ['months', courseId], queryFn: () => listMonths(courseId), enabled: Boolean(courseId) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const opens = String(fd.get('opens_at'));
      const closes = String(fd.get('closes_at'));
      const id = await saveExam({
        id: initial?.id,
        course_id: courseId,
        month_id: String(fd.get('month_id')) || null,
        title: String(fd.get('title')).trim(),
        instructions: String(fd.get('instructions')).trim() || null,
        is_final: fd.get('is_final') === 'on',
        opens_at: opens ? new Date(opens).toISOString() : null,
        closes_at: closes ? new Date(closes).toISOString() : null,
        time_limit_minutes: Number(fd.get('time_limit_minutes')) || null,
        max_attempts: Math.max(1, Number(fd.get('max_attempts')) || 1),
        randomize_questions: fd.get('randomize') === 'on',
        passing_score: Math.min(100, Math.max(0, Number(fd.get('passing_score')) || 70)),
        status: String(fd.get('status')) as Exam['status'],
      });
      onSaved(id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input name="title" label="Title" required defaultValue={initial?.title ?? ''} data-autofocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courses.map((c) => ({ value: c.id, label: c.title }))} required />
        <Select name="month_id" label="Restricted to month" optionalLabel placeholder="Whole course" defaultValue={initial?.month_id ?? ''} options={(months.data ?? []).map((m) => ({ value: m.id, label: `Month ${m.month_number} – ${m.title}` }))} />
      </div>
      <Textarea name="instructions" label="Instructions" optionalLabel rows={3} defaultValue={initial?.instructions ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="opens_at" type="datetime-local" label="Opens" optionalLabel defaultValue={toLocal(initial?.opens_at ?? null)} />
        <Input name="closes_at" type="datetime-local" label="Closes" optionalLabel defaultValue={toLocal(initial?.closes_at ?? null)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name="time_limit_minutes" type="number" min={1} label="Time limit (minutes)" optionalLabel defaultValue={initial?.time_limit_minutes ?? ''} />
        <Input name="max_attempts" type="number" min={1} label="Max attempts" defaultValue={initial?.max_attempts ?? 1} />
        <Input name="passing_score" type="number" min={0} max={100} label="Pass mark (%)" defaultValue={initial?.passing_score ?? 70} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="status" label="Status" defaultValue={initial?.status ?? 'draft'} options={[{ value: 'draft', label: 'Draft (hidden)' }, { value: 'scheduled', label: 'Scheduled (opens by date)' }, { value: 'open', label: 'Open now' }, { value: 'closed', label: 'Closed' }, { value: 'results_released', label: 'Results released' }]} />
        <div className="space-y-2 pt-6">
          <Checkbox name="is_final" label="This is the final examination" description="Required for certificate eligibility." defaultChecked={initial?.is_final} />
          <Checkbox name="randomize" label="Randomise question order" defaultChecked={initial?.randomize_questions} />
        </div>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}

export default function ExamsAdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/admin') ? '/admin/exams' : '/trainer/exams';
  const exams = useQuery({ queryKey: ['exams-staff'], queryFn: () => listExamsStaff() });
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const [creating, setCreating] = useState(false);
  usePageMeta({ title: 'Examinations', noIndex: true });
  if (exams.isError) return <ErrorState onRetry={() => exams.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Examinations" title="Examinations" description="Create timed examinations, add questions, grade practical answers and release results." actions={<Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>New examination</Button>} />
      <DataTable<Row>
        caption="Examinations"
        rows={exams.data}
        loading={exams.isLoading}
        rowKey={(x) => x.id}
        onRowClick={(x) => navigate(`${base}/${x.id}`)}
        empty={<EmptyState icon={<FileText className="h-6 w-6" />} title="No examinations yet" action={<Button variant="outline" onClick={() => setCreating(true)}>Create one</Button>} />}
        columns={[
          { key: 'title', header: 'Examination', primary: true, cell: (x) => <span className="inline-flex items-center gap-2">{x.title} {x.is_final && <Badge tone="brand" size="sm">Final</Badge>}</span> },
          { key: 'course', header: 'Course', cell: (x) => x.course?.title, hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (x) => <ExamStatusBadge status={x.status} /> },
          { key: 'window', header: 'Window', cell: (x) => (x.opens_at ? `${formatDateTime(x.opens_at)} → ${x.closes_at ? formatDateTime(x.closes_at) : 'open-ended'}` : '—'), hideOnMobile: true },
          { key: 'limit', header: 'Time limit', cell: (x) => (x.time_limit_minutes ? `${x.time_limit_minutes} min` : '—') },
        ]}
      />
      <Dialog open={creating} onClose={() => setCreating(false)} title="New examination" size="lg">
        {courses.data && <ExamForm courses={courses.data} onCancel={() => setCreating(false)} onSaved={(id) => navigate(`${base}/${id}`)} />}
      </Dialog>
    </>
  );
}
