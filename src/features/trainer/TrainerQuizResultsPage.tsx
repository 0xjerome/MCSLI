import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageMeta } from '@/lib/seo';
import { listQuizAttemptsFor, listAllCourses } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';

type Row = Awaited<ReturnType<typeof listQuizAttemptsFor>>[number];

export default function TrainerQuizResultsPage() {
  const [courseId, setCourseId] = useState('');
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const q = useQuery({ queryKey: ['quiz-attempts-all', courseId], queryFn: () => listQuizAttemptsFor(undefined, courseId || undefined) });
  usePageMeta({ title: 'Quiz results', noIndex: true });
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Quizzes" title="Quiz results" description="Latest quiz attempts by your students." />
      <div className="mb-4 max-w-xs">
        <Select label={<span className="sr-only">Course</span>} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={[{ value: '', label: 'All courses' }, ...(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
      </div>
      <DataTable<Row>
        caption="Quiz attempts"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(r) => r.id}
        empty={<EmptyState title="No quiz attempts yet" />}
        columns={[
          { key: 'student', header: 'Student', primary: true, cell: (r) => r.enrollment?.student?.full_name ?? '—' },
          { key: 'quiz', header: 'Quiz', cell: (r) => r.quiz?.title },
          { key: 'attempt', header: 'Attempt', cell: (r) => r.attempt_number },
          { key: 'score', header: 'Score', cell: (r) => <span className="font-semibold tabular-nums">{r.score}%</span>, align: 'right' },
          { key: 'passed', header: 'Result', cell: (r) => (r.passed ? <Badge tone="success" size="sm">Passed</Badge> : <Badge size="sm">Not passed</Badge>) },
          { key: 'when', header: 'Submitted', cell: (r) => formatDateTime(r.submitted_at), hideOnMobile: true },
        ]}
      />
    </>
  );
}
