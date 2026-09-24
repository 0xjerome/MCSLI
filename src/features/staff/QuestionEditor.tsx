import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';
import type { Json, MatchingOptions, McOption, QuestionType } from '@/types/database';

export interface QuestionDraft {
  id?: string;
  position: number;
  question_type: QuestionType;
  prompt: string;
  video_url: string | null;
  video_path: string | null;
  options: McOption[] | MatchingOptions;
  correct_answer: Json | null;
  explanation?: string | null;
  points: number;
  requires_manual_grading?: boolean;
}

const emptyMc = (): McOption[] => [
  { id: 'a', text: '' },
  { id: 'b', text: '' },
  { id: 'c', text: '' },
  { id: 'd', text: '' },
];
const emptyMatching = (): MatchingOptions => ({ left: [{ id: 'l1', text: '' }, { id: 'l2', text: '' }], right: [{ id: 'r1', text: '' }, { id: 'r2', text: '' }] });

/**
 * Reusable editor for quiz and exam questions (multiple choice, video MC, matching, practical).
 * Correct answers are only ever sent to staff-only RPCs/tables.
 */
export function QuestionEditor({ initial, allowPractical, showExplanation, onSave, onCancel, busy }: { initial?: Partial<QuestionDraft>; allowPractical?: boolean; showExplanation?: boolean; onSave: (q: QuestionDraft) => Promise<void>; onCancel: () => void; busy?: boolean }) {
  const [type, setType] = useState<QuestionType>(initial?.question_type ?? 'multiple_choice');
  const [mc, setMc] = useState<McOption[]>(initial && Array.isArray(initial.options) ? (initial.options as McOption[]) : emptyMc());
  const [matching, setMatching] = useState<MatchingOptions>(initial && initial.options && !Array.isArray(initial.options) ? (initial.options as MatchingOptions) : emptyMatching());
  const [correctMc, setCorrectMc] = useState<string>(typeof initial?.correct_answer === 'string' ? initial.correct_answer : 'a');
  const [correctMatching, setCorrectMatching] = useState<Record<string, string>>(initial?.correct_answer && typeof initial.correct_answer === 'object' && !Array.isArray(initial.correct_answer) ? (initial.correct_answer as Record<string, string>) : {});
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get('prompt')).trim();
    if (prompt.length < 3) return setError('Enter the question text.');
    let options: McOption[] | MatchingOptions = [];
    let correct: Json | null = null;
    if (type === 'multiple_choice' || type === 'video_multiple_choice') {
      const filled = mc.filter((o) => o.text.trim());
      if (filled.length < 2) return setError('Provide at least two answer options.');
      if (!filled.some((o) => o.id === correctMc)) return setError('Mark the correct option.');
      options = filled;
      correct = correctMc;
      if (type === 'video_multiple_choice' && !String(fd.get('video_url')).trim()) return setError('A video URL/path is required for a video question.');
    } else if (type === 'matching') {
      const left = matching.left.filter((o) => o.text.trim());
      const right = matching.right.filter((o) => o.text.trim());
      if (left.length < 2 || right.length < 2) return setError('Provide at least two items on each side.');
      for (const l of left) if (!correctMatching[l.id]) return setError(`Choose the correct match for "${l.text}".`);
      options = { left, right };
      correct = Object.fromEntries(left.map((l) => [l.id, correctMatching[l.id]!]));
    }
    setError('');
    const video = String(fd.get('video_url')).trim();
    await onSave({
      id: initial?.id,
      position: Number(fd.get('position')) || 1,
      question_type: type,
      prompt,
      video_url: video && /^https?:\/\//.test(video) ? video : video.startsWith('/') ? video : null,
      video_path: video && !/^https?:\/\//.test(video) && !video.startsWith('/') ? video : null,
      options,
      correct_answer: correct,
      explanation: showExplanation ? String(fd.get('explanation')).trim() || null : undefined,
      points: Math.max(1, Number(fd.get('points')) || 1),
      requires_manual_grading: type === 'practical' || fd.get('manual') === 'on',
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Question type"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          options={[
            { value: 'multiple_choice', label: 'Multiple choice' },
            { value: 'video_multiple_choice', label: 'Video + multiple choice' },
            { value: 'matching', label: 'Matching' },
            ...(allowPractical ? [{ value: 'practical', label: 'Practical (trainer-graded)' }] : []),
          ]}
        />
        <Input name="position" label="Position" type="number" min={1} defaultValue={initial?.position ?? 1} />
        <Input name="points" label="Points" type="number" min={1} defaultValue={initial?.points ?? 1} />
      </div>
      <Textarea name="prompt" label="Question" required rows={3} defaultValue={initial?.prompt ?? ''} data-autofocus />
      <Input name="video_url" label="Video (URL, /public path, or course-media storage path)" optionalLabel defaultValue={initial?.video_url ?? initial?.video_path ?? ''} hint="Use an https:// link, a /demo/… path, or the storage path of a file uploaded to course-media." />

      {(type === 'multiple_choice' || type === 'video_multiple_choice') && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-800">Options (select the correct one)</legend>
          <div className="space-y-2">
            {mc.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={correctMc === o.id} onChange={() => setCorrectMc(o.id)} aria-label={`Option ${o.id.toUpperCase()} is correct`} className="h-4 w-4 text-brand-600" />
                <span className="w-5 text-xs font-bold uppercase text-ink-500">{o.id}</span>
                <Input label={<span className="sr-only">Option {o.id} text</span>} wrapperClassName="flex-1" value={o.text} onChange={(e) => setMc((m) => m.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                {mc.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove option ${o.id}`} onClick={() => setMc((m) => m.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {mc.length < 6 && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setMc((m) => [...m, { id: String.fromCharCode(97 + m.length), text: '' }])}>
              Add option
            </Button>
          )}
        </fieldset>
      )}

      {type === 'matching' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-800">Left items</legend>
            {matching.left.map((l, i) => (
              <div key={l.id} className="mb-2 space-y-1">
                <Input label={<span className="sr-only">Left item {i + 1}</span>} value={l.text} onChange={(e) => setMatching((m) => ({ ...m, left: m.left.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} />
                <Select label={<span className="sr-only">Correct match for item {i + 1}</span>} value={correctMatching[l.id] ?? ''} onChange={(e) => setCorrectMatching((c) => ({ ...c, [l.id]: e.target.value }))} placeholder="Correct match…" options={matching.right.map((r) => ({ value: r.id, label: r.text || r.id }))} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setMatching((m) => ({ ...m, left: [...m.left, { id: `l${m.left.length + 1}`, text: '' }] }))}>
              Add left item
            </Button>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-800">Right items</legend>
            {matching.right.map((r, i) => (
              <Input key={r.id} wrapperClassName="mb-2" label={<span className="sr-only">Right item {i + 1}</span>} value={r.text} onChange={(e) => setMatching((m) => ({ ...m, right: m.right.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} />
            ))}
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setMatching((m) => ({ ...m, right: [...m.right, { id: `r${m.right.length + 1}`, text: '' }] }))}>
              Add right item
            </Button>
          </fieldset>
        </div>
      )}

      {type === 'practical' && <Alert tone="info">Practical questions cannot be auto-graded. The student writes notes (or a link) and the trainer awards points during grading.</Alert>}
      {type !== 'practical' && allowPractical && <Checkbox name="manual" label="Requires manual grading anyway" defaultChecked={initial?.requires_manual_grading} />}
      {showExplanation && <Textarea name="explanation" label="Explanation shown after answering" optionalLabel rows={2} defaultValue={initial?.explanation ?? ''} />}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save question
        </Button>
      </div>
    </form>
  );
}
