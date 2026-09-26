import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2, Download, Upload, Megaphone, CheckCircle2, ExternalLink } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/utils';
import { parseCsv, toCsv, downloadFile } from '@/lib/csv';
import {
  getCohortAdmin, listAllCourses, listCohortsAdmin, getCohortStats, setCohortApplicationsOpen, markCohortCompleted, sendCohortStartReminder,
  listCohortQuestions, saveCohortQuestion, deleteCohortQuestion, seedDefaultCohortQuestions, copyCohortQuestions,
  listCohortApplications, getCohortApplication, reviewCohortApplication, setCohortApplicationNotes, assignApplicationEnrollment, listEnrollmentsForUser,
  importCohortApplications, type CohortReviewDecision, type CohortImportRow,
} from '@/services/staff';
import { cohortApplicationsState, cohortPhase, cohortStatusLabel, DELIVERY_MODE_LABEL } from '@/domain/cohorts';
import { CohortForm } from './AdminCohortsPage';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Field';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Misc';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { CohortApplication, CohortApplicationStatus, CohortQuestion, CohortQuestionType, CohortImportResult } from '@/types/database';

type Tab = 'applications' | 'questions' | 'import' | 'settings';
const STATUS_TONE: Record<CohortApplicationStatus, BadgeTone> = { draft: 'neutral', submitted: 'info', under_review: 'brand', accepted: 'success', waitlisted: 'warning', rejected: 'danger', withdrawn: 'neutral' };
const STATUS_LABEL: Record<CohortApplicationStatus, string> = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', accepted: 'Accepted', waitlisted: 'Waiting list', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const QUESTION_TYPES: { value: CohortQuestionType; label: string }[] = [
  { value: 'short_text', label: 'Short text' }, { value: 'long_text', label: 'Long text' }, { value: 'email', label: 'E-mail' }, { value: 'phone', label: 'Phone' }, { value: 'date', label: 'Date' },
  { value: 'single_choice', label: 'Single choice' }, { value: 'multiple_choice', label: 'Multiple choice' }, { value: 'yes_no', label: 'Yes / no' }, { value: 'country', label: 'Country' }, { value: 'location', label: 'Location' }, { value: 'delivery_mode', label: 'Delivery-mode preference' },
];

export default function AdminCohortDetailPage() {
  const { cohortId = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const cohort = useQuery({ queryKey: ['admin-cohort', cohortId], queryFn: () => getCohortAdmin(cohortId) });
  const stats = useQuery({ queryKey: ['cohort-stats', cohortId], queryFn: () => getCohortStats(cohortId) });
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const [tab, setTab] = useState<Tab>('applications');
  const [editing, setEditing] = useState(false);
  usePageMeta({ title: cohort.data?.name ?? 'Cohort', noIndex: true });

  const refresh = async () => {
    await Promise.all([cohort.refetch(), stats.refetch()]);
    await qc.invalidateQueries({ queryKey: ['admin-cohorts'] });
    await qc.invalidateQueries({ queryKey: ['public-cohorts'] });
  };
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      await refresh();
      toast.success(msg);
    } catch (e) {
      toast.error('Failed', friendlyError(e));
    }
  };

  if (cohort.isLoading) return <Skeleton className="h-96" />;
  if (cohort.isError) return <ErrorState onRetry={() => cohort.refetch()} />;
  if (!cohort.data) return <ErrorState title="Cohort not found" />;
  const c = cohort.data;
  const status = cohortStatusLabel(cohortPhase(c), cohortApplicationsState(c));
  const applicationsOpen = cohortApplicationsState(c) === 'open';
  const s = stats.data;

  return (
    <>
      <Link to="/admin/cohorts" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Cohorts
      </Link>
      <PageHeader
        eyebrow={c.course?.title ?? 'Cohort'}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {c.is_published ? <Badge tone="success">Published</Badge> : <Badge>Hidden from the website</Badge>}
            <span className="text-sm text-ink-500">{DELIVERY_MODE_LABEL[c.delivery_mode]} · {c.start_date ? formatDate(c.start_date) : 'start TBA'}{c.end_date ? ` – ${formatDate(c.end_date)}` : ''}{c.application_deadline ? ` · deadline ${formatDateTime(c.application_deadline)}` : ''}</span>
            {c.slug && c.is_published && (
              <a href={`/cohorts/${c.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
                Public page <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
              Edit
            </Button>
            <Button variant={applicationsOpen ? 'danger' : 'primary'} size="sm" onClick={() => window.confirm(applicationsOpen ? 'Close applications now? Visitors will no longer be able to apply until you reopen.' : 'Open applications now? This clears any manual override; the opening time and deadline still apply.') && act(() => setCohortApplicationsOpen(c.id, !applicationsOpen), applicationsOpen ? 'Applications closed' : 'Applications opened')}>
              {applicationsOpen ? 'Close applications' : 'Open applications'}
            </Button>
            {cohortPhase(c) !== 'completed' && (
              <Button variant="ghost" size="sm" onClick={() => {
                if (!window.confirm('Mark this cohort as completed? It moves to the archive and applications close.')) return;
                const participants = window.prompt('Verified number of participants who completed (leave empty if unknown):');
                const summary = window.prompt('Short public summary (optional):');
                void act(() => markCohortCompleted(c.id, summary || null, participants && Number(participants) >= 0 ? Number(participants) : null), 'Cohort marked completed');
              }}>
                Mark completed
              </Button>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Megaphone className="h-4 w-4" aria-hidden="true" />} onClick={() => {
              const message = window.prompt('Optional message to include in the "starting soon" e-mail to everyone enrolled in this cohort:');
              if (message === null) return;
              if (!window.confirm('Send the "starting soon" e-mail to every enrolled student of this cohort now?')) return;
              void act(async () => { const n = await sendCohortStartReminder(c.id, message || null); toast.success(`Queued for ${n} student${n === 1 ? '' : 's'}`); }, 'Reminder queued');
            }}>
              Send start reminder
            </Button>
          </div>
        }
      />

      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {([
          ['Applications', s?.applications], ['Submitted', s?.submitted], ['Under review', s?.under_review], ['Accepted', s?.accepted], ['Waiting list', s?.waitlisted], ['Rejected', s?.rejected], ['Enrolled', s?.enrolled],
          ['Payment pending', s?.payment_pending], ['Payment confirmed', s?.payment_confirmed], ['Active students', s?.active_students], ['Completed', s?.completed_students],
          ['Online', s ? `${s.online} applied · ${s.enrolled_online} enrolled` : null], ['Physical', s ? `${s.physical} applied · ${s.enrolled_physical} enrolled` : null], ['Hybrid', s ? `${s.hybrid} applied · ${s.enrolled_hybrid} enrolled` : null],
        ] as [string, number | string | null | undefined][]).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-200 bg-white p-3">
            <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <Tabs<Tab> aria-label="Cohort sections" value={tab} onChange={setTab} className="mt-6" tabs={[{ id: 'applications', label: 'Applications' }, { id: 'questions', label: 'Application questions' }, { id: 'import', label: 'Import (Google Forms)' }, { id: 'settings', label: 'Settings' }]} />
      <TabPanel id="applications" value={tab} className="mt-6">
        <ApplicationsTab cohortId={c.id} cohortName={c.name} onChanged={refresh} />
      </TabPanel>
      <TabPanel id="questions" value={tab} className="mt-6">
        <QuestionsTab cohortId={c.id} />
      </TabPanel>
      <TabPanel id="import" value={tab} className="mt-6">
        <ImportTab cohortId={c.id} onImported={refresh} />
      </TabPanel>
      <TabPanel id="settings" value={tab} className="mt-6">
        {courses.data && <div className="card p-6"><CohortForm initial={c} courses={courses.data} onSaved={() => void act(async () => undefined, 'Cohort saved')} onCancel={() => setTab('applications')} /></div>}
      </TabPanel>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit cohort" size="xl">
        {courses.data && <CohortForm initial={c} courses={courses.data} onSaved={() => { setEditing(false); void act(async () => undefined, 'Cohort saved'); }} onCancel={() => setEditing(false)} />}
      </Dialog>
    </>
  );
}

function ApplicationsTab({ cohortId, cohortName, onChanged }: { cohortId: string; cohortName: string; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [status, setStatus] = useState<CohortApplicationStatus | ''>('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const apps = useQuery({ queryKey: ['cohort-applications', cohortId, status], queryFn: () => listCohortApplications(cohortId, status || null) });
  const rows = (apps.data ?? []).filter((a) => !search || `${a.full_name} ${a.email} ${a.reference} ${a.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const exportCsv = () => {
    const keys = Array.from(new Set(rows.flatMap((a) => a.answers.filter((x) => includeSensitive || !x.sensitive).map((x) => x.label))));
    const header = ['Reference', 'Status', 'Full name', 'E-mail', 'Phone', 'Delivery mode', 'Submitted', 'Source', 'E-mail verified', ...keys];
    const body = rows.map((a) => [a.reference, a.status, a.full_name, a.email, a.phone ?? '', a.delivery_mode, a.submitted_at, a.source, a.email_verified_at ? 'yes' : 'no', ...keys.map((k) => { const x = a.answers.find((y) => y.label === k); return x ? (Array.isArray(x.answer) ? (x.answer as string[]).join('; ') : String(x.answer ?? '')) : ''; })]);
    downloadFile(`${cohortName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-applications.csv`, toCsv([header, ...body]));
    toast.success('Export downloaded', includeSensitive ? 'Includes restricted answers – handle with care.' : 'Restricted answers were left out.');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select label={<span className="sr-only">Status</span>} value={status} onChange={(e) => setStatus(e.target.value as CohortApplicationStatus | '')} options={[{ value: '', label: 'All statuses' }, ...(Object.keys(STATUS_LABEL) as CohortApplicationStatus[]).filter((k) => k !== 'draft').map((k) => ({ value: k, label: STATUS_LABEL[k] }))]} wrapperClassName="w-44" />
        <Input label={<span className="sr-only">Search</span>} placeholder="Search name, e-mail, reference…" value={search} onChange={(e) => setSearch(e.target.value)} wrapperClassName="w-64" />
        <div className="ml-auto flex items-center gap-3">
          <Checkbox label="Include restricted answers" checked={includeSensitive} onChange={(e) => setIncludeSensitive(e.target.checked)} />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>
            Export CSV
          </Button>
        </div>
      </div>
      <DataTable<CohortApplication>
        caption="Applications"
        rows={rows}
        loading={apps.isLoading}
        rowKey={(r) => r.id}
        empty={<EmptyState title="No applications" description={status ? 'None with this status.' : 'Applications submitted on mcsli.org appear here.'} />}
        onRowClick={(r) => setOpenId(r.id)}
        columns={[
          { key: 'applicant', header: 'Applicant', primary: true, cell: (r) => (<span><span className="font-medium text-ink-900">{r.full_name}</span><span className="block text-xs text-ink-500">{r.email}{r.email_verified_at ? '' : ' · unverified'}</span></span>) },
          { key: 'reference', header: 'Reference', cell: (r) => <span className="font-mono text-xs">{r.reference}</span> },
          { key: 'mode', header: 'Mode', cell: (r) => DELIVERY_MODE_LABEL[r.delivery_mode], hideOnMobile: true },
          { key: 'submitted', header: 'Submitted', cell: (r) => formatDateTime(r.submitted_at), hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (r) => (<span className="flex items-center gap-1"><Badge tone={STATUS_TONE[r.status]} size="sm">{STATUS_LABEL[r.status]}</Badge>{r.enrollment_id && <Badge tone="success" size="sm">Enrolled</Badge>}{r.source === 'google_forms_import' && <Badge size="sm">Imported</Badge>}</span>) },
        ]}
      />
      {openId && <ApplicationDialog id={openId} onClose={() => setOpenId(null)} onChanged={async () => { await apps.refetch(); await onChanged(); }} />}
    </div>
  );
}

function ApplicationDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const app = useQuery({ queryKey: ['cohort-application', id], queryFn: () => getCohortApplication(id) });
  const a = app.data;
  const enrollments = useQuery({ queryKey: ['enrollments-for-user', a?.user_id], queryFn: () => listEnrollmentsForUser(a!.user_id!), enabled: Boolean(a?.user_id && a?.status === 'accepted' && !a?.enrollment_id) });
  const [notes, setNotes] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision: CohortReviewDecision, label: string, confirmText?: string) => {
    if (!a) return;
    let note: string | null = null;
    if (confirmText) {
      const n = window.prompt(`${confirmText}\n\nOptional note to the applicant (included in the e-mail):`);
      if (n === null) return;
      note = n || null;
    }
    setBusy(true);
    try {
      await reviewCohortApplication(a.id, decision, note);
      await app.refetch();
      await onChanged();
      toast.success(label);
    } catch (e) {
      toast.error('Failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={a ? `${a.full_name} · ${a.reference}` : 'Application'} size="xl">
      {app.isLoading || !a ? (
        <Skeleton lines={6} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr,20rem]">
          <div className="space-y-5">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-500">E-mail</dt><dd className="font-medium">{a.email} {a.email_verified_at ? <Badge tone="success" size="sm">verified</Badge> : <Badge tone="warning" size="sm">unverified</Badge>}</dd></div>
              <div><dt className="text-ink-500">Phone / WhatsApp</dt><dd className="font-medium">{a.phone ?? '—'}</dd></div>
              <div><dt className="text-ink-500">Preferred attendance</dt><dd className="font-medium">{DELIVERY_MODE_LABEL[a.delivery_mode]}</dd></div>
              <div><dt className="text-ink-500">Submitted</dt><dd className="font-medium">{formatDateTime(a.submitted_at)} · {a.source.replace(/_/g, ' ')}</dd></div>
              <div><dt className="text-ink-500">Status</dt><dd><Badge tone={STATUS_TONE[a.status]} size="sm">{STATUS_LABEL[a.status]}</Badge> {a.enrollment_id && <Badge tone="success" size="sm">Enrolled</Badge>}</dd></div>
              <div><dt className="text-ink-500">Account</dt><dd className="font-medium">{a.user_id ? <Link to={`/admin/students/${a.user_id}`} className="text-brand-700 hover:underline">View student</Link> : 'No MCSLI account yet'}</dd></div>
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-ink-800">Answers</h3>
              {a.answers.length === 0 ? (
                <p className="text-sm text-ink-500">No additional answers.</p>
              ) : (
                <dl className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-200">
                  {a.answers.map((x) => (
                    <div key={x.key} className="grid gap-1 p-3 text-sm sm:grid-cols-[14rem,1fr]">
                      <dt className="text-ink-600">{x.label}{x.sensitive && <Badge size="sm" className="ml-1">restricted</Badge>}</dt>
                      <dd className="whitespace-pre-line text-ink-900">{Array.isArray(x.answer) ? (x.answer as string[]).join(', ') : String(x.answer ?? '')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-800">History</h3>
              <ol className="mt-2 space-y-1 text-sm text-ink-600">
                {a.events.map((e) => (
                  <li key={e.id}>{formatDateTime(e.created_at)} · {e.from_status ? `${STATUS_LABEL[e.from_status as CohortApplicationStatus] ?? e.from_status} → ` : ''}{STATUS_LABEL[e.to_status as CohortApplicationStatus] ?? e.to_status}{e.note ? ` – ${e.note}` : ''}</li>
                ))}
              </ol>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-ink-800">Decision</h3>
              <p className="mt-1 text-xs text-ink-500">Accepted, waiting-list and rejection decisions e-mail the applicant.</p>
              <div className="mt-3 grid gap-2">
                {a.status === 'submitted' && <Button size="sm" variant="outline" loading={busy} onClick={() => void decide('review', 'Marked under review')}>Mark under review</Button>}
                {a.status !== 'accepted' && a.status !== 'withdrawn' && <Button size="sm" loading={busy} leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} onClick={() => void decide('accept', 'Applicant accepted', 'Accept this applicant? They will be e-mailed the next steps.')}>Accept</Button>}
                {a.status !== 'waitlisted' && a.status !== 'withdrawn' && !a.enrollment_id && <Button size="sm" variant="outline" loading={busy} onClick={() => void decide('waitlist', 'Moved to the waiting list', 'Put this applicant on the waiting list?')}>Waiting list</Button>}
                {a.status !== 'rejected' && a.status !== 'withdrawn' && !a.enrollment_id && <Button size="sm" variant="danger" loading={busy} onClick={() => void decide('reject', 'Application rejected', 'Reject this application? The applicant will be e-mailed.')}>Reject</Button>}
                {(a.status === 'rejected' || a.status === 'waitlisted' || a.status === 'withdrawn') && <Button size="sm" variant="ghost" loading={busy} onClick={() => void decide('reopen', 'Application reopened', 'Reopen this application (back to submitted)?')}>Reopen</Button>}
                {a.status !== 'withdrawn' && !a.enrollment_id && <Button size="sm" variant="ghost" loading={busy} onClick={() => void decide('withdraw', 'Application withdrawn', 'Withdraw this application on the applicant’s request?')}>Withdraw</Button>}
              </div>
            </div>
            {a.status === 'accepted' && !a.enrollment_id && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-ink-800">Enrollment</h3>
                {a.user_id ? (
                  (enrollments.data ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-ink-500">The applicant has an account but no enrollment yet. When they enroll with this cohort selected, the application links automatically.</p>
                  ) : (
                    <>
                      <Select label="Link an existing enrollment" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} placeholder="Choose…" options={(enrollments.data ?? []).map((e) => ({ value: e.id, label: `${e.course?.title ?? 'Course'} · ${e.status}${e.cohort ? ` · ${e.cohort.name}` : ''}` }))} />
                      <Button size="sm" className="mt-2" disabled={!enrollmentId} loading={busy} onClick={async () => { if (!window.confirm('Assign this enrollment to the cohort?')) return; setBusy(true); try { await assignApplicationEnrollment(a.id, enrollmentId); await app.refetch(); await onChanged(); toast.success('Assigned to the cohort'); } catch (e) { toast.error('Failed', friendlyError(e)); } finally { setBusy(false); } }}>
                        Assign to cohort
                      </Button>
                    </>
                  )
                ) : (
                  <p className="mt-1 text-xs text-ink-500">No MCSLI account with this e-mail yet. The accepted e-mail asks them to create one; the application links automatically when they do.</p>
                )}
              </div>
            )}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-ink-800">Internal notes</h3>
              <Textarea label={<span className="sr-only">Internal notes</span>} rows={4} value={notes ?? a.internal_notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
              <Button size="sm" variant="outline" className="mt-2" disabled={notes === null} onClick={async () => { try { await setCohortApplicationNotes(a.id, notes ?? ''); await app.refetch(); setNotes(null); toast.success('Notes saved'); } catch (e) { toast.error('Failed', friendlyError(e)); } }}>
                Save notes
              </Button>
            </div>
          </aside>
        </div>
      )}
    </Dialog>
  );
}

function QuestionsTab({ cohortId }: { cohortId: string }) {
  const toast = useToast();
  const questions = useQuery({ queryKey: ['cohort-questions', cohortId], queryFn: () => listCohortQuestions(cohortId) });
  const cohorts = useQuery({ queryKey: ['admin-cohorts'], queryFn: listCohortsAdmin });
  const [editing, setEditing] = useState<Partial<CohortQuestion> | null>(null);
  const [copyFrom, setCopyFrom] = useState('');
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      await questions.refetch();
      toast.success(msg);
    } catch (e) {
      toast.error('Failed', friendlyError(e));
    }
  };
  const list = questions.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" onClick={() => setEditing({ position: (list.length + 1) * 10, question_type: 'short_text', required: false, is_active: true, is_sensitive: false, options: [] })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
          Add question
        </Button>
        {list.length === 0 && (
          <Button size="sm" variant="outline" onClick={() => void run(() => seedDefaultCohortQuestions(cohortId), 'Default MCSLI questions added')}>
            Add the MCSLI default questions
          </Button>
        )}
        <div className="ml-auto flex items-end gap-2">
          <Select label={<span className="sr-only">Copy from</span>} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} placeholder="Copy questions from…" options={(cohorts.data ?? []).filter((c) => c.id !== cohortId).map((c) => ({ value: c.id, label: c.name }))} wrapperClassName="w-56" />
          <Button size="sm" variant="outline" disabled={!copyFrom} onClick={() => void run(async () => { const n = await copyCohortQuestions(copyFrom, cohortId); toast.success(`${n} question${n === 1 ? '' : 's'} copied`); }, 'Copied')}>
            Copy
          </Button>
        </div>
      </div>
      <p className="text-sm text-ink-600">Applicants always give their name, e-mail, WhatsApp number and attendance preference; the questions below are added to that. Changing questions never alters applications already submitted.</p>
      {questions.isLoading ? (
        <Skeleton lines={4} />
      ) : list.length === 0 ? (
        <EmptyState compact title="No questions yet" />
      ) : (
        <ol className="space-y-2">
          {list.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white p-3 text-sm">
              <span className="w-8 text-xs font-bold text-ink-300">{q.position}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink-900">{q.label}</span>
                <span className="block text-xs text-ink-500">{q.key} · {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label}{q.required ? ' · required' : ''}{q.is_sensitive ? ' · restricted' : ''}{!q.is_active ? ' · inactive' : ''}{q.options.length ? ` · ${q.options.length} options` : ''}</span>
              </span>
              <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(q)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => window.confirm('Delete this question? Submitted applications keep their answers.') && run(() => deleteCohortQuestion(q.id), 'Question deleted')}>
                <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit question' : 'Add question'} size="lg">
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const options = String(fd.get('options') ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
              await run(() => saveCohortQuestion({
                id: editing.id, cohort_id: cohortId,
                key: String(fd.get('key')).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'question',
                label: String(fd.get('label')).trim(), help_text: String(fd.get('help_text')).trim() || null,
                question_type: String(fd.get('question_type')) as CohortQuestionType, options,
                required: fd.get('required') === 'on', is_active: fd.get('is_active') === 'on', is_sensitive: fd.get('is_sensitive') === 'on',
                position: Number(fd.get('position')) || 0,
              }), 'Question saved');
              setEditing(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="label" label="Question" required maxLength={200} defaultValue={editing.label ?? ''} data-autofocus />
              <Input name="key" label="Key" required defaultValue={editing.key ?? ''} hint="Short identifier, e.g. age_group (stable across cohorts)" />
              <Select name="question_type" label="Type" defaultValue={editing.question_type ?? 'short_text'} options={QUESTION_TYPES} />
              <Input name="position" type="number" label="Order" defaultValue={editing.position ?? 0} />
            </div>
            <Input name="help_text" label="Help text" optionalLabel defaultValue={editing.help_text ?? ''} />
            <Textarea name="options" label="Options (one per line; add “Other” to allow a free-text answer)" optionalLabel rows={4} defaultValue={(editing.options ?? []).join('\n')} />
            <div className="flex flex-wrap gap-6">
              <Checkbox name="required" label="Required" defaultChecked={editing.required ?? false} />
              <Checkbox name="is_active" label="Active (shown to applicants)" defaultChecked={editing.is_active ?? true} />
              <Checkbox name="is_sensitive" label="Restricted (sensitive – excluded from exports by default)" defaultChecked={editing.is_sensitive ?? false} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save question</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

/** Maps a Google Forms responses CSV to import rows (name / e-mail / phone / attendance columns detected by header). */
function mapGoogleFormsCsv(text: string): { rows: CohortImportRow[]; columns: string[]; mapping: Record<string, string> } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], columns: [], mapping: {} };
  const headers = table[0]!.map((h) => h.trim());
  const find = (re: RegExp, exclude?: RegExp) => headers.findIndex((h) => re.test(h) && !(exclude && exclude.test(h)));
  const iName = find(/full ?name|^name$/i);
  const iEmail = find(/e-?mail/i);
  const iPhone = find(/whatsapp|phone|contact number/i, /emergency/i);
  const iMode = find(/training option|attend/i);
  const iWhen = find(/timestamp|submitted/i);
  const mapping: Record<string, string> = { full_name: headers[iName] ?? '', email: headers[iEmail] ?? '', phone: headers[iPhone] ?? '', delivery_mode: headers[iMode] ?? '', submitted_at: headers[iWhen] ?? '' };
  const used = new Set([iName, iEmail, iPhone, iMode, iWhen].filter((i) => i >= 0));
  const rows = table.slice(1).map((r, idx) => {
    const modeText = iMode >= 0 ? (r[iMode] ?? '') : '';
    const delivery_mode: CohortImportRow['delivery_mode'] = /saturday/i.test(modeText) || (/physical/i.test(modeText) && /online/i.test(modeText)) ? 'hybrid' : /physical/i.test(modeText) ? 'physical' : 'online';
    const answers: Record<string, string> = {};
    headers.forEach((h, i) => { if (!used.has(i) && h && (r[i] ?? '').trim()) answers[h] = (r[i] ?? '').trim(); });
    if (iMode >= 0 && modeText) answers[headers[iMode]!] = modeText;
    const when = iWhen >= 0 && r[iWhen] ? new Date(r[iWhen]!) : null;
    return { full_name: (r[iName] ?? '').trim(), email: (r[iEmail] ?? '').trim(), phone: iPhone >= 0 ? (r[iPhone] ?? '').trim() : null, delivery_mode, submitted_at: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null, external_ref: `gforms:${(r[iWhen] ?? '').trim() || idx + 1}:${(r[iEmail] ?? '').trim().toLowerCase()}`, answers };
  });
  return { rows, columns: headers, mapping };
}

function ImportTab({ cohortId, onImported }: { cohortId: string; onImported: () => Promise<void> }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<CohortImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const parsed = useMemo(() => (text.trim() ? mapGoogleFormsCsv(text) : null), [text]);

  const run = async (dryRun: boolean) => {
    if (!parsed || parsed.rows.length === 0) return setError('Paste the CSV exported from the Google Form responses first.');
    if (!dryRun && !window.confirm(`Import ${result?.importable ?? parsed.rows.length} applications for real? Duplicates are skipped, nothing is accepted or enrolled automatically. Do this only after the dry run looks right and Jerome has approved it.`)) return;
    setBusy(true);
    setError('');
    try {
      const r = await importCohortApplications(cohortId, parsed.rows, dryRun);
      setResult(r);
      if (!dryRun) {
        await onImported();
        toast.success(`${r.imported} application${r.imported === 1 ? '' : 's'} imported`);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="info" title="One-time legacy import">
        Export the Google Form responses as CSV (Responses → ⋮ → Download responses), paste the file contents below and run a <strong>dry run</strong>. Rows are matched by e-mail: existing applications (native or imported) are never overwritten, nothing is accepted or enrolled automatically, and every imported application is marked “imported from Google Forms”. The import is logged in the audit trail.
      </Alert>
      <Textarea label="Google Forms responses (CSV)" rows={8} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder="Timestamp,Full Name,Email,Whatsapp Number,…" />
      {parsed && parsed.rows.length > 0 && (
        <p className="text-sm text-ink-600">
          {parsed.rows.length} rows · columns detected: name = “{parsed.mapping.full_name || '?'}”, e-mail = “{parsed.mapping.email || '?'}”, phone = “{parsed.mapping.phone || '?'}”, attendance = “{parsed.mapping.delivery_mode || '?'}”.
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {result && (
        <Alert tone={result.dry_run ? 'info' : 'success'} title={result.dry_run ? `Dry run: ${result.importable} of ${result.rows} rows would be imported` : `${result.imported} imported`}>
          {result.duplicates.length > 0 && (
            <p className="text-sm">Duplicates skipped ({result.duplicates.length}): {result.duplicates.slice(0, 10).map((d) => `${d.email}${d.reference ? ` (${d.reference})` : ''}`).join(', ')}{result.duplicates.length > 10 ? '…' : ''}</p>
          )}
          {result.invalid.length > 0 && <p className="text-sm">Invalid rows ({result.invalid.length}): {result.invalid.slice(0, 10).map((d) => `row ${d.row}: ${d.reason}`).join('; ')}{result.invalid.length > 10 ? '…' : ''}</p>}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={busy} onClick={() => void run(true)} leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}>
          Dry run
        </Button>
        <Button size="sm" loading={busy} disabled={!result || !result.dry_run || result.importable === 0} onClick={() => void run(false)}>
          Import {result?.dry_run ? result.importable : ''} applications
        </Button>
      </div>
    </div>
  );
}
