import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Video, ListChecks, Hand } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { getCourse, listMonths, saveMonth, listModules, saveModule, deleteModule, saveLesson, deleteLesson, listPractice, savePractice, deletePractice, listQuizzesForMonth, saveQuiz, deleteQuiz, listQuizQuestionsStaff, saveQuizQuestion, deleteQuizQuestion, uploadCourseMedia, validateCourseMedia, getCoursePublishProblems, COURSE_MEDIA_TYPES } from '@/services/staff';
import { CourseForm } from './AdminCoursesPage';
import { QuestionEditor, type QuestionDraft } from '@/features/staff/QuestionEditor';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Checkbox } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { CourseMonth, Lesson, Module, PracticeItem, Quiz, QuizQuestion } from '@/types/database';

export default function AdminCourseEditorPage() {
  const { courseId = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const course = useQuery({ queryKey: ['course', courseId], queryFn: () => getCourse(courseId) });
  const months = useQuery({ queryKey: ['months', courseId], queryFn: () => listMonths(courseId), enabled: Boolean(course.data) });
  const [tab, setTab] = useState<'curriculum' | 'settings'>('curriculum');
  const [monthId, setMonthId] = useState('');
  const activeMonth = months.data?.find((m) => m.id === monthId) ?? months.data?.[0];
  usePageMeta({ title: course.data?.title ?? 'Course', noIndex: true });

  if (course.isLoading) return <Skeleton className="h-96" />;
  if (course.isError) return <ErrorState onRetry={() => course.refetch()} />;
  if (!course.data) return <ErrorState title="Course not found" />;
  const c = course.data;

  return (
    <>
      <Link to="/admin/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Courses
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-display-sm">{c.title}</h1>
        {c.is_archived ? <Badge>Archived</Badge> : c.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
      </div>
      <Tabs aria-label="Course sections" value={tab} onChange={setTab} className="mt-4" tabs={[{ id: 'curriculum', label: 'Curriculum' }, { id: 'settings', label: 'Settings & fees' }]} />

      <TabPanel id="settings" value={tab} className="mt-6">
        {!c.is_published && !c.is_archived && <PublishChecklist courseId={c.id} />}
        <Card>
          <CourseForm initial={c} onCancel={() => setTab('curriculum')} onSaved={async () => { await course.refetch(); await qc.invalidateQueries({ queryKey: ['staff-courses'] }); toast.success('Course saved'); }} />
        </Card>
      </TabPanel>

      <TabPanel id="curriculum" value={tab} className="mt-6">
        <div className="grid gap-6 lg:grid-cols-[16rem,1fr]">
          <MonthsSidebar courseId={c.id} months={months.data ?? []} activeId={activeMonth?.id} onSelect={setMonthId} onChanged={() => months.refetch()} />
          {activeMonth ? <MonthEditor key={activeMonth.id} month={activeMonth} course={c} onChanged={() => months.refetch()} /> : <EmptyState title="Add a month to start" />}
        </div>
      </TabPanel>
    </>
  );
}

function MonthsSidebar({ courseId, months, activeId, onSelect, onChanged }: { courseId: string; months: CourseMonth[]; activeId?: string; onSelect: (id: string) => void; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<CourseMonth> | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await saveMonth({ id: editing?.id, course_id: courseId, month_number: Number(fd.get('month_number')), title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim() || null, requires_assessment: fd.get('requires_assessment') === 'on', is_published: fd.get('is_published') === 'on' });
      setEditing(null);
      onChanged();
      toast.success('Month saved');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <nav aria-label="Months" className="rounded-2xl border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <span className="text-sm font-semibold">Months</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing({ month_number: months.length + 1, requires_assessment: true, is_published: true })} aria-label="Add month">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <ul>
        {months.map((m) => (
          <li key={m.id} className="flex items-center">
            <button type="button" onClick={() => onSelect(m.id)} className={`flex-1 px-4 py-2.5 text-left text-sm ${m.id === activeId ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-ink-50'}`} aria-current={m.id === activeId ? 'true' : undefined}>
              Month {m.month_number} · {m.title}
              {!m.is_published && <span className="ml-1 text-xs text-warning-700">(hidden)</span>}
            </button>
            <button type="button" onClick={() => setEditing(m)} className="p-2 text-ink-400 hover:text-ink-800" aria-label={`Edit month ${m.month_number}`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit month' : 'Add month'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[6rem,1fr]">
            <Input name="month_number" type="number" min={1} label="Number" required defaultValue={editing?.month_number ?? 1} />
            <Input name="title" label="Title" required defaultValue={editing?.title ?? ''} data-autofocus />
          </div>
          <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={editing?.description ?? ''} />
          <Checkbox name="requires_assessment" label="Requires a trainer assessment to pass" defaultChecked={editing?.requires_assessment ?? true} />
          <Checkbox name="is_published" label="Published" defaultChecked={editing?.is_published ?? true} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </nav>
  );
}

// Upload limit per file. Supabase's Free plan caps uploads at 50 MB; on Pro raise the project's
// Storage upload limit and set VITE_MAX_UPLOAD_MB accordingly.
const MAX_UPLOAD_BYTES = (Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 50) * 1024 * 1024;

function MediaField({ name, label, defaultValue, prefix, kind }: { name: string; label: string; defaultValue?: string | null; prefix: string; kind: keyof typeof COURSE_MEDIA_TYPES }) {
  const toast = useToast();
  const [value, setValue] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-end gap-2">
      <Input name={name} label={label} wrapperClassName="flex-1" value={value} onChange={(e) => setValue(e.target.value)} hint="https:// URL, /public path, or course-media storage path. Upload sets the storage path." optionalLabel />
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-300 px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50">
        <Upload className="h-4 w-4" aria-hidden="true" /> {busy ? 'Uploading…' : 'Upload'}
        <input
          type="file"
          accept={kind === 'captions' ? '.vtt,text/vtt' : COURSE_MEDIA_TYPES[kind]!.join(',')}
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const problem = validateCourseMedia(f, kind, MAX_UPLOAD_BYTES);
            if (problem) return toast.error('File not accepted', problem);
            setBusy(true);
            try {
              setValue(await uploadCourseMedia(f, prefix));
              toast.success('Uploaded to private course media');
            } catch (err) {
              toast.error('Upload failed', friendlyError(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
    </div>
  );
}

const splitMedia = (v: string) => {
  const s = v.trim();
  if (!s) return { url: null, path: null };
  return /^https?:\/\//.test(s) || s.startsWith('/') ? { url: s, path: null } : { url: null, path: s };
};

function MonthEditor({ month, course, onChanged }: { month: CourseMonth; course: { id: string; quiz_passing_score: number }; onChanged: () => void }) {
  const toast = useToast();
  const modules = useQuery({ queryKey: ['admin-modules', month.id], queryFn: () => listModules(month.id) });
  const practice = useQuery({ queryKey: ['admin-practice', month.id], queryFn: () => listPractice(month.id) });
  const quizzes = useQuery({ queryKey: ['admin-quizzes', month.id], queryFn: () => listQuizzesForMonth(month.id) });
  const [modEdit, setModEdit] = useState<Partial<Module> | null>(null);
  const [lessonEdit, setLessonEdit] = useState<(Partial<Lesson> & { module_id: string }) | null>(null);
  const [practiceEdit, setPracticeEdit] = useState<Partial<PracticeItem> | null>(null);
  const [quizEdit, setQuizEdit] = useState<Partial<Quiz> | null>(null);
  const [questionsFor, setQuestionsFor] = useState<Quiz | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, msg: string, refetch: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refetch();
      toast.success(msg);
      return true;
    } catch (err) {
      toast.error('Failed', friendlyError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Month {month.month_number} · {month.title}
        </h2>
        <p className="text-sm text-ink-600">{month.description}</p>
      </div>

      {/* Modules & lessons */}
      <Card>
        <CardHeader title="Modules & lessons" description="Lessons need a video (upload to private storage or link) and ideally captions + transcript." action={<Button size="sm" onClick={() => setModEdit({ position: (modules.data?.length ?? 0) + 1 })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Module</Button>} />
        {modules.isLoading ? (
          <Skeleton lines={4} />
        ) : (modules.data ?? []).length === 0 ? (
          <EmptyState compact title="No modules yet" />
        ) : (
          <div className="space-y-4">
            {(modules.data ?? []).map((mod) => (
              <div key={mod.id} className="rounded-xl border border-ink-200">
                <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
                  <p className="font-medium text-ink-900">
                    {mod.position}. {mod.title}
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setLessonEdit({ module_id: mod.id, position: mod.lessons.length + 1, objectives: [], is_published: true, is_required: true })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                      Lesson
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setModEdit(mod)} aria-label="Edit module">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Delete module" onClick={() => window.confirm('Delete this module and all its lessons?') && run(() => deleteModule(mod.id), 'Module deleted', modules.refetch)}>
                      <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {mod.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-ink-500">No lessons.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {mod.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <Video className={`h-4 w-4 shrink-0 ${l.video_path || l.video_url ? 'text-brand-600' : 'text-ink-300'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {l.position}. {l.title}
                          {!l.is_published && <span className="ml-1 text-xs text-warning-700">(hidden)</span>}
                          {!(l.video_path || l.video_url) && <span className="ml-1 text-xs text-danger-700">no video</span>}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setLessonEdit({ ...l, module_id: mod.id })} aria-label="Edit lesson">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Delete lesson" onClick={() => window.confirm('Delete this lesson?') && run(() => deleteLesson(l.id), 'Lesson deleted', modules.refetch)}>
                          <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Practice */}
      <Card>
        <CardHeader title="Practice signs" action={<Button size="sm" onClick={() => setPracticeEdit({ position: (practice.data?.length ?? 0) + 1, is_published: true })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Practice item</Button>} />
        {(practice.data ?? []).length === 0 ? (
          <EmptyState compact icon={<Hand className="h-5 w-5" />} title="No practice signs" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {(practice.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {p.position}. {p.title}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setPracticeEdit(p)} aria-label="Edit practice item">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete practice item" onClick={() => window.confirm('Delete this practice item?') && run(() => deletePractice(p.id), 'Deleted', practice.refetch)}>
                  <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Quizzes */}
      <Card>
        <CardHeader title="Quizzes" description="Quizzes marked required must be passed for certificate eligibility." action={<Button size="sm" onClick={() => setQuizEdit({ is_required: true, is_published: true })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Quiz</Button>} />
        {(quizzes.data ?? []).length === 0 ? (
          <EmptyState compact icon={<ListChecks className="h-5 w-5" />} title="No quizzes" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {(quizzes.data ?? []).map((q) => (
              <li key={q.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {q.title} <span className="text-xs text-ink-500">· pass {q.passing_score ?? course.quiz_passing_score}% {q.max_attempts ? `· max ${q.max_attempts} attempts` : ''}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setQuestionsFor(q)}>
                  Questions
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setQuizEdit(q)} aria-label="Edit quiz">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete quiz" onClick={() => window.confirm('Delete this quiz and its questions/attempts?') && run(() => deleteQuiz(q.id), 'Quiz deleted', quizzes.refetch)}>
                  <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Module dialog */}
      <Dialog open={Boolean(modEdit)} onClose={() => setModEdit(null)} title={modEdit?.id ? 'Edit module' : 'Add module'}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (await run(() => saveModule({ id: modEdit?.id, month_id: month.id, position: Number(fd.get('position')) || 1, title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim() || null }), 'Module saved', modules.refetch)) setModEdit(null);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-[6rem,1fr]">
            <Input name="position" type="number" min={1} label="Position" defaultValue={modEdit?.position ?? 1} />
            <Input name="title" label="Title" required defaultValue={modEdit?.title ?? ''} data-autofocus />
          </div>
          <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={modEdit?.description ?? ''} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModEdit(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={Boolean(lessonEdit)} onClose={() => setLessonEdit(null)} title={lessonEdit?.id ? 'Edit lesson' : 'Add lesson'} size="xl">
        {lessonEdit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const video = splitMedia(String(fd.get('video')));
              const captions = String(fd.get('captions')).trim();
              const ok = await run(
                () =>
                  saveLesson({
                    id: lessonEdit.id,
                    module_id: lessonEdit.module_id,
                    position: Number(fd.get('position')) || 1,
                    title: String(fd.get('title')).trim(),
                    description: String(fd.get('description')).trim() || null,
                    objectives: String(fd.get('objectives')).split('\n').map((s) => s.trim()).filter(Boolean),
                    video_url: video.url,
                    video_path: video.path,
                    captions_path: captions || null,
                    thumbnail_path: String(fd.get('thumbnail')).trim() || null,
                    transcript: String(fd.get('transcript')).trim() || null,
                    duration_seconds: Number(fd.get('duration_seconds')) || null,
                    is_published: fd.get('is_published') === 'on',
                    is_required: fd.get('is_required') === 'on',
                  }),
                'Lesson saved',
                () => Promise.all([modules.refetch(), onChanged()]),
              );
              if (ok) setLessonEdit(null);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[6rem,1fr,8rem]">
              <Input name="position" type="number" min={1} label="Position" defaultValue={lessonEdit.position ?? 1} />
              <Input name="title" label="Title" required defaultValue={lessonEdit.title ?? ''} data-autofocus />
              <Input name="duration_seconds" type="number" min={0} label="Duration (s)" optionalLabel defaultValue={lessonEdit.duration_seconds ?? ''} />
            </div>
            <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={lessonEdit.description ?? ''} />
            <Textarea name="objectives" label="Learning objectives (one per line)" optionalLabel rows={3} defaultValue={(lessonEdit.objectives ?? []).join('\n')} />
            <MediaField kind="video" name="video" label="Lesson video" defaultValue={lessonEdit.video_url ?? lessonEdit.video_path} prefix={`lessons/${lessonEdit.module_id}`} />
            <MediaField kind="captions" name="captions" label="Captions (WebVTT)" defaultValue={lessonEdit.captions_path} prefix={`captions/${lessonEdit.module_id}`} />
            <MediaField kind="image" name="thumbnail" label="Thumbnail (poster shown before playback)" defaultValue={lessonEdit.thumbnail_path} prefix={`thumbnails/${lessonEdit.module_id}`} />
            <Textarea name="transcript" label="Transcript" optionalLabel rows={4} defaultValue={lessonEdit.transcript ?? ''} hint="Required for accessibility — describe what is signed." />
            <div className="flex gap-6">
              <Checkbox name="is_published" label="Published" defaultChecked={lessonEdit.is_published ?? true} />
              <Checkbox name="is_required" label="Required for completion" defaultChecked={lessonEdit.is_required ?? true} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLessonEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save lesson
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Practice dialog */}
      <Dialog open={Boolean(practiceEdit)} onClose={() => setPracticeEdit(null)} title={practiceEdit?.id ? 'Edit practice sign' : 'Add practice sign'} size="lg">
        {practiceEdit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const video = splitMedia(String(fd.get('video')));
              if (await run(() => savePractice({ id: practiceEdit.id, month_id: month.id, position: Number(fd.get('position')) || 1, title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim() || null, movement_notes: String(fd.get('movement_notes')).trim() || null, video_url: video.url, video_path: video.path, thumbnail_path: String(fd.get('thumbnail')).trim() || null, is_published: fd.get('is_published') === 'on' }), 'Practice item saved', practice.refetch)) setPracticeEdit(null);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[6rem,1fr]">
              <Input name="position" type="number" min={1} label="Position" defaultValue={practiceEdit.position ?? 1} />
              <Input name="title" label="Sign / title" required defaultValue={practiceEdit.title ?? ''} data-autofocus />
            </div>
            <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={practiceEdit.description ?? ''} />
            <Textarea name="movement_notes" label="Key movement notes" optionalLabel rows={3} defaultValue={practiceEdit.movement_notes ?? ''} />
            <MediaField kind="video" name="video" label="Reference video" defaultValue={practiceEdit.video_url ?? practiceEdit.video_path} prefix={`practice/${month.id}`} />
            <MediaField kind="image" name="thumbnail" label="Thumbnail" defaultValue={practiceEdit.thumbnail_path} prefix={`thumbnails/practice-${month.id}`} />
            <Checkbox name="is_published" label="Published" defaultChecked={practiceEdit.is_published ?? true} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPracticeEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={Boolean(quizEdit)} onClose={() => setQuizEdit(null)} title={quizEdit?.id ? 'Edit quiz' : 'Add quiz'}>
        {quizEdit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (await run(() => saveQuiz({ id: quizEdit.id, month_id: month.id, module_id: String(fd.get('module_id')) || null, title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim() || null, passing_score: Number(fd.get('passing_score')) || null, max_attempts: Number(fd.get('max_attempts')) || null, is_required: fd.get('is_required') === 'on', is_published: fd.get('is_published') === 'on' }), 'Quiz saved', quizzes.refetch)) setQuizEdit(null);
            }}
            className="space-y-4"
          >
            <Input name="title" label="Title" required defaultValue={quizEdit.title ?? ''} data-autofocus />
            <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={quizEdit.description ?? ''} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="passing_score" type="number" min={0} max={100} label="Pass mark (%)" optionalLabel defaultValue={quizEdit.passing_score ?? ''} hint={`Course default: ${course.quiz_passing_score}%`} />
              <Input name="max_attempts" type="number" min={1} label="Max attempts" optionalLabel defaultValue={quizEdit.max_attempts ?? ''} hint="Empty = unlimited" />
            </div>
            <input type="hidden" name="module_id" value={quizEdit.module_id ?? ''} />
            <div className="flex gap-6">
              <Checkbox name="is_required" label="Required for certificate" defaultChecked={quizEdit.is_required ?? true} />
              <Checkbox name="is_published" label="Published" defaultChecked={quizEdit.is_published ?? true} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setQuizEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {questionsFor && <QuizQuestionsDialog quiz={questionsFor} onClose={() => setQuestionsFor(null)} />}
    </div>
  );
}

function QuizQuestionsDialog({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const toast = useToast();
  const questions = useQuery({ queryKey: ['admin-quiz-questions', quiz.id], queryFn: () => listQuizQuestionsStaff(quiz.id) });
  const [editing, setEditing] = useState<Partial<QuizQuestion> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (d: QuestionDraft) => {
    setBusy(true);
    try {
      await saveQuizQuestion({ id: d.id, quiz_id: quiz.id, position: d.position, question_type: d.question_type, prompt: d.prompt, video_url: d.video_url, video_path: d.video_path, options: d.options, correct_answer: d.correct_answer ?? '', explanation: d.explanation ?? null, points: d.points });
      await questions.refetch();
      setEditing(null);
      toast.success('Question saved');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Questions – ${quiz.title}`} size="xl">
      {editing ? (
        <QuestionEditor initial={editing as Partial<QuestionDraft>} showExplanation onSave={save} onCancel={() => setEditing(null)} busy={busy} />
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setEditing({ position: (questions.data?.length ?? 0) + 1 })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Add question
            </Button>
          </div>
          {questions.isLoading ? (
            <Skeleton lines={3} />
          ) : (questions.data ?? []).length === 0 ? (
            <Alert tone="info">No questions yet. Add real curriculum questions here — demo questions are only seeded in development.</Alert>
          ) : (
            <ol className="space-y-2">
              {(questions.data ?? []).map((q, i) => (
                <li key={q.id} className="flex items-start gap-3 rounded-xl border border-ink-200 p-3 text-sm">
                  <span className="font-bold text-ink-300">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-900">{q.prompt}</span>
                    <span className="text-xs text-ink-500">
                      {q.question_type.replace(/_/g, ' ')} · {q.points} pt · answer {JSON.stringify(q.correct_answer)}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(q)} aria-label="Edit">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!window.confirm('Delete this question?')) return;
                      try {
                        await deleteQuizQuestion(q.id);
                        await questions.refetch();
                      } catch (err) {
                        toast.error('Failed', friendlyError(err));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Dialog>
  );
}

/** Shows what still blocks publishing (the database refuses to publish an incomplete course). */
function PublishChecklist({ courseId }: { courseId: string }) {
  const problems = useQuery({ queryKey: ['publish-problems', courseId], queryFn: () => getCoursePublishProblems(courseId) });
  if (problems.isLoading || problems.isError) return null;
  const list = problems.data ?? [];
  return (
    <Alert tone={list.length ? 'warning' : 'success'} className="mb-4" title={list.length ? 'Before this course can be published' : 'Ready to publish'}>
      {list.length ? (
        <ul className="list-disc pl-5 text-sm">
          {list.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">All required content is in place. Tick "Published" below to open enrollment.</p>
      )}
    </Alert>
  );
}
