import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listAssessments, cancelAssessment, type AssessmentRow } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { DataTable } from '@/components/ui/DataTable';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { RecordAssessmentDialog } from './RecordAssessmentDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

export default function TrainerAssessmentsPage() {
  const location = useLocation();
  const isReassessRoute = location.pathname.endsWith('/reassessments');
  const base = location.pathname.startsWith('/admin') ? '/admin/enrollments' : '/trainer/students';
  const [tab, setTab] = useState<'scheduled' | 'reassessments' | 'completed'>(isReassessRoute ? 'reassessments' : 'scheduled');
  const q = useQuery({ queryKey: ['assessments', tab], queryFn: () => listAssessments(tab === 'completed' ? { status: 'completed' } : { status: 'scheduled', reassessment: tab === 'reassessments' }) });
  const [recordFor, setRecordFor] = useState<AssessmentRow | null>(null);
  const toast = useToast();
  usePageMeta({ title: 'Assessments', noIndex: true });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Assessments" title="Monthly assessments" description="Record results after each live assessment. PASS unlocks the next month automatically once payment conditions are met; NOT PASSED opens a reassessment." />
      <Tabs aria-label="Assessment lists" value={tab} onChange={setTab} className="mb-4" tabs={[{ id: 'scheduled', label: 'Awaiting result' }, { id: 'reassessments', label: 'Reassessments' }, { id: 'completed', label: 'Completed' }]} />
      <DataTable<AssessmentRow>
        caption="Assessments"
        rows={q.data}
        loading={q.isLoading}
        rowKey={(a) => a.id}
        empty={<EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="Nothing here" description={tab === 'completed' ? 'No completed assessments yet.' : 'Schedule assessments from a student\'s page when they finish a month.'} />}
        columns={[
          { key: 'student', header: 'Student', primary: true, cell: (a) => <Link to={`${base}/${a.enrollment.id}`} className="hover:underline">{a.enrollment.student.full_name}</Link> },
          { key: 'course', header: 'Course', cell: (a) => a.enrollment.course.title, hideOnMobile: true },
          { key: 'month', header: 'Month', cell: (a) => `Month ${a.month.month_number}` },
          { key: 'type', header: 'Type', cell: (a) => (a.is_reassessment ? <Badge tone="warning" size="sm">Reassessment</Badge> : <Badge size="sm">First attempt</Badge>) },
          { key: 'when', header: 'Scheduled', cell: (a) => (a.scheduled_at ? formatDateTime(a.scheduled_at) : 'To be arranged') },
          { key: 'trainer', header: 'Trainer', cell: (a) => a.trainer?.full_name ?? 'Unassigned', hideOnMobile: true },
        ]}
        rowActions={(a) =>
          a.status === 'scheduled' ? (
            <div className="flex justify-end gap-1">
              <Button size="sm" onClick={() => setRecordFor(a)}>
                Record result
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm('Cancel this scheduled assessment?')) return;
                  try {
                    await cancelAssessment(a.id);
                    await q.refetch();
                  } catch (err) {
                    toast.error('Failed', friendlyError(err));
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Badge tone="success" size="sm">Recorded</Badge>
          )
        }
      />
      <RecordAssessmentDialog assessment={recordFor} onClose={() => setRecordFor(null)} onRecorded={() => q.refetch()} />
    </>
  );
}
