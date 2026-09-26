import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Trophy, Play, Shuffle, Sparkles } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useMyEnrollment } from './useEnrollment';
import { getQuiz, getQuizAttempt, listQuizAttempts, saveQuizAnswers, startQuizAttempt, submitQuizAttempt } from '@/services/student';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { Skeleton, ErrorState, Breadcrumb, Alert } from '@/components/ui/Misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { formatDate } from '@/lib/utils';
import type { Json, QuizAttemptStart, QuizResult } from '@/types/database';

const isAnswered = (v: Json | undefined) => v !== undefined && v !== null && v !== '' && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * Student quiz flow: start (the server selects and snapshots this student's questions) → answer
 * with autosave → submit → result. Refreshing the page resumes the same attempt with the same
 * questions in the same order; a submitted attempt can be reviewed from the history list.
 */
export default function QuizPage() {
  const { quizId = '' } = useParams();
  const { enrollment, isLoading } = useMyEnrollment();
  const qc = useQueryClient();
  const quiz = useQuery({ queryKey: ['quiz', quizId], queryFn: () => getQuiz(quizId) });
  const attempts = useQuery({ queryKey: ['quiz-attempts', enrollment?.id, quizId], queryFn: () => listQuizAttempts(enrollment!.id, quizId), enabled: Boolean(enrollment) });
  const [attempt, setAttempt] = useState<QuizAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = useRef(false);
  usePageMeta({ title: quiz.data?.title ?? 'Quiz', noIndex: true });

  const mine = attempts.data ?? [];
  const inProgress = mine.find((a) => a.status === 'in_progress');

  const begin = async () => {
    setStarting(true);
    setError('');
    try {
      const a = await startQuizAttempt(quizId);
      setResult(null);
      setAttempt(a);
      setAnswers(a.answers ?? {});
      dirty.current = false;
      setSaveState('saved');
      await qc.invalidateQueries({ queryKey: ['quiz-attempts'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setStarting(false);
    }
  };

  // Resume automatically after a refresh or on a second device: the server returns the same attempt.
  const inProgressId = inProgress?.id;
  useEffect(() => {
    if (inProgressId && !attempt && !result && !starting) void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgressId]);

  // Autosave (debounced). Unknown keys are dropped server-side; the final submit sends everything again.
  useEffect(() => {
    if (!attempt || !dirty.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      saveQuizAnswers(attempt.attempt_id, answers)
        .then((saved) => setSaveState(saved ? 'saved' : 'error'))
        .catch(() => setSaveState('error'));
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, attempt]);

  if (isLoading || quiz.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (quiz.isError) return <ErrorState onRetry={() => quiz.refetch()} />;
  if (!quiz.data) return <ErrorState title="Quiz not available" description="This quiz is locked or does not exist." />;

  const q = quiz.data;
  const passed = mine.some((a) => a.passed);
  const exhausted = q.max_attempts != null && mine.length >= q.max_attempts;
  const total = attempt?.questions.length ?? 0;
  const answered = attempt ? attempt.questions.filter((qq) => isAnswered(answers[qq.id])).length : 0;
  const randomized = q.questions_per_attempt != null || q.randomize_questions;

  const submit = async () => {
    if (!attempt) return;
    setBusy(true);
    setError('');
    try {
      const r = await submitQuizAttempt(attempt.attempt_id, answers);
      setResult(r);
      setAttempt(null);
      await qc.invalidateQueries({ queryKey: ['quiz-attempts'] });
      await qc.invalidateQueries({ queryKey: ['course-map'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const review = async (attemptId: string) => {
    setError('');
    try {
      const r = await getQuizAttempt(attemptId);
      setAttempt(null);
      setResult(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: 'My course', to: `/app/course/${enrollment.course_id}` }, { label: `Month ${q.month.month_number}`, to: `/app/course/${enrollment.course_id}/month/${q.month.id}` }, { label: q.title }]} className="mb-3" />
      <h1 className="text-display-sm">{q.title}</h1>
      {q.description && <p className="mt-1 text-ink-600">{q.description}</p>}
      <p className="mt-2 text-sm text-ink-500">
        Passing score {q.passing_score ?? 70}%
        {q.questions_per_attempt ? ` · ${q.questions_per_attempt} questions per attempt` : ''}
        {q.max_attempts ? ` · ${mine.length}/${q.max_attempts} attempts used` : ''}
      </p>

      {result && (
        <Card className={`mt-6 ${result.passed ? 'border-success-100 bg-success-50' : 'border-warning-100 bg-warning-50'}`} role="status">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${result.passed ? 'bg-white text-success-600' : 'bg-white text-warning-600'} shadow-card`} aria-hidden="true">
              {result.passed ? <Trophy className="h-6 w-6" /> : <RotateCcw className="h-6 w-6" />}
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold text-ink-900">
                {result.passed ? 'Passed' : 'Not passed yet'} — you scored {result.score ?? 0}%
                <span className="ml-2 text-sm font-normal text-ink-600">(attempt {result.attempt_number})</span>
              </p>
              <p className="mt-1 text-sm text-ink-700">
                {result.passed
                  ? 'Well done. Review the explanations below to reinforce what you learned.'
                  : result.answers_revealed
                    ? `You need ${result.passing_score}% to pass. Review the explanations below.`
                    : `You need ${result.passing_score}% to pass. The questions marked incorrect need another look – review the lesson material, then try again.${randomized ? ' Your next attempt may draw different questions.' : ''}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!result.passed && !exhausted && (
                  <Button size="sm" onClick={() => void begin()} loading={starting} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
                    Try again
                  </Button>
                )}
                <ButtonLink to={`/app/course/${enrollment.course_id}/month/${q.month.id}`} variant="outline" size="sm">
                  Back to month
                </ButtonLink>
                <ButtonLink to="/app/practice/quiz" variant="ghost" size="sm">
                  Practice mode
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!result && !attempt && passed && (
        <Alert tone="success" className="mt-6" title="You have already passed this quiz">
          You can take it again to practise; your best result is kept. Practice mode gives instant feedback without affecting your grades.
        </Alert>
      )}
      {!result && !attempt && exhausted && !passed && (
        <Alert tone="warning" className="mt-6" title="No attempts left">
          You have used all {q.max_attempts} attempts. Ask your trainer in the discussion or through Help if you need another chance.
        </Alert>
      )}
      {error && <Alert tone="danger" className="mt-6">{error}</Alert>}

      {!result && !attempt && !(exhausted && !passed) && (
        <Card className="mt-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden="true">
              {randomized ? <Shuffle className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold text-ink-900">{inProgress ? 'Continue your attempt' : mine.length ? 'Start a new attempt' : 'Ready when you are'}</p>
              <p className="mt-1 text-sm text-ink-600">
                {randomized
                  ? 'Questions are drawn from a question bank, so each attempt can be different. Your answers are saved as you go – you can safely refresh or come back later to finish.'
                  : 'Your answers are saved as you go – you can safely refresh or come back later to finish.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void begin()} loading={starting || attempts.isLoading} leftIcon={<Play className="h-4 w-4" aria-hidden="true" />}>
                  {inProgress ? 'Continue' : 'Start quiz'}
                </Button>
                <ButtonLink to="/app/practice/quiz" variant="outline" leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
                  Practice first
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {attempt && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="sticky top-16 z-10 rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-card backdrop-blur sm:p-4">
            <ProgressBar value={total ? (answered / total) * 100 : 0} label={`${answered} of ${total} answered`} showValue={false} size="sm" />
            <p className="mt-1.5 text-xs text-ink-500" aria-live="polite">
              {attempt.resumed ? 'Resumed your attempt · ' : ''}
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Could not save your last change – check your connection. Submitting will send all answers.' : saveState === 'saved' ? 'All changes saved' : ''}
            </p>
          </div>
          {attempt.questions.map((qq, i) => (
            <QuestionRenderer
              key={qq.id}
              question={qq}
              index={i}
              value={answers[qq.id]}
              onChange={(v) => {
                dirty.current = true;
                setAnswers((a) => ({ ...a, [qq.id]: v }));
              }}
              disabled={busy}
            />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4">
            <p className="text-sm text-ink-600" aria-live="polite">
              {answered === total ? 'All questions answered.' : `${total - answered} question${total - answered === 1 ? '' : 's'} unanswered.`}
            </p>
            <Button type="submit" loading={busy} onClick={(e) => { if (answered < total && !window.confirm('Some questions are unanswered. Submit anyway?')) e.preventDefault(); }}>
              Submit answers
            </Button>
          </div>
        </form>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {result.questions.map((rq, i) => (
            <QuestionRenderer key={rq.id} question={rq} index={i} value={rq.your_answer ?? undefined} onChange={() => undefined} disabled feedback={rq.correct === null ? undefined : { correct: rq.correct, correct_answer: rq.correct_answer, explanation: rq.explanation }} />
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="history">
          <h2 id="history" className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Attempt history
          </h2>
          <ul className="mt-3 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
            {mine.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  Attempt {a.attempt_number} · {formatDate(a.submitted_at ?? a.started_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex items-center gap-2">
                  {a.status === 'in_progress' ? (
                    <Badge tone="info" size="sm">In progress</Badge>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums">{a.score ?? 0}%</span>
                      {a.passed ? <Badge tone="success" size="sm">Passed</Badge> : <Badge tone="neutral" size="sm">Not passed</Badge>}
                      {result?.attempt_id !== a.id && (
                        <Button size="sm" variant="ghost" onClick={() => void review(a.id)}>
                          Review
                        </Button>
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link to="/app/quizzes" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All quizzes
      </Link>
    </div>
  );
}
