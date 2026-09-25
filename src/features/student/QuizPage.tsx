import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useMyEnrollment } from './useEnrollment';
import { getQuiz, listQuizQuestions, listQuizAttempts, submitQuizAttempt } from '@/services/student';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { Skeleton, ErrorState, Breadcrumb, Alert } from '@/components/ui/Misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { Json, QuizResult } from '@/types/database';

export default function QuizPage() {
  const { quizId = '' } = useParams();
  const { enrollment, isLoading } = useMyEnrollment();
  const qc = useQueryClient();
  const quiz = useQuery({ queryKey: ['quiz', quizId], queryFn: () => getQuiz(quizId) });
  const questions = useQuery({ queryKey: ['quiz-questions', quizId], queryFn: () => listQuizQuestions(quizId), enabled: Boolean(quiz.data) });
  const attempts = useQuery({ queryKey: ['quiz-attempts', enrollment?.id, quizId], queryFn: () => listQuizAttempts(enrollment!.id, quizId), enabled: Boolean(enrollment) });
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: quiz.data?.title ?? 'Quiz', noIndex: true });

  if (isLoading || quiz.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (quiz.isError) return <ErrorState onRetry={() => quiz.refetch()} />;
  if (!quiz.data) return <ErrorState title="Quiz not available" description="This quiz is locked or does not exist." />;

  const q = quiz.data;
  const list = questions.data ?? [];
  const mine = attempts.data ?? [];
  const passed = mine.some((a) => a.passed);
  const exhausted = q.max_attempts != null && mine.length >= q.max_attempts;
  const unanswered = list.filter((qq) => answers[qq.id] === undefined || answers[qq.id] === '').length;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await submitQuizAttempt(q.id, answers);
      setResult(r);
      await qc.invalidateQueries({ queryKey: ['quiz-attempts'] });
      await qc.invalidateQueries({ queryKey: ['course-map'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const feedbackFor = (id: string) => result?.questions.find((x) => x.question_id === id);

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: 'My course', to: `/app/course/${enrollment.course_id}` }, { label: `Month ${q.month.month_number}`, to: `/app/course/${enrollment.course_id}/month/${q.month.id}` }, { label: q.title }]} className="mb-3" />
      <h1 className="text-display-sm">{q.title}</h1>
      {q.description && <p className="mt-1 text-ink-600">{q.description}</p>}
      <p className="mt-2 text-sm text-ink-500">
        Passing score {q.passing_score ?? 70}% · {list.length} question{list.length === 1 ? '' : 's'}
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
                {result.passed ? 'Passed' : 'Not passed yet'} — you scored {result.score}%
              </p>
              <p className="mt-1 text-sm text-ink-700">{result.passed
                  ? 'Well done. Review the explanations below to reinforce what you learned.'
                  : result.answers_revealed
                    ? `You need ${result.passing_score}% to pass. Review the explanations below.`
                    : `You need ${result.passing_score}% to pass. The questions marked incorrect need another look – review the lesson material, then try again.`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!result.passed && !(q.max_attempts != null && mine.length >= q.max_attempts) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setResult(null);
                      setAnswers({});
                    }}
                  >
                    Try again
                  </Button>
                )}
                <ButtonLink to={`/app/course/${enrollment.course_id}/month/${q.month.id}`} variant="outline" size="sm">
                  Back to month
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!result && passed && (
        <Alert tone="success" className="mt-6" title="You have already passed this quiz">
          You can take it again to practise; your best result is kept.
        </Alert>
      )}
      {!result && exhausted && !passed && (
        <Alert tone="warning" className="mt-6" title="No attempts left">
          You have used all {q.max_attempts} attempts. Ask your trainer in the discussion or through Help if you need another chance.
        </Alert>
      )}

      {questions.isLoading ? (
        <Skeleton className="mt-6 h-64" />
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {list.map((qq, i) => (
            <QuestionRenderer key={qq.id} question={qq} index={i} value={answers[qq.id]} onChange={(v) => setAnswers((a) => ({ ...a, [qq.id]: v }))} feedback={feedbackFor(qq.id)} disabled={Boolean(result) || (exhausted && !passed)} />
          ))}
          {error && <Alert tone="danger">{error}</Alert>}
          {!result && !(exhausted && !passed) && list.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-4">
              <p className="text-sm text-ink-600" aria-live="polite">
                {unanswered === 0 ? 'All questions answered.' : `${unanswered} question${unanswered === 1 ? '' : 's'} unanswered.`}
              </p>
              <Button type="submit" loading={busy}>
                Submit answers
              </Button>
            </div>
          )}
        </form>
      )}

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="history">
          <h2 id="history" className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Attempt history
          </h2>
          <ul className="mt-3 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
            {mine.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  Attempt {a.attempt_number} · {formatDate(a.submitted_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{a.score}%</span>
                  {a.passed ? <Badge tone="success" size="sm">Passed</Badge> : <Badge tone="neutral" size="sm">Not passed</Badge>}
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
