import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Send } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { getExamStaff, listExamQuestionsStaff, saveExamQuestion, deleteExamQuestion, listExamAttemptsStaff, gradeExamAttempt, releaseExamResults, listAllCourses, type ExamAttemptRow } from '@/services/staff';
import { QuestionEditor, type QuestionDraft } from './QuestionEditor';
import { ExamForm } from './ExamsAdminPage';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { ExamStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import type { ExamQuestion, Json } from '@/types/database';

export default function ExamDetailPage() {
  const { examId = '' } = useParams();
  const location = useLocation();
  const base = location.pathname.startsWith('/admin') ? '/admin/exams' : '/trainer/exams';
  const qc = useQueryClient();
  const toast = useToast();
  const exam = useQuery({ queryKey: ['exam-staff', examId], queryFn: () => getExamStaff(examId) });
  const questions = useQuery({ queryKey: ['exam-questions-staff', examId], queryFn: () => listExamQuestionsStaff(examId) });
  const attempts = useQuery({ queryKey: ['exam-attempts-staff', examId], queryFn: () => listExamAttemptsStaff(examId) });
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const [tab, setTab] = useState<'questions' | 'attempts' | 'settings'>('questions');
  const [editing, setEditing] = useState<Partial<ExamQuestion> | null>(null);
  const [grading, setGrading] = useState<ExamAttemptRow | null>(null);
  const [busy, setBusy] = useState(false);
  usePageMeta({ title: exam.data?.title ?? 'Examination', noIndex: true });

  if (exam.isLoading) return <Skeleton className="h-96" />;
  if (exam.isError) return <ErrorState onRetry={() => exam.refetch()} />;
  if (!exam.data) return <ErrorState title="Examination not found" />;
  const x = exam.data;

  const saveQ = async (d: QuestionDraft) => {
    setBusy(true);
    try {
      await saveExamQuestion({ id: d.id, exam_id: x.id, position: d.position, question_type: d.question_type, prompt: d.prompt, video_url: d.video_url, video_path: d.video_path, options: d.options, correct_answer: d.correct_answer, points: d.points, requires_manual_grading: d.requires_manual_grading });
      await questions.refetch();
      setEditing(null);
      toast.success('Question saved');
    } catch (err) {
      toast.error('Could not save', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!window.confirm('Release results to all graded students? They will be notified.')) return;
    try {
      const n = await releaseExamResults(x.id);
      toast.success(`Results released for ${n} attempt(s)`);
      await Promise.all([exam.refetch(), attempts.refetch()]);
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  const submitted = (attempts.data ?? []).filter((a) => a.status === 'submitted');
  const graded = (attempts.data ?? []).filter((a) => a.status === 'graded');

  return (
    <>
      <Link to={base} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Examinations
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display-sm">{x.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
            {x.course.title} <ExamStatusBadge status={x.status} /> {x.is_final && <Badge tone="brand" size="sm">Final</Badge>} · pass {x.passing_score}% · {x.max_attempts} attempt(s)
          </p>
        </div>
        {graded.some((a) => !a.results_released_at) && (
          <Button onClick={release} leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
            Release results ({graded.filter((a) => !a.results_released_at).length})
          </Button>
        )}
      </div>

      <Tabs aria-label="Exam sections" value={tab} onChange={setTab} className="mt-6" tabs={[{ id: 'questions', label: 'Questions', count: questions.data?.length }, { id: 'attempts', label: 'Attempts & grading', count: attempts.data?.length }, { id: 'settings', label: 'Settings' }]} />

      <TabPanel id="questions" value={tab} className="mt-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setEditing({ position: (questions.data?.length ?? 0) + 1 })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            Add question
          </Button>
        </div>
        {questions.isLoading ? (
          <Skeleton lines={4} />
        ) : (questions.data ?? []).length === 0 ? (
          <EmptyState title="No questions yet" description="Add multiple-choice, video, matching or practical questions." />
        ) : (
          <ol className="space-y-3">
            {(questions.data ?? []).map((q, i) => (
              <li key={q.id} className="card flex items-start gap-3 p-4">
                <span className="font-display text-lg font-bold text-ink-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{q.prompt}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {q.question_type.replace(/_/g, ' ')} · {q.points} pt{q.points === 1 ? '' : 's'}
                    {q.requires_manual_grading || q.question_type === 'practical' ? ' · trainer-graded' : ` · answer: ${JSON.stringify(q.correct_answer)}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(q)} aria-label="Edit question">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete question"
                  onClick={async () => {
                    if (!window.confirm('Delete this question?')) return;
                    try {
                      await deleteExamQuestion(q.id);
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
      </TabPanel>

      <TabPanel id="attempts" value={tab} className="mt-6">
        {attempts.isLoading ? (
          <Skeleton lines={4} />
        ) : (attempts.data ?? []).length === 0 ? (
          <EmptyState title="No attempts yet" />
        ) : (
          <div className="space-y-6">
            {submitted.length > 0 && (
              <Card>
                <CardHeader title="Awaiting grading" description="Practical answers need points from a trainer." />
                <ul className="divide-y divide-ink-100">
                  {submitted.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span>
                        <span className="font-medium text-ink-900">{a.student?.full_name ?? 'Student'}</span> · attempt {a.attempt_number} · submitted {a.submitted_at ? formatDateTime(a.submitted_at) : ''} · auto {Number(a.auto_score ?? 0)} pts
                      </span>
                      <Button size="sm" onClick={() => setGrading(a)}>
                        Grade
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHeader title="All attempts" />
              <ul className="divide-y divide-ink-100">
                {(attempts.data ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="font-medium text-ink-900">{a.student?.full_name ?? 'Student'}</span> · attempt {a.attempt_number} · {a.status.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.total_score != null && <span className="font-semibold tabular-nums">{Number(a.total_score)}%</span>}
                      {a.passed != null && (a.passed ? <Badge tone="success" size="sm">Pass</Badge> : <Badge tone="danger" size="sm">Fail</Badge>)}
                      {a.results_released_at ? <Badge tone="brand" size="sm">Released</Badge> : a.status === 'graded' ? <Badge tone="warning" size="sm">Not released</Badge> : null}
                      {a.status !== 'in_progress' && (
                        <Button size="sm" variant="ghost" onClick={() => setGrading(a)}>
                          {a.status === 'graded' ? 'Review' : 'Grade'}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </TabPanel>

      <TabPanel id="settings" value={tab} className="mt-6">
        <Card>{courses.data && <ExamForm initial={x} courses={courses.data} onCancel={() => setTab('questions')} onSaved={async () => { await exam.refetch(); await qc.invalidateQueries({ queryKey: ['exams-staff'] }); toast.success('Examination updated'); }} />}</Card>
      </TabPanel>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit question' : 'Add question'} size="xl">
        {editing && <QuestionEditor initial={editing as Partial<QuestionDraft>} allowPractical onSave={saveQ} onCancel={() => setEditing(null)} busy={busy} />}
      </Dialog>

      <GradeDialog attempt={grading} questions={questions.data ?? []} onClose={() => setGrading(null)} onGraded={() => attempts.refetch()} />
    </>
  );
}

function GradeDialog({ attempt, questions, onClose, onGraded }: { attempt: ExamAttemptRow | null; questions: ExamQuestion[]; onClose: () => void; onGraded: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!attempt) return null;
  const manual = questions.filter((q) => q.requires_manual_grading || q.question_type === 'practical' || q.correct_answer == null);
  const auto = questions.filter((q) => !manual.includes(q));
  const answers = attempt.answers ?? {};
  const fmt = (v: Json | undefined) => (v == null ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scores: Record<string, number> = {};
    for (const q of manual) scores[q.id] = Math.min(q.points, Math.max(0, Number(fd.get(`s-${q.id}`)) || 0));
    setBusy(true);
    try {
      await gradeExamAttempt(attempt.id, scores, String(fd.get('feedback')) || undefined);
      toast.success('Graded', 'Release results when you are ready.');
      onClose();
      onGraded();
    } catch (err) {
      toast.error('Could not grade', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Grade – ${attempt.student?.full_name ?? 'Student'} (attempt ${attempt.attempt_number})`} size="xl">
      <form onSubmit={submit} className="space-y-5">
        {auto.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Auto-graded</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {auto.map((q) => {
                const ok = JSON.stringify(answers[q.id]) === JSON.stringify(q.correct_answer);
                return (
                  <li key={q.id} className="flex items-start justify-between gap-3 rounded-lg bg-ink-50 p-2">
                    <span className="min-w-0 flex-1 truncate">{q.prompt}</span>
                    <span className={ok ? 'text-success-700' : 'text-danger-700'}>
                      {fmt(answers[q.id])} · {ok ? q.points : 0}/{q.points}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {manual.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Trainer-graded</h3>
            <ul className="mt-2 space-y-3">
              {manual.map((q) => (
                <li key={q.id} className="rounded-xl border border-ink-200 p-3">
                  <p className="text-sm font-medium text-ink-900">{q.prompt}</p>
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-ink-50 p-2 text-sm text-ink-700">{fmt(answers[q.id])}</p>
                  <Input name={`s-${q.id}`} type="number" min={0} max={q.points} step={0.5} label={`Points (max ${q.points})`} wrapperClassName="mt-2 max-w-[10rem]" defaultValue={attempt.manual_scores?.[q.id] ?? ''} required />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Alert tone="info">All questions were auto-graded. You can still add feedback.</Alert>
        )}
        <Textarea name="feedback" label="Feedback to the student" optionalLabel rows={3} defaultValue={attempt.grader_feedback ?? ''} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save grade
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
