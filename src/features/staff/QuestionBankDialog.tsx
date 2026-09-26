import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Download, Upload, Sparkles, Eye, BarChart3, ShieldCheck, RotateCcw } from 'lucide-react';
import { friendlyError } from '@/lib/supabase';
import {
  listQuizQuestionsStaff, saveQuizQuestion, deleteQuizQuestion, reviewQuizQuestion, getQuizPublishProblems, previewQuizSelection, getQuizStats, getQuestionStats,
  importQuizQuestions, listQuizGenerationRuns, generateQuestionDrafts, AiNotConfiguredError, type ImportedQuestion, type QuestionReviewDecision,
} from '@/services/staff';
import { QuestionEditor, type QuestionDraft, type MediaSource } from './QuestionEditor';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Select, Input, Textarea, Checkbox } from '@/components/ui/Field';
import { Skeleton, Alert, EmptyState } from '@/components/ui/Misc';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import { parseCsv } from '@/lib/csv';
import type { Lesson, PracticeItem, Quiz, QuizQuestion, QuestionStatus, QuestionDifficulty, QuizSelectionPreview, McOption, MatchingOptions } from '@/types/database';

type Tab = 'bank' | 'preview' | 'analytics' | 'import' | 'ai';

const STATUS_TONE: Record<QuestionStatus, BadgeTone> = { draft: 'warning', approved: 'success', retired: 'neutral', rejected: 'danger' };
const STATUS_LABEL: Record<QuestionStatus, string> = { draft: 'Draft', approved: 'Approved', retired: 'Retired', rejected: 'Rejected' };
const SOURCE_LABEL = { instructor: 'Instructor', ai_draft: 'AI draft', imported: 'Imported' } as const;

/** Bank health relative to the number of questions an attempt draws (red < 1.5×, amber < 3×, green ≥ 3×). */
export function bankHealth(approved: number, perAttempt: number | null): { tone: BadgeTone; label: string } {
  if (perAttempt == null) return { tone: approved > 0 ? 'info' : 'danger', label: approved > 0 ? 'Fixed quiz – every approved question' : 'No approved questions' };
  const ratio = approved / Math.max(1, perAttempt);
  if (ratio < 1.5) return { tone: 'danger', label: `Small pool (${approved} approved for ${perAttempt} per attempt)` };
  if (ratio < 3) return { tone: 'warning', label: `Fair pool (${approved} approved for ${perAttempt} per attempt)` };
  return { tone: 'success', label: `Healthy pool (${approved} approved for ${perAttempt} per attempt)` };
}

/**
 * Staff view of one quiz's question bank: filters, human review (approve / reject / retire), the
 * publish checklist, an instructor preview of the selection, analytics, import/export and
 * AI-assisted drafting. Nothing here bypasses the database rules: AI output and imports are always
 * drafts, and there is deliberately no "approve everything" action.
 */
export function QuestionBankDialog({ quiz, lessons, practiceItems, onClose }: { quiz: Quiz; lessons: Lesson[]; practiceItems: PracticeItem[]; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('bank');
  const questions = useQuery({ queryKey: ['admin-quiz-questions', quiz.id], queryFn: () => listQuizQuestionsStaff(quiz.id) });
  const problems = useQuery({ queryKey: ['quiz-publish-problems', quiz.id], queryFn: () => getQuizPublishProblems(quiz.id) });
  const qstats = useQuery({ queryKey: ['quiz-question-stats', quiz.id], queryFn: () => getQuestionStats(quiz.id) });
  const [editing, setEditing] = useState<Partial<QuestionDraft> | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ status: '', source: '', topic: '', difficulty: '', lesson: '', text: '' });

  const all = useMemo(() => questions.data ?? [], [questions.data]);
  const topics = useMemo(() => Array.from(new Set(all.map((q) => q.topic).filter((t): t is string => Boolean(t)))).sort(), [all]);
  const usage = useMemo(() => new Map((qstats.data ?? []).map((s) => [s.question_id, s])), [qstats.data]);
  const approved = all.filter((q) => q.status === 'approved').length;
  const health = bankHealth(approved, quiz.questions_per_attempt);
  const media: MediaSource[] = [
    ...lessons.filter((l) => l.is_published && (l.video_path || l.video_url)).map((l) => ({ label: `Lesson: ${l.title}`, value: l.video_path || l.video_url || '', lesson_id: l.id })),
    ...practiceItems.filter((p) => p.is_published && (p.video_path || p.video_url)).map((p) => ({ label: `Practice sign: ${p.title}`, value: p.video_path || p.video_url || '', practice_item_id: p.id })),
  ];

  const filtered = all.filter((q) =>
    (!filter.status || q.status === filter.status) && (!filter.source || q.source === filter.source) && (!filter.topic || q.topic === filter.topic)
    && (!filter.difficulty || q.difficulty === filter.difficulty) && (!filter.lesson || q.lesson_id === filter.lesson)
    && (!filter.text || q.prompt.toLowerCase().includes(filter.text.toLowerCase())),
  );

  const refresh = async () => {
    await Promise.all([questions.refetch(), problems.refetch(), qstats.refetch()]);
    await qc.invalidateQueries({ queryKey: ['admin-quizzes'] });
    await qc.invalidateQueries({ queryKey: ['publish-problems'] });
  };

  const save = async (d: QuestionDraft) => {
    setBusy(true);
    try {
      await saveQuizQuestion({
        id: d.id, quiz_id: quiz.id, position: d.position, question_type: d.question_type, prompt: d.prompt, video_url: d.video_url, video_path: d.video_path, options: d.options,
        correct_answer: d.correct_answer ?? '', explanation: d.explanation ?? null, points: d.points, topic: d.topic ?? null, difficulty: d.difficulty ?? 'medium',
        learning_objective: d.learning_objective ?? null, allow_practice: d.allow_practice ?? true, lesson_id: d.lesson_id ?? null, practice_item_id: d.practice_item_id ?? null,
      });
      await refresh();
      setEditing(null);
      toast.success(d.id ? 'Question saved (new version)' : 'Question added');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const review = async (q: QuizQuestion, decision: QuestionReviewDecision) => {
    const note = decision === 'reject' || decision === 'retire' ? window.prompt(`Note for the audit trail (optional) – ${decision} "${q.prompt.slice(0, 60)}"`) : null;
    if (note === null && (decision === 'reject' || decision === 'retire')) return;
    try {
      await reviewQuizQuestion(q.id, decision, note);
      await refresh();
      toast.success(`Question ${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : decision === 'retire' ? 'retired' : 'moved back to draft'}`);
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    }
  };

  const remove = async (q: QuizQuestion) => {
    if (!window.confirm('Delete this question? Questions that students have already been asked cannot be deleted – retire them instead.')) return;
    try {
      await deleteQuizQuestion(q.id);
      await refresh();
      toast.success('Question deleted');
    } catch (err) {
      toast.error('Cannot delete', friendlyError(err));
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Question bank – ${quiz.title}`} size="xl">
      {editing ? (
        <QuestionEditor initial={editing} showExplanation showMetadata topics={topics} lessons={lessons.filter((l) => l.is_published)} media={media} onSave={save} onCancel={() => setEditing(null)} busy={busy} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={health.tone}>{health.label}</Badge>
            <Badge tone={quiz.is_published ? 'success' : 'warning'}>{quiz.is_published ? 'Published' : 'Not published'}</Badge>
            <span className="text-ink-500">
              {all.filter((q) => q.status === 'draft').length} draft · {all.filter((q) => q.status === 'retired').length} retired · v{quiz.version}
            </span>
          </div>
          {!problems.isLoading && (
            <Alert tone={(problems.data ?? []).length ? 'warning' : 'success'} className="mb-4" title={(problems.data ?? []).length ? 'Publish checklist – students cannot start this quiz until these are fixed' : 'Publish checklist – ready'}>
              {(problems.data ?? []).length ? (
                <ul className="list-disc pl-5 text-sm">
                  {(problems.data ?? []).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">Approved questions satisfy the blueprint{quiz.questions_per_attempt ? ` (${quiz.questions_per_attempt} per attempt)` : ''}.</p>
              )}
            </Alert>
          )}
          <Tabs<Tab>
            aria-label="Question bank sections"
            variant="pills"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'bank', label: `Questions (${all.length})` },
              { id: 'preview', label: 'Preview' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'import', label: 'Import / export' },
              { id: 'ai', label: 'AI drafts' },
            ]}
          />

          <TabPanel id="bank" value={tab} className="mt-4">
            <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Input label={<span className="sr-only">Search</span>} placeholder="Search prompt…" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
              <Select label={<span className="sr-only">Status</span>} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} options={[{ value: '', label: 'All statuses' }, ...(['draft', 'approved', 'retired', 'rejected'] as QuestionStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
              <Select label={<span className="sr-only">Source</span>} value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })} options={[{ value: '', label: 'All sources' }, { value: 'instructor', label: 'Instructor' }, { value: 'ai_draft', label: 'AI draft' }, { value: 'imported', label: 'Imported' }]} />
              <Select label={<span className="sr-only">Topic</span>} value={filter.topic} onChange={(e) => setFilter({ ...filter, topic: e.target.value })} options={[{ value: '', label: 'All topics' }, ...topics.map((t) => ({ value: t, label: t }))]} />
              <Select label={<span className="sr-only">Difficulty</span>} value={filter.difficulty} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} options={[{ value: '', label: 'All difficulties' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
              <Select label={<span className="sr-only">Lesson</span>} value={filter.lesson} onChange={(e) => setFilter({ ...filter, lesson: e.target.value })} options={[{ value: '', label: 'All lessons' }, ...lessons.map((l) => ({ value: l.id, label: l.title }))]} />
            </div>
            <div className="mb-3 flex justify-end">
              <Button size="sm" onClick={() => setEditing({ position: all.length + 1, difficulty: 'medium', allow_practice: true })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                Add question
              </Button>
            </div>
            {questions.isLoading ? (
              <Skeleton lines={3} />
            ) : all.length === 0 ? (
              <Alert tone="info">No questions yet. Add real curriculum questions here, import them, or draft them with AI and review each one.</Alert>
            ) : filtered.length === 0 ? (
              <EmptyState compact title="No questions match these filters" />
            ) : (
              <ol className="space-y-2">
                {filtered.map((q) => {
                  const u = usage.get(q.id);
                  return (
                    <li key={q.id} className="rounded-xl border border-ink-200 p-3 text-sm">
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-ink-900">{q.prompt}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                            <Badge tone={STATUS_TONE[q.status]} size="sm">{STATUS_LABEL[q.status]}</Badge>
                            {q.source !== 'instructor' && <Badge tone={q.source === 'ai_draft' ? 'accent' : 'info'} size="sm">{SOURCE_LABEL[q.source]}</Badge>}
                            <Badge size="sm">{q.difficulty}</Badge>
                            {q.topic && <Badge tone="brand" size="sm">{q.topic}</Badge>}
                            <span>{q.question_type.replace(/_/g, ' ')} · {q.points} pt · answer {JSON.stringify(q.correct_answer)} · v{q.version}</span>
                            {u && u.times_used > 0 && <span>· used {u.times_used}× · {u.correct_pct}% correct</span>}
                            {u?.flag && <Badge tone="warning" size="sm">{u.flag === 'too_easy' ? 'Flag: very easy' : 'Flag: very hard'}</Badge>}
                            {q.review_note && <span className="italic">· “{q.review_note}”</span>}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {q.status !== 'approved' && (
                            <Button size="sm" variant="outline" onClick={() => void review(q, 'approve')} leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
                              Approve
                            </Button>
                          )}
                          {q.status === 'draft' && (
                            <Button size="sm" variant="ghost" onClick={() => void review(q, 'reject')}>
                              Reject
                            </Button>
                          )}
                          {q.status === 'approved' && (
                            <Button size="sm" variant="ghost" onClick={() => void review(q, 'retire')}>
                              Retire
                            </Button>
                          )}
                          {(q.status === 'rejected' || q.status === 'retired') && (
                            <Button size="sm" variant="ghost" onClick={() => void review(q, 'draft')} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
                              Back to draft
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(q)} aria-label="Edit">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {!u?.times_used && (
                            <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => void remove(q)}>
                              <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                            </Button>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabPanel>

          <TabPanel id="preview" value={tab} className="mt-4">
            <PreviewTab quizId={quiz.id} />
          </TabPanel>

          <TabPanel id="analytics" value={tab} className="mt-4">
            <AnalyticsTab quizId={quiz.id} questions={all} />
          </TabPanel>

          <TabPanel id="import" value={tab} className="mt-4">
            <ImportExportTab quiz={quiz} questions={all} onImported={refresh} />
          </TabPanel>

          <TabPanel id="ai" value={tab} className="mt-4">
            <AiDraftsTab quiz={quiz} lessons={lessons.filter((l) => l.is_published)} onGenerated={refresh} />
          </TabPanel>
        </>
      )}
    </Dialog>
  );
}

function PreviewTab({ quizId }: { quizId: string }) {
  const [preview, setPreview] = useState<QuizSelectionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      setPreview(await previewQuizSelection(quizId));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">See one possible attempt exactly as the server would select it (order and mix). No attempt is recorded. Run it a few times to check variety.</p>
      <Button size="sm" onClick={() => void run()} loading={busy} leftIcon={<Eye className="h-4 w-4" aria-hidden="true" />}>
        {preview ? 'Preview another attempt' : 'Preview an attempt'}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      {preview && preview.problems.length > 0 && <Alert tone="warning">{preview.problems.join('; ')}</Alert>}
      {preview && (
        <ol className="space-y-2">
          {preview.questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-ink-200 p-3 text-sm">
              <span className="font-bold text-ink-300">{q.position}</span> <span className="font-medium text-ink-900">{q.prompt}</span>
              <span className="ml-2 text-xs text-ink-500">
                {q.topic ?? 'no topic'} · {q.difficulty} · {q.points} pt · answer {JSON.stringify(q.correct_answer)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AnalyticsTab({ quizId, questions }: { quizId: string; questions: QuizQuestion[] }) {
  const stats = useQuery({ queryKey: ['quiz-stats', quizId], queryFn: () => getQuizStats(quizId) });
  const qstats = useQuery({ queryKey: ['quiz-question-stats', quizId], queryFn: () => getQuestionStats(quizId) });
  const prompts = new Map(questions.map((q) => [q.id, q]));
  if (stats.isLoading || qstats.isLoading) return <Skeleton lines={4} />;
  if (stats.isError || qstats.isError) return <Alert tone="danger">{friendlyError(stats.error ?? qstats.error)}</Alert>;
  const s = stats.data!;
  const tiles: [string, string | number][] = [
    ['Submitted attempts', s.attempts],
    ['Students', s.students],
    ['Pass rate', `${s.pass_rate}%`],
    ['Average score', s.avg_score == null ? '—' : `${s.avg_score}%`],
    ['Attempts per student', s.avg_attempts_per_student ?? '—'],
    ['In progress now', s.in_progress],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-200 p-3">
            <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>
      {s.topics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-800">Most missed topics</h3>
          <ul className="mt-1 flex flex-wrap gap-2 text-sm">
            {s.topics.map((t) => (
              <li key={t.topic} className="rounded-full border border-ink-200 px-3 py-1">
                {t.topic}: {t.correct_pct}% correct ({t.answered} answers)
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <BarChart3 className="h-4 w-4" aria-hidden="true" /> Per question
        </h3>
        <p className="text-xs text-ink-500">Flags are hints for review: nothing is removed automatically. Retire a question if it is confusing or leaks its answer.</p>
        {(qstats.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No submitted attempts yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="py-1 pr-2">Question</th>
                  <th className="py-1 pr-2 text-right">Used</th>
                  <th className="py-1 pr-2 text-right">Correct</th>
                  <th className="py-1 pr-2">Last used</th>
                  <th className="py-1">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(qstats.data ?? []).map((r) => (
                  <tr key={r.question_id}>
                    <td className="max-w-md truncate py-1.5 pr-2">{prompts.get(r.question_id)?.prompt ?? 'Deleted question'}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.times_used}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.correct_pct}%</td>
                    <td className="py-1.5 pr-2">{r.last_used ? formatDateTime(r.last_used) : '—'}</td>
                    <td className="py-1.5">{r.flag ? <Badge tone="warning" size="sm">{r.flag === 'too_easy' ? 'Very easy' : 'Very hard'}</Badge> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function csvToQuestions(text: string): ImportedQuestion[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (r: string[], name: string) => r[header.indexOf(name)]?.trim() ?? '';
  return rows.slice(1).map((r) => {
    const options: McOption[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, text: col(r, `option_${id}`) })).filter((o) => o.text);
    return {
      prompt: col(r, 'prompt'),
      question_type: 'multiple_choice' as const,
      options,
      correct_answer: col(r, 'correct').toLowerCase(),
      explanation: col(r, 'explanation') || null,
      topic: col(r, 'topic') || null,
      difficulty: (['easy', 'medium', 'hard'].includes(col(r, 'difficulty').toLowerCase()) ? col(r, 'difficulty').toLowerCase() : 'medium') as QuestionDifficulty,
      points: Number(col(r, 'points')) || 1,
      learning_objective: col(r, 'learning_objective') || null,
    };
  });
}

function ImportExportTab({ quiz, questions, onImported }: { quiz: Quiz; questions: QuizQuestion[]; onImported: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: { prompt: string; reason: string }[] } | null>(null);
  const [error, setError] = useState('');

  const doImport = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      let rows: ImportedQuestion[];
      const trimmed = text.trim();
      if (trimmed.startsWith('[')) rows = JSON.parse(trimmed) as ImportedQuestion[];
      else rows = csvToQuestions(trimmed);
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nothing to import. Paste a JSON array or a CSV with a header row.');
      const r = await importQuizQuestions(quiz.id, rows);
      setResult(r);
      await onImported();
    } catch (e) {
      setError(e instanceof SyntaxError ? 'The JSON could not be parsed.' : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => {
    const payload = questions.map(({ prompt, question_type, options, correct_answer, explanation, points, topic, difficulty, learning_objective, status, source, video_path, video_url }) => ({ prompt, question_type, options, correct_answer, explanation, points, topic, difficulty, learning_objective, status, source, video_path, video_url }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-question-bank.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">
        Imported questions are created as <strong>drafts</strong> and must be approved one by one. Paste a JSON array (the export format) or a CSV with the header
        <code className="ml-1 rounded bg-ink-50 px-1 text-xs">prompt,option_a,option_b,option_c,option_d,correct,topic,difficulty,explanation</code>.
      </p>
      <Textarea label="Questions to import" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"prompt":"…","options":[{"id":"a","text":"…"}],"correct_answer":"a","topic":"Alphabet","difficulty":"easy"}]' />
      {error && <Alert tone="danger">{error}</Alert>}
      {result && (
        <Alert tone={result.skipped.length ? 'warning' : 'success'} title={`${result.imported} draft${result.imported === 1 ? '' : 's'} imported`}>
          {result.skipped.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {result.skipped.map((s, i) => (
                <li key={i}>
                  “{s.prompt || '(no prompt)'}”: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void doImport()} loading={busy} leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}>
          Import as drafts
        </Button>
        <Button size="sm" variant="outline" onClick={doExport} disabled={questions.length === 0} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>
          Export bank (JSON)
        </Button>
      </div>
    </div>
  );
}

function AiDraftsTab({ quiz, lessons, onGenerated }: { quiz: Quiz; lessons: Lesson[]; onGenerated: () => Promise<void> }) {
  const runs = useQuery({ queryKey: ['quiz-generation-runs', quiz.id], queryFn: () => listQuizGenerationRuns(quiz.id) });
  const [count, setCount] = useState(5);
  const [mix, setMix] = useState({ easy: 2, medium: 2, hard: 1 });
  const [includePractice, setIncludePractice] = useState(true);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger' | 'info'; text: string } | null>(null);

  const generate = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await generateQuestionDrafts({ quizId: quiz.id, count, difficultyMix: mix, lessonIds: lessonIds.length ? lessonIds : null, includePractice });
      if (r.status === 'completed') setNotice({ tone: 'success', text: `${r.generated} draft${r.generated === 1 ? '' : 's'} added to the bank for review${r.dropped ? ` (${r.dropped} discarded by validation)` : ''}. Nothing is shown to students until you approve it.` });
      else if (r.status === 'insufficient_material') setNotice({ tone: 'warning', text: r.message ?? 'Insufficient approved course material to generate questions for this quiz. Publish the relevant lessons (with objectives or a transcript) first.' });
      else setNotice({ tone: 'danger', text: r.message ?? 'The provider returned no usable drafts.' });
      await onGenerated();
      await runs.refetch();
    } catch (e) {
      if (e instanceof AiNotConfiguredError) setNotice({ tone: 'info', text: 'AI question generation is not configured. A platform administrator must add the provider key as a Supabase Edge Function secret; until then, add or import questions manually.' });
      else setNotice({ tone: 'danger', text: friendlyError(e) });
      await runs.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="info" title="How AI drafting works">
        Drafts are written only from approved MCSLI material for this month (published lesson titles, descriptions, objectives, transcripts, and published practice signs). They are stored as <strong>drafts</strong>; you review, edit and approve each one. The AI never invents Ugandan Sign Language content, never sees student data, and its reasoning is not stored. Course media is separate from AI-training approval.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-4">
        <Input label="How many" type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        <Input label="Easy" type="number" min={0} value={mix.easy} onChange={(e) => setMix({ ...mix, easy: Number(e.target.value) || 0 })} />
        <Input label="Medium" type="number" min={0} value={mix.medium} onChange={(e) => setMix({ ...mix, medium: Number(e.target.value) || 0 })} />
        <Input label="Hard" type="number" min={0} value={mix.hard} onChange={(e) => setMix({ ...mix, hard: Number(e.target.value) || 0 })} />
      </div>
      <Checkbox label="Also use published practice signs" checked={includePractice} onChange={(e) => setIncludePractice(e.target.checked)} />
      {lessons.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Limit to lessons (optional)</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {lessons.map((l) => (
              <Checkbox key={l.id} label={l.title} checked={lessonIds.includes(l.id)} onChange={(e) => setLessonIds((ids) => (e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id)))} />
            ))}
          </div>
        </fieldset>
      )}
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Button onClick={() => void generate()} loading={busy} leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
        Generate drafts for review
      </Button>
      <div>
        <h3 className="text-sm font-semibold text-ink-800">Generation log</h3>
        {(runs.data ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">No AI runs yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-ink-100 text-sm">
            {(runs.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  {formatDateTime(r.created_at)} · requested {r.requested_count} · {r.provider ?? 'no provider'}
                  {r.model ? ` (${r.model})` : ''}
                </span>
                <span className="flex items-center gap-2">
                  <Badge size="sm" tone={r.status === 'completed' ? 'success' : r.status === 'requested' ? 'info' : r.status === 'not_configured' ? 'neutral' : 'warning'}>
                    {r.status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="tabular-nums">{r.generated_count} drafts</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type { McOption, MatchingOptions };
