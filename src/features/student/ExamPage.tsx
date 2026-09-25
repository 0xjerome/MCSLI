import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Save, AlertTriangle } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useMyEnrollment } from './useEnrollment';
import { getExam, listExamQuestions, startExamAttempt, saveExamAnswers, submitExamAttempt, ExamTimeUpError, type ExamStart } from '@/services/student';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { Skeleton, ErrorState, Alert } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import type { Json } from '@/types/database';

function useCountdown(deadline: string | null | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return setLeft(null);
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

export default function ExamPage() {
  const { examId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { enrollment, isLoading } = useMyEnrollment();
  const exam = useQuery({ queryKey: ['exam', examId], queryFn: () => getExam(examId) });
  const [attempt, setAttempt] = useState<ExamStart | null>(null);
  const [startError, setStartError] = useState('');
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const questions = useQuery({ queryKey: ['exam-questions', examId], queryFn: () => listExamQuestions(examId), enabled: Boolean(attempt) });
  const left = useCountdown(attempt?.deadline_at);
  usePageMeta({ title: exam.data?.title ?? 'Examination', noIndex: true });

  const ordered = useMemo(() => {
    const byId = new Map((questions.data ?? []).map((q) => [q.id, q]));
    return (attempt?.question_order ?? []).map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  }, [questions.data, attempt]);

  const persist = useCallback(async () => {
    if (!attempt || !dirty.current) return;
    setSaving('saving');
    try {
      await saveExamAnswers(attempt.attempt_id, answers);
      dirty.current = false;
      setSaving('saved');
    } catch (e) {
      if (e instanceof ExamTimeUpError) {
        dirty.current = false;
        toast.info('Time is up', e.message);
        await qc.invalidateQueries({ queryKey: ['my-exam-attempts'] });
        navigate('/app/exams', { replace: true });
        return;
      }
      setSaving('error');
    }
  }, [attempt, answers, toast, qc, navigate]);

  // Autosave every 10 s while dirty, and on page hide.
  useEffect(() => {
    const t = setInterval(() => void persist(), 10_000);
    const onHide = () => void persist();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [persist]);

  const submit = useCallback(async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      dirty.current = true;
      await saveExamAnswers(attempt.attempt_id, answers).catch(() => undefined);
      const r = await submitExamAttempt(attempt.attempt_id);
      await qc.invalidateQueries({ queryKey: ['my-exam-attempts'] });
      toast.success('Examination submitted', r.needs_manual_grading ? 'Your trainer will grade the practical questions. Results are released together.' : 'Your answers have been recorded.');
      navigate('/app/exams', { replace: true });
    } catch (e) {
      toast.error('Could not submit', friendlyError(e));
      setSubmitting(false);
    }
  }, [attempt, answers, qc, toast, navigate]);

  // Auto-submit when the timer runs out.
  useEffect(() => {
    if (left === 0 && attempt && !submitting) void submit();
  }, [left, attempt, submitting, submit]);

  if (isLoading || exam.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (exam.isError) return <ErrorState onRetry={() => exam.refetch()} />;
  if (!exam.data) return <ErrorState title="Examination not available" description="This examination is not open to you yet." />;
  const x = exam.data;

  const begin = async () => {
    setStartError('');
    try {
      const a = await startExamAttempt(x.id);
      setAttempt(a);
      setAnswers(a.answers ?? {});
      setStarted(true);
    } catch (e) {
      setStartError(friendlyError(e));
    }
  };

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-display-sm">{x.title}</h1>
        <Card className="mt-6">
          <h2 className="font-semibold">Before you start</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            {x.time_limit_minutes && <li>You have <strong>{x.time_limit_minutes} minutes</strong> from the moment you start. The timer keeps running even if you close the page.</li>}
            <li>Your answers are saved automatically every few seconds. If you lose connection, reopen this page to resume.</li>
            <li>Pass mark: <strong>{x.passing_score}%</strong>. Attempts allowed: <strong>{x.max_attempts}</strong>.</li>
            <li>Practical questions are graded by an MCSLI trainer, so your final result is released after grading.</li>
          </ul>
          {x.instructions && (
            <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-700">
              <p className="font-semibold text-ink-900">Instructions from MCSLI</p>
              <p className="mt-1 whitespace-pre-line">{x.instructions}</p>
            </div>
          )}
          {startError && <Alert tone="danger" className="mt-4">{startError}</Alert>}
          <div className="mt-6 flex gap-3">
            <Button size="lg" onClick={begin}>
              Start examination
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate('/app/exams')}>
              Not now
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const answered = ordered.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const mm = left != null ? Math.floor(left / 60) : null;
  const ss = left != null ? left % 60 : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[3.75rem]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <h1 className="truncate text-base font-semibold">{x.title}</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ink-600" aria-live="polite">
              {answered}/{ordered.length} answered
            </span>
            <span className="inline-flex items-center gap-1 text-ink-500" aria-live="polite">
              <Save className="h-4 w-4" aria-hidden="true" /> {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Save failed – retrying' : 'Autosave on'}
            </span>
            {left != null && (
              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono font-semibold tabular-nums ${left < 300 ? 'bg-danger-50 text-danger-700' : 'bg-ink-100 text-ink-800'}`} role="timer" aria-label={`${mm} minutes ${ss} seconds remaining`}>
                <Clock className="h-4 w-4" aria-hidden="true" /> {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      </div>

      {attempt?.resumed && (
        <Alert tone="info" className="mb-4" title="Resumed">
          We restored your saved answers.
        </Alert>
      )}

      {questions.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirm(true);
          }}
        >
          {ordered.map((q, i) => (
            <QuestionRenderer
              key={q.id}
              question={q}
              index={i}
              value={answers[q.id]}
              onChange={(v) => {
                dirty.current = true;
                setSaving('idle');
                setAnswers((a) => ({ ...a, [q.id]: v }));
              }}
            />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4">
            <p className="text-sm text-ink-600">Check your answers, then submit. You cannot change answers after submitting.</p>
            <Button type="submit" loading={submitting}>
              Submit examination
            </Button>
          </div>
        </form>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit your examination?"
        description={answered < ordered.length ? `${ordered.length - answered} question(s) are unanswered.` : 'All questions are answered.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Keep working
            </Button>
            <Button onClick={() => void submit()} loading={submitting} data-autofocus>
              Submit now
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-ink-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
          Once submitted, your answers are final. Practical questions will be graded by your trainer.
        </p>
      </Dialog>
    </div>
  );
}
