import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, Target } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { checkPracticeAnswer, getTopicProgress, listPracticeQuestions } from '@/services/student';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/Progress';
import type { Json, PracticeFeedback, PracticeQuestion } from '@/types/database';

const ROUND_SIZE = 5;

interface Session {
  questions: PracticeQuestion[];
  index: number;
  results: boolean[];
}

/**
 * Practice mode: low-stakes rounds of approved questions from unlocked months with immediate
 * feedback. Nothing here counts towards quiz results, month unlocking or certificates – the only
 * thing recorded is a per-topic accuracy that helps the student (and their trainer) see weak areas.
 */
export default function PracticeQuizPage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const qc = useQueryClient();
  const unlocked = (map.data ?? []).filter((m) => m.access.allowed);
  const [monthId, setMonthId] = useState('');
  const activeMonth = monthId || unlocked[unlocked.length - 1]?.id || '';
  const [topic, setTopic] = useState('');
  const progress = useQuery({ queryKey: ['topic-progress', enrollment?.id], queryFn: () => getTopicProgress(enrollment!.id), enabled: Boolean(enrollment) });
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState<Json | undefined>(undefined);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: 'Practice mode', noIndex: true });

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;

  const topics = Array.from(new Set((progress.data ?? []).map((t) => t.topic).filter((t) => t !== 'General'))).sort();
  const weak = (progress.data ?? []).filter((t) => t.quiz_answered + t.practice_answered >= 3 && t.accuracy < 70);

  const startRound = async () => {
    setBusy(true);
    setError('');
    setFeedback(null);
    setAnswer(undefined);
    try {
      const questions = await listPracticeQuestions(activeMonth, ROUND_SIZE, topic || null);
      if (questions.length === 0) {
        setSession(null);
        setError(topic ? `No practice questions for "${topic}" yet. Try another topic.` : 'No practice questions for this month yet. Your trainer adds them with the quizzes.');
      } else {
        setSession({ questions, index: 0, results: [] });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    if (!session || answer === undefined) return;
    const current = session.questions[session.index]!;
    setBusy(true);
    setError('');
    try {
      const fb = await checkPracticeAnswer(current.id, answer);
      setFeedback(fb);
      setSession({ ...session, results: [...session.results, fb.correct] });
      await qc.invalidateQueries({ queryKey: ['topic-progress'] });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!session) return;
    setFeedback(null);
    setAnswer(undefined);
    setSession({ ...session, index: session.index + 1 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finished = session && session.index >= session.questions.length;
  const current = session && !finished ? session.questions[session.index] : null;
  const correctCount = session?.results.filter(Boolean).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Practice" title="Practice mode" description="Short rounds with instant feedback. Practice never changes your quiz results, month access or certificate – it only shows you which topics to revise." />
      {unlocked.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Practice opens with Month 1" description="Once your payment is confirmed you can practise questions from your unlocked months." />
      ) : !session ? (
        <Card>
          <div className="space-y-4">
            {unlocked.length > 1 && <Tabs aria-label="Month" variant="pills" className="w-fit" value={activeMonth} onChange={(v) => setMonthId(v)} tabs={unlocked.map((m) => ({ id: m.id, label: `Month ${m.month_number}` }))} />}
            {topics.length > 0 && (
              <div className="max-w-xs">
                <Select label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} options={[{ value: '', label: 'All topics' }, ...topics.map((t) => ({ value: t, label: t }))]} />
              </div>
            )}
            {weak.length > 0 && (
              <Alert tone="info" title="Suggested revision">
                <ul className="flex flex-wrap gap-2 pt-1">
                  {weak.map((t) => (
                    <li key={t.topic}>
                      <button type="button" className="rounded-full border border-info-200 bg-white px-3 py-1 text-sm font-medium text-ink-800 hover:border-brand-500" onClick={() => setTopic(t.topic)}>
                        {t.topic} · {t.accuracy}%
                      </button>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void startRound()} loading={busy} leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>
                Start a round of {ROUND_SIZE}
              </Button>
              <ButtonLink to="/app/quizzes" variant="outline">
                Go to quizzes
              </ButtonLink>
            </div>
          </div>
        </Card>
      ) : finished ? (
        <Card role="status">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden="true">
              <Target className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold text-ink-900">
                {correctCount} of {session.questions.length} correct
              </p>
              <p className="mt-1 text-sm text-ink-600">{correctCount === session.questions.length ? 'Excellent – try a graded quiz when you are ready.' : 'Keep going: revise the lesson for the questions you missed and try another round.'}</p>
              {weak.length > 0 && (
                <p className="mt-2 text-sm text-ink-700">
                  Topics to revise: {weak.map((t) => `${t.topic} (${t.accuracy}%)`).join(', ')}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void startRound()} loading={busy} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
                  Another round
                </Button>
                <Button variant="outline" onClick={() => setSession(null)}>
                  Change month or topic
                </Button>
                <ButtonLink to="/app/quizzes" variant="ghost">
                  Go to quizzes
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      ) : current ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-200 bg-white p-3 sm:p-4">
            <ProgressBar value={(session.index / session.questions.length) * 100} label={`Question ${session.index + 1} of ${session.questions.length}`} showValue={false} size="sm" />
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <Badge size="sm">{current.difficulty}</Badge>
              {current.topic && <Badge size="sm" tone="brand">{current.topic}</Badge>}
              <span>Practice – not graded</span>
            </p>
          </div>
          <QuestionRenderer question={current} index={session.index} value={answer} onChange={(v) => setAnswer(v)} disabled={Boolean(feedback) || busy} feedback={feedback ?? undefined} />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-ink-200 bg-white p-4">
            {feedback ? (
              <Button onClick={next} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                {session.index + 1 < session.questions.length ? 'Next question' : 'See results'}
              </Button>
            ) : (
              <Button onClick={() => void check()} loading={busy} disabled={answer === undefined || answer === ''}>
                Check answer
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <Link to="/app/practice" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Practice signs
      </Link>
    </div>
  );
}
