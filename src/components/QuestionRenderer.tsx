import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Select, Textarea } from '@/components/ui/Field';
import { resolveMediaUrl } from '@/services/student';
import type { Json, MatchingOptions, McOption, QuizQuestionStudent, ExamQuestionStudent } from '@/types/database';
import { cn } from '@/lib/utils';

type Q = QuizQuestionStudent | ExamQuestionStudent;

export interface QuestionFeedback {
  correct: boolean;
  correct_answer: Json;
  explanation: string | null;
}

/**
 * Renders one question (multiple choice, video multiple choice, matching, practical)
 * with accessible fieldsets. Works for both quizzes and exams.
 */
export function QuestionRenderer({ question, index, value, onChange, feedback, disabled }: { question: Q; index: number; value: Json | undefined; onChange: (v: Json) => void; feedback?: QuestionFeedback; disabled?: boolean }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (question.video_path || question.video_url) {
      resolveMediaUrl(question.video_path, question.video_url).then((u) => !cancelled && setVideoUrl(u)).catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [question.video_path, question.video_url]);

  const isMatching = question.question_type === 'matching';
  const isPractical = question.question_type === 'practical';
  const name = `q-${question.id}`;

  return (
    <fieldset className={cn('rounded-2xl border bg-white p-5', feedback ? (feedback.correct ? 'border-success-100' : 'border-danger-100') : 'border-ink-200')} disabled={disabled}>
      <legend className="sr-only">Question {index + 1}</legend>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-500">
          Question {index + 1} <span className="font-normal">· {question.points} point{question.points === 1 ? '' : 's'}</span>
        </p>
        {feedback && (
          <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', feedback.correct ? 'text-success-700' : 'text-danger-700')}>
            {feedback.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
            {feedback.correct ? 'Correct' : 'Incorrect'}
          </span>
        )}
      </div>
      <p className="mt-1 text-base font-medium text-ink-900">{question.prompt}</p>
      {(question.video_path || question.video_url) && (
        <div className="mt-3 max-w-xl">
          <VideoPlayer src={videoUrl} title={`Video for question ${index + 1}`} compact loop />
        </div>
      )}

      {!isMatching && !isPractical && (
        <div className="mt-4 space-y-2">
          {(question.options as McOption[]).map((o) => {
            const checked = value === o.id;
            const isCorrect = feedback && feedback.correct_answer === o.id;
            return (
              <label key={o.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/35', checked ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300', isCorrect && 'border-success-500 bg-success-50', feedback && checked && !feedback.correct && 'border-danger-500 bg-danger-50')}>
                <input type="radio" name={name} value={o.id} checked={checked} onChange={() => onChange(o.id)} className="mt-0.5 h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500" />
                <span className="flex-1 text-ink-900">{o.text}</span>
                {isCorrect && <span className="text-xs font-semibold text-success-700">Correct answer</span>}
              </label>
            );
          })}
        </div>
      )}

      {isMatching && (
        <MatchingInput options={question.options as MatchingOptions} value={(value as Record<string, string> | undefined) ?? {}} onChange={(v) => onChange(v)} correct={feedback ? (feedback.correct_answer as Record<string, string>) : undefined} />
      )}

      {isPractical && (
        <Textarea wrapperClassName="mt-4" label="Your notes for the trainer" hint="Describe how you performed the sign, or paste a link to a video if your trainer asked for one. Your trainer grades this question." rows={4} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {feedback?.explanation && (
        <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
          <span className="font-semibold">Explanation: </span>
          {feedback.explanation}
        </div>
      )}
    </fieldset>
  );
}

function MatchingInput({ options, value, onChange, correct }: { options: MatchingOptions; value: Record<string, string>; onChange: (v: Record<string, string>) => void; correct?: Record<string, string> }) {
  const rightById = new Map(options.right.map((r) => [r.id, r.text]));
  return (
    <div className="mt-4 space-y-3">
      {options.left.map((l) => {
        const isRight = correct ? correct[l.id] === value[l.id] : undefined;
        return (
          <div key={l.id} className={cn('grid gap-2 rounded-xl border p-3 sm:grid-cols-2 sm:items-center', isRight === true && 'border-success-200 bg-success-50', isRight === false && 'border-danger-200 bg-danger-50', isRight === undefined && 'border-ink-200')}>
            <p className="text-sm font-medium text-ink-900">{l.text}</p>
            <Select label={<span className="sr-only">Match for {l.text}</span>} placeholder="Choose a match" value={value[l.id] ?? ''} onChange={(e) => onChange({ ...value, [l.id]: e.target.value })} options={options.right.map((r) => ({ value: r.id, label: r.text }))} />
            {isRight === false && correct && <p className="text-xs text-success-700 sm:col-span-2">Correct: {rightById.get(correct[l.id]!)}</p>}
          </div>
        );
      })}
    </div>
  );
}
