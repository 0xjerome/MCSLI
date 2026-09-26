import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Video, ListChecks, Hand } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { getCourse, listMonths, saveMonth, listModules, saveModule, deleteModule, saveLesson, deleteLesson, listPractice, savePractice, deletePractice, listQuizzesForMonth, saveQuiz, deleteQuiz, listQuizQuestionsStaff, getQuizPublishProblems, uploadCourseMedia, validateCourseMedia, getCoursePublishProblems, COURSE_MEDIA_TYPES } from '@/services/staff';
import { CourseForm } from './AdminCoursesPage';
import { QuestionBankDialog } from '@/features/staff/QuestionBankDialog';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Checkbox, Select } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { CourseMonth, Lesson, Module, PracticeItem, Quiz, QuizBlueprint, QuizRevealPolicy } from '@/types/database';

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
      <Input name={name} label={label} wrapperClassName="flex-1" value={value} onChange={(e) => setValue(e.target.value)} hint={kind === 'image' ? 'Upload a JPG/PNG/WebP, or use a direct image URL. Google Drive sharing-page links are not poster images.' : 'https:// URL, /public path, or course-media storage path. Upload sets the storage path.'} optionalLabel />
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
  const qc = useQueryClient();
  // published lessons of this month feed question metadata (lesson link, approved video sources)
  const lessonsInMonth: Lesson[] = (modules.data ?? []).flatMap((m) => ((m as Module & { lessons?: Lesson[] }).lessons ?? []));

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
        <CardHeader title="Quizzes" description="Each student draws their own question set from the approved bank. Quizzes marked required must be passed for the next month and for certificate eligibility." action={<Button size="sm" onClick={() => setQuizEdit({ is_required: true, is_published: false, randomize_questions: true, randomize_options: true, avoid_recent_questions: true, reveal_policy: 'after_pass_or_final', blueprint: {} })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Quiz</Button>} />
        {(quizzes.data ?? []).length === 0 ? (
          <EmptyState compact icon={<ListChecks className="h-5 w-5" />} title="No quizzes" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {(quizzes.data ?? []).map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 py-2 text-sm sm:flex-nowrap sm:gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{q.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                    {q.is_published ? <Badge tone="success" size="sm">Published</Badge> : <Badge tone="warning" size="sm">Draft</Badge>}
                    <QuizChecklistBadge quizId={q.id} />
                    <span>
                      pass {q.passing_score ?? course.quiz_passing_score}% · {q.questions_per_attempt ? `${q.questions_per_attempt} per attempt` : 'all approved questions'}
                      {q.max_attempts ? ` · max ${q.max_attempts} attempts` : ''} · v{q.version}
                    </span>
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setQuestionsFor(q)}>
                  Question bank
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
      <Dialog open={Boolean(quizEdit)} onClose={() => setQuizEdit(null)} title={quizEdit?.id ? 'Edit quiz' : 'Add quiz'} size="lg">
        {quizEdit && (
          <QuizForm
            quiz={quizEdit}
            course={course}
            busy={busy}
            onCancel={() => setQuizEdit(null)}
            onSave={async (payload) => {
              if (await run(() => saveQuiz({ ...payload, id: quizEdit.id, month_id: month.id }), 'Quiz saved', async () => { await quizzes.refetch(); await qc.invalidateQueries({ queryKey: ['quiz-publish-problems'] }); })) setQuizEdit(null);
            }}
          />
        )}
      </Dialog>

      {questionsFor && <QuestionBankDialog quiz={questionsFor} lessons={lessonsInMonth} practiceItems={practice.data ?? []} onClose={() => { setQuestionsFor(null); void quizzes.refetch(); }} />}
    </div>
  );
}

/** Compact publish-checklist state for a quiz row (the full list lives in the question bank dialog). */
function QuizChecklistBadge({ quizId }: { quizId: string }) {
  const problems = useQuery({ queryKey: ['quiz-publish-problems', quizId], queryFn: () => getQuizPublishProblems(quizId) });
  if (problems.isLoading || problems.isError) return null;
  const n = (problems.data ?? []).length;
  return n === 0 ? <Badge tone="success" size="sm">Checklist OK</Badge> : <Badge tone="danger" size="sm" title={(problems.data ?? []).join('; ')}>{n} checklist issue{n === 1 ? '' : 's'}</Badge>;
}

type QuizPayload = Omit<Partial<Quiz>, 'id' | 'month_id'>;

/** Quiz settings incl. the selection blueprint (configured here, never in SQL). */
function QuizForm({ quiz, course, busy, onCancel, onSave }: { quiz: Partial<Quiz>; course: { quiz_passing_score: number }; busy: boolean; onCancel: () => void; onSave: (payload: QuizPayload) => Promise<void> }) {
  const bank = useQuery({ queryKey: ['admin-quiz-questions', quiz.id], queryFn: () => listQuizQuestionsStaff(quiz.id!), enabled: Boolean(quiz.id) });
  const knownTopics = Array.from(new Set((bank.data ?? []).map((q) => q.topic).filter((t): t is string => Boolean(t)))).sort();
  const approvedByTopic = (bank.data ?? []).filter((q) => q.status === 'approved').reduce<Record<string, number>>((acc, q) => { if (q.topic) acc[q.topic] = (acc[q.topic] ?? 0) + 1; return acc; }, {});
  const approved = (bank.data ?? []).filter((q) => q.status === 'approved').length;
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>(Object.entries(quiz.blueprint?.topics ?? {}).map(([topic, count]) => ({ topic, count })));
  const [difficulty, setDifficulty] = useState<{ easy: number; medium: number; hard: number }>({ easy: quiz.blueprint?.difficulty?.easy ?? 0, medium: quiz.blueprint?.difficulty?.medium ?? 0, hard: quiz.blueprint?.difficulty?.hard ?? 0 });
  const [perAttempt, setPerAttempt] = useState<string>(quiz.questions_per_attempt ? String(quiz.questions_per_attempt) : '');

  const quotaTotal = topics.reduce((a, t) => a + (t.count || 0), 0);
  const diffTotal = difficulty.easy + difficulty.medium + difficulty.hard;
  const n = Number(perAttempt) || null;

  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const blueprint: QuizBlueprint = {};
        const t = Object.fromEntries(topics.filter((x) => x.topic.trim() && x.count > 0).map((x) => [x.topic.trim(), x.count]));
        if (Object.keys(t).length) blueprint.topics = t;
        const d = Object.fromEntries(Object.entries(difficulty).filter(([, v]) => v > 0)) as QuizBlueprint['difficulty'];
        if (d && Object.keys(d).length) blueprint.difficulty = d;
        await onSave({
          module_id: quiz.module_id ?? null,
          title: String(fd.get('title')).trim(),
          description: String(fd.get('description')).trim() || null,
          passing_score: Number(fd.get('passing_score')) || null,
          max_attempts: Number(fd.get('max_attempts')) || null,
          is_required: fd.get('is_required') === 'on',
          is_published: fd.get('is_published') === 'on',
          questions_per_attempt: n,
          randomize_questions: fd.get('randomize_questions') === 'on',
          randomize_options: fd.get('randomize_options') === 'on',
          avoid_recent_questions: fd.get('avoid_recent_questions') === 'on',
          reveal_policy: String(fd.get('reveal_policy')) as QuizRevealPolicy,
          blueprint,
        });
      }}
      className="space-y-4"
    >
      <Input name="title" label="Title" required defaultValue={quiz.title ?? ''} data-autofocus />
      <Textarea name="description" label="Description" optionalLabel rows={2} defaultValue={quiz.description ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="passing_score" type="number" min={0} max={100} label="Pass mark (%)" optionalLabel defaultValue={quiz.passing_score ?? ''} hint={`Course default: ${course.quiz_passing_score}%`} />
        <Input name="max_attempts" type="number" min={1} label="Max attempts" optionalLabel defaultValue={quiz.max_attempts ?? ''} hint="Empty = unlimited" />
      </div>

      <fieldset className="rounded-xl border border-ink-200 p-4">
        <legend className="px-1 text-sm font-semibold text-ink-800">Question selection</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Questions per attempt" type="number" min={1} max={100} value={perAttempt} onChange={(e) => setPerAttempt(e.target.value)} optionalLabel hint={quiz.id ? `Empty = every approved question (${approved} approved now). Aim for at least 3× this many approved questions.` : 'Empty = every approved question. You can change this after adding questions.'} />
          <Select name="reveal_policy" label="Show correct answers" defaultValue={quiz.reveal_policy ?? 'after_pass_or_final'} options={[{ value: 'after_pass_or_final', label: 'After passing or on the final attempt' }, { value: 'always', label: 'After every attempt' }, { value: 'never', label: 'Never (only right/wrong)' }]} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Checkbox name="randomize_questions" label="Shuffle question order" defaultChecked={quiz.randomize_questions ?? true} />
          <Checkbox name="randomize_options" label="Shuffle answer options" defaultChecked={quiz.randomize_options ?? true} />
          <Checkbox name="avoid_recent_questions" label="Retakes prefer unseen questions" defaultChecked={quiz.avoid_recent_questions ?? true} />
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-ink-200 p-4">
        <legend className="px-1 text-sm font-semibold text-ink-800">Blueprint (quotas every attempt must satisfy)</legend>
        <p className="text-xs text-ink-500">Optional. Remaining slots are filled at random from the approved pool. Publishing is refused if the quotas cannot be met, e.g. “requires 3 approved "Alphabet" questions but only 2 exist”.</p>
        <div className="mt-3 space-y-2">
          {topics.map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Input label={i === 0 ? 'Topic' : <span className="sr-only">Topic</span>} list="blueprint-topics" value={t.topic} onChange={(e) => setTopics((ts) => ts.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)))} />
              </div>
              <div className="w-28">
                <Input label={i === 0 ? 'Per attempt' : <span className="sr-only">Per attempt</span>} type="number" min={0} value={t.count} onChange={(e) => setTopics((ts) => ts.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) || 0 } : x)))} hint={approvedByTopic[t.topic] != null ? `${approvedByTopic[t.topic]} approved` : undefined} />
              </div>
              <Button type="button" variant="ghost" size="sm" aria-label="Remove topic quota" onClick={() => setTopics((ts) => ts.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <datalist id="blueprint-topics">
            {knownTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setTopics((ts) => [...ts, { topic: '', count: 1 }])}>
            Add topic quota
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Input label="Easy" type="number" min={0} value={difficulty.easy} onChange={(e) => setDifficulty({ ...difficulty, easy: Number(e.target.value) || 0 })} />
          <Input label="Medium" type="number" min={0} value={difficulty.medium} onChange={(e) => setDifficulty({ ...difficulty, medium: Number(e.target.value) || 0 })} />
          <Input label="Hard" type="number" min={0} value={difficulty.hard} onChange={(e) => setDifficulty({ ...difficulty, hard: Number(e.target.value) || 0 })} />
        </div>
        {n != null && (quotaTotal > n || diffTotal > n) && <Alert tone="warning" className="mt-3">Quotas add up to more than {n} questions per attempt – publishing will be refused until this is fixed.</Alert>}
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <Checkbox name="is_required" label="Required for the next month and the certificate" defaultChecked={quiz.is_required ?? true} />
        <Checkbox name="is_published" label="Published (validated against the checklist)" defaultChecked={quiz.is_published ?? false} />
      </div>
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
