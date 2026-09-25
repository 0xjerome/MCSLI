import { useState, type FormEvent } from 'react';
import { friendlyError } from '@/lib/supabase';
import { recordAssessment, type AssessmentRow } from '@/services/staff';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, RadioCards } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import type { AssessmentResult } from '@/domain/types';

/**
 * Trainer records a monthly assessment outcome. PASS unlocks progression server-side;
 * NOT PASSED creates a reassessment and notifies the student.
 */
export function RecordAssessmentDialog({ assessment, onClose, onRecorded }: { assessment: AssessmentRow | null; onClose: () => void; onRecorded?: () => void | Promise<unknown> }) {
  const toast = useToast();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assessment || !result) return setError('Choose PASS or NOT PASSED.');
    const fd = new FormData(e.currentTarget);
    const scoreRaw = String(fd.get('score'));
    const score = scoreRaw === '' ? null : Number(scoreRaw);
    setBusy(true);
    setError('');
    try {
      await recordAssessment({ assessmentId: assessment.id, score, result, feedback: String(fd.get('feedback')) || undefined, notes: String(fd.get('notes')) || undefined });
      toast.success(result === 'pass' ? 'Recorded as PASS' : 'Recorded as NOT PASSED', result === 'pass' ? 'The next month unlocks automatically once payment conditions are met.' : 'A reassessment has been created and the student notified.');
      setResult(null);
      onClose();
      await onRecorded?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(assessment)} onClose={onClose} title={assessment ? `Record assessment – ${assessment.enrollment?.student?.full_name ?? 'Student'}` : ''} description={assessment ? `Month ${assessment.month.month_number} · ${assessment.month.title}${assessment.is_reassessment ? ' · reassessment' : ''}` : undefined} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <RadioCards<AssessmentResult>
          name="result"
          legend="Result"
          value={result}
          onChange={setResult}
          columns={2}
          options={[
            { value: 'pass', title: 'PASS', description: 'Student demonstrated the month\'s competencies. Unlocks the next month (subject to payment).' },
            { value: 'not_passed', title: 'NOT PASSED', description: 'Requires another attempt. The student reviews the material and is reassessed.' },
          ]}
        />
        <Input name="score" label="Score (0–100)" type="number" min={0} max={100} optionalLabel hint="Optional numeric score shown to the student." />
        <Textarea name="feedback" label="Feedback to the student" rows={4} hint="Shown to the student. Be specific: what was strong, what to practise." />
        <Textarea name="notes" label="Internal notes" optionalLabel rows={2} hint="Visible to trainers and admins only." />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save result
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
