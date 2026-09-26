import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listQuizAttemptsFor, listAllCourses, getQuizAttemptDetail } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { Json, MatchingOptions, McOption } from '@/types/database';

type Row = Awaited<ReturnType<typeof listQuizAttemptsFor>>[number];

/** Human-readable answer for a snapshot question (option text rather than option id). */
function describeAnswer(options: McOption[] | MatchingOptions, answer: Json | null | undefined): string {
  if (answer == null || answer === '') return '—';
  if (Array.isArray(options)) return options.find((o) => o.id === answer)?.text ?? String(answer);
  const left = new Map(options.left.map((o) => [o.id, o.text]));
  const right = new Map(options.right.map((o) => [o.id, o.text]));
  if (typeof answer !== 'object' || Array.isArray(answer)) return String(answer);
  return Object.entries(answer as Record<string, string>).map(([l, r]) => `${left.get(l) ?? l} → ${right.get(r) ?? r}`).join('; ');
}

export default function TrainerQuizResultsPage() {
  const [courseId, setCourseId] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const q = useQuery({ queryKey: ['quiz-attempts-all', courseId], queryFn: () => listQuizAttemptsFor(undefined, courseId || undefined) });
  usePageMeta({ title: 'Quiz results', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Quizzes" title="Quiz results" description="Latest quiz attempts by your students. Open an attempt to see exactly which questions that student received and how they answered." />
      <div className="mb-4 max-w-xs">
        <Select label={<span className="sr-only">Course</span>} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={[{ value: '', label: 'All courses' }, ...(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
      </div>
      <DataTable<Row>
        caption="Quiz attempts"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(r) => r.id}
        empty={<EmptyState title="No quiz attempts yet" />}
        onRowClick={(r) => setOpen(r)}
        columns={[
          { key: 'student', header: 'Student', primary: true, cell: (r) => r.enrollment?.student?.full_name ?? '—' },
          { key: 'quiz', header: 'Quiz', cell: (r) => r.quiz?.title },
          { key: 'attempt', header: 'Attempt', cell: (r) => r.attempt_number },
          { key: 'score', header: 'Score', cell: (r) => (r.status === 'submitted' ? <span className="font-semibold tabular-nums">{r.score ?? 0}%</span> : <span className="text-ink-500">—</span>), align: 'right' },
          { key: 'passed', header: 'Result', cell: (r) => (r.status !== 'submitted' ? <Badge tone="info" size="sm">In progress</Badge> : r.passed ? <Badge tone="success" size="sm">Passed</Badge> : <Badge size="sm">Not passed</Badge>) },
          { key: 'when', header: 'Submitted', cell: (r) => (r.submitted_at ? formatDateTime(r.submitted_at) : `started ${formatDateTime(r.started_at)}`), hideOnMobile: true },
        ]}
      />
      {open && <AttemptDetailDialog row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AttemptDetailDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['quiz-attempt-detail', row.id], queryFn: () => getQuizAttemptDetail(row.id) });
  return (
    <Dialog open onClose={onClose} title={`${row.enrollment?.student?.full_name ?? 'Student'} – ${row.quiz?.title ?? 'quiz'} (attempt ${row.attempt_number})`} size="xl">
      {detail.isLoading ? (
        <Skeleton lines={5} />
      ) : detail.isError ? (
        <Alert tone="danger">{friendlyError(detail.error)}</Alert>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600">
            {detail.data!.attempt.status === 'submitted' ? `Score ${detail.data!.attempt.score ?? 0}% (${detail.data!.attempt.earned_points ?? 0}/${detail.data!.attempt.total_points ?? 0} points)` : 'In progress'}
            {' · '}quiz version {detail.data!.attempt.quiz_version ?? '—'} · questions snapshotted {detail.data!.attempt.bank_snapshot_at ? formatDateTime(detail.data!.attempt.bank_snapshot_at) : '—'}
          </p>
          <ol className="space-y-2">
            {detail.data!.questions.map((qq) => (
              <li key={qq.id} className="rounded-xl border border-ink-200 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium text-ink-900">
                    {qq.position}. {qq.prompt}
                  </span>
                  {qq.is_correct == null ? <Badge size="sm">Unanswered</Badge> : qq.is_correct ? <Badge tone="success" size="sm">Correct</Badge> : <Badge tone="danger" size="sm">Incorrect</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {qq.topic ?? 'no topic'} · {qq.difficulty ?? 'medium'} · {qq.points} pt · question v{qq.question_version}
                </p>
                <p className="mt-1">
                  <span className="text-ink-500">Answered:</span> {describeAnswer(qq.options, qq.answer)}
                </p>
                {!qq.is_correct && (
                  <p>
                    <span className="text-ink-500">Correct:</span> {describeAnswer(qq.options, qq.correct_answer)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Dialog>
  );
}
