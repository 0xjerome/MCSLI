import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { listAllCourses, listCohortsAdmin, saveCohortDetails } from '@/services/staff';
import { cohortApplicationsState, cohortPhase, cohortStatusLabel, DELIVERY_MODE_LABEL } from '@/domain/cohorts';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Field';
import { Alert, EmptyState, ErrorState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import type { Cohort, CohortSource, Course } from '@/types/database';

type Row = Awaited<ReturnType<typeof listCohortsAdmin>>[number];

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === '' ? null : Number(v));

/** Cohort settings form (create + edit). Slug is generated from the cohort number when left empty. */
export function CohortForm({ initial, courses, onSaved, onCancel }: { initial?: Partial<Cohort>; courses: Course[]; onSaved: (id: string) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sourcesText = (initial?.sources ?? []).map((s) => [s.label, s.url ?? '', s.note ?? ''].filter((x, i) => i === 0 || x).join(' | ')).join('\n');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const sources: CohortSource[] = String(fd.get('sources') ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [label, url, note] = l.split('|').map((x) => x.trim());
          return { label: label ?? l, url: url || null, note: note || null };
        });
      const id = await saveCohortDetails({
        id: initial?.id,
        course_id: String(fd.get('course_id')),
        name: String(fd.get('name')).trim(),
        cohort_number: num(fd.get('cohort_number')),
        slug: String(fd.get('slug')).trim().toLowerCase() || null,
        tagline: String(fd.get('tagline')).trim() || null,
        description: String(fd.get('description')).trim() || null,
        delivery_mode: String(fd.get('delivery_mode')) as Cohort['delivery_mode'],
        physical_location: String(fd.get('physical_location')).trim() || null,
        online_details: String(fd.get('online_details')).trim() || null,
        schedule_notes: String(fd.get('schedule_notes')).trim() || null,
        eligibility: String(fd.get('eligibility')).trim() || null,
        certificate_description: String(fd.get('certificate_description')).trim() || null,
        start_date: String(fd.get('start_date')) || null,
        end_date: String(fd.get('end_date')) || null,
        application_opens_at: fromLocalInput(String(fd.get('application_opens_at'))),
        application_deadline: fromLocalInput(String(fd.get('application_deadline'))),
        capacity: num(fd.get('capacity')),
        registration_fee: num(fd.get('registration_fee')),
        tuition_online: num(fd.get('tuition_online')),
        tuition_physical: num(fd.get('tuition_physical')),
        currency: String(fd.get('currency')).trim() || 'UGX',
        announcement_url: String(fd.get('announcement_url')).trim() || null,
        fallback_form_url: String(fd.get('fallback_form_url')).trim() || null,
        hero_image_path: String(fd.get('hero_image_path')).trim() || null,
        is_open: fd.get('is_open') === 'on',
        auto_accept: fd.get('auto_accept') === 'on',
        is_featured: fd.get('is_featured') === 'on',
        is_published: fd.get('is_published') === 'on',
        sources,
      });
      onSaved(id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="course_id" label="Course (curriculum)" required defaultValue={initial?.course_id ?? courses[0]?.id ?? ''} options={courses.map((c) => ({ value: c.id, label: c.title }))} hint="One course is reused by every cohort – never duplicate a course per cohort." />
        <Input name="cohort_number" type="number" min={1} max={999} label="Cohort number" optionalLabel defaultValue={initial?.cohort_number ?? ''} hint="e.g. 9 → public address /cohorts/cohort-9" />
        <Input name="name" label="Name" required maxLength={80} defaultValue={initial?.name ?? ''} placeholder="Cohort 9" data-autofocus />
        <Input name="slug" label="Slug" optionalLabel defaultValue={initial?.slug ?? ''} hint="Leave empty to generate from the number" />
      </div>
      <Input name="tagline" label="Tagline" optionalLabel maxLength={160} defaultValue={initial?.tagline ?? ''} placeholder="3-month Ugandan Sign Language training – online, in Kampala or both" />
      <Textarea name="description" label="Description" optionalLabel rows={4} defaultValue={initial?.description ?? ''} hint="What learners will learn and how the cohort runs. Only verified facts." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select name="delivery_mode" label="Learning format" defaultValue={initial?.delivery_mode ?? 'hybrid'} options={[{ value: 'online', label: 'Online only' }, { value: 'physical', label: 'Physical only' }, { value: 'hybrid', label: 'Online & physical' }]} />
        <Input name="start_date" type="date" label="Start date" optionalLabel defaultValue={initial?.start_date ?? ''} />
        <Input name="end_date" type="date" label="End date" optionalLabel defaultValue={initial?.end_date ?? ''} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="physical_location" label="Physical location" optionalLabel defaultValue={initial?.physical_location ?? ''} />
        <Input name="online_details" label="Online details" optionalLabel defaultValue={initial?.online_details ?? ''} placeholder="Live classes on Zoom + recorded lessons on the MCSLI platform" />
      </div>
      <Textarea name="schedule_notes" label="Schedule" optionalLabel rows={3} defaultValue={initial?.schedule_notes ?? ''} placeholder={'Online: Tuesday & Thursday 3:30–5:00 pm, Saturday 9:30 am–12:30 pm\nPhysical: …'} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name="application_opens_at" type="datetime-local" label="Applications open" optionalLabel defaultValue={toLocalInput(initial?.application_opens_at)} hint="Africa/Kampala time on this device" />
        <Input name="application_deadline" type="datetime-local" label="Application deadline" optionalLabel defaultValue={toLocalInput(initial?.application_deadline)} hint="Enforced server-side" />
        <Input name="capacity" type="number" min={1} label="Capacity" optionalLabel defaultValue={initial?.capacity ?? ''} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Input name="registration_fee" type="number" min={0} label="Registration fee" optionalLabel defaultValue={initial?.registration_fee ?? ''} />
        <Input name="tuition_physical" type="number" min={0} label="Tuition – physical" optionalLabel defaultValue={initial?.tuition_physical ?? ''} />
        <Input name="tuition_online" type="number" min={0} label="Tuition – online" optionalLabel defaultValue={initial?.tuition_online ?? ''} />
        <Input name="currency" label="Currency" defaultValue={initial?.currency ?? 'UGX'} />
      </div>
      <Textarea name="eligibility" label="Who can apply" optionalLabel rows={2} defaultValue={initial?.eligibility ?? ''} />
      <Input name="certificate_description" label="Certificate" optionalLabel defaultValue={initial?.certificate_description ?? ''} placeholder="Certificate in Ugandan Sign Language after passing the assessments" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="announcement_url" label="Announcement link" optionalLabel type="url" defaultValue={initial?.announcement_url ?? ''} hint="e.g. the LinkedIn post – evidence, not the database" />
        <Input name="fallback_form_url" label="Alternative application form (temporary)" optionalLabel type="url" defaultValue={initial?.fallback_form_url ?? ''} hint="Shown only as a small fallback link while applications are open" />
      </div>
      <Input name="hero_image_path" label="Image path" optionalLabel defaultValue={initial?.hero_image_path ?? ''} hint="A public path such as /media/gallery/… (only images MCSLI has the rights to use)" />
      <Textarea name="sources" label="Sources (one per line: Label | URL | note)" optionalLabel rows={3} defaultValue={sourcesText} hint="Provenance of the facts above – first-party MCSLI sources only." />
      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox name="is_open" label="Accepting applications" description="Together with the opening time and deadline" defaultChecked={initial?.is_open ?? false} />
        <Checkbox name="auto_accept" label="Accept applicants automatically" description="Off = staff review each application" defaultChecked={initial?.auto_accept ?? false} />
        <Checkbox name="is_featured" label="Feature as the current cohort" defaultChecked={initial?.is_featured ?? false} />
        <Checkbox name="is_published" label="Published on mcsli.org" description="Unpublished cohorts are invisible to visitors" defaultChecked={initial?.is_published ?? false} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save cohort
        </Button>
      </div>
    </form>
  );
}

export default function AdminCohortsPage() {
  const navigate = useNavigate();
  const cohorts = useQuery({ queryKey: ['admin-cohorts'], queryFn: listCohortsAdmin });
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const [creating, setCreating] = useState(false);
  usePageMeta({ title: 'Cohorts', noIndex: true });
  if (cohorts.isError) return <ErrorState onRetry={() => cohorts.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Intakes" title="Cohorts" description="A cohort is one intake of a course: its dates, learning format, fees, application questions and applicants. Publish a cohort to show it on mcsli.org." actions={<Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>New cohort</Button>} />
      <DataTable<Row>
        caption="Cohorts"
        rows={cohorts.data}
        loading={cohorts.isLoading}
        rowKey={(r) => r.id}
        empty={<EmptyState title="No cohorts yet" description="Create the current intake first – then add its application questions and publish it." action={<Button onClick={() => setCreating(true)}>New cohort</Button>} />}
        onRowClick={(r) => navigate(`/admin/cohorts/${r.id}`)}
        columns={[
          { key: 'name', header: 'Cohort', primary: true, cell: (r) => (
            <span>
              <span className="font-medium text-ink-900">{r.name}</span>
              <span className="block text-xs text-ink-500">{r.course?.title ?? '—'} · {DELIVERY_MODE_LABEL[r.delivery_mode]}</span>
            </span>
          ) },
          { key: 'status', header: 'Status', cell: (r) => { const s = cohortStatusLabel(cohortPhase(r), cohortApplicationsState(r)); return <Badge tone={s.tone} size="sm">{s.label}</Badge>; } },
          { key: 'published', header: 'Website', cell: (r) => (r.is_published ? <Badge tone="success" size="sm">Published</Badge> : <Badge size="sm">Hidden</Badge>) },
          { key: 'dates', header: 'Dates', hideOnMobile: true, cell: (r) => `${r.start_date ? formatDate(r.start_date) : 'TBA'}${r.end_date ? ` – ${formatDate(r.end_date)}` : ''}` },
          { key: 'deadline', header: 'Deadline', hideOnMobile: true, cell: (r) => (r.application_deadline ? formatDate(r.application_deadline) : '—') },
        ]}
      />
      <Dialog open={creating} onClose={() => setCreating(false)} title="New cohort" size="xl">
        {courses.data && <CohortForm courses={courses.data} onSaved={(id) => { setCreating(false); void cohorts.refetch(); navigate(`/admin/cohorts/${id}`); }} onCancel={() => setCreating(false)} />}
      </Dialog>
    </>
  );
}
