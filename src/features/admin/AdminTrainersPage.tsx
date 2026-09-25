import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, UserCog } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listProfiles, listAllCourses, listCohorts, listTrainerAssignments, addTrainerAssignment, removeTrainerAssignment, saveCohort } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select, Checkbox, Input } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { Link } from 'react-router-dom';

export default function AdminTrainersPage() {
  const toast = useToast();
  const trainers = useQuery({ queryKey: ['profiles', 'TRAINER'], queryFn: () => listProfiles({ role: 'TRAINER', pageSize: 100 }) });
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses });
  const cohorts = useQuery({ queryKey: ['cohorts'], queryFn: () => listCohorts() });
  const assignments = useQuery({ queryKey: ['trainer-assignments'], queryFn: listTrainerAssignments });
  const [assigning, setAssigning] = useState(false);
  const [newCohort, setNewCohort] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: 'Trainers', noIndex: true });

  if (trainers.isError) return <ErrorState onRetry={() => trainers.refetch()} />;

  const assign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await addTrainerAssignment({ trainerId: String(fd.get('trainer_id')), courseId: String(fd.get('course_id')), cohortId: String(fd.get('cohort_id')) || null, canGradeExams: fd.get('grade') === 'on', canModerate: fd.get('moderate') === 'on' });
      await assignments.refetch();
      setAssigning(false);
      toast.success('Trainer assigned');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const createCohort = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await saveCohort({ course_id: String(fd.get('course_id')), name: String(fd.get('name')).trim(), start_date: String(fd.get('start_date')) || null, is_open: true });
      await cohorts.refetch();
      setNewCohort(false);
      toast.success('Cohort created');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="People" title="Trainers" description="Trainer accounts and the courses/cohorts they may assess. Promote a student to trainer from their account page." actions={<><Button variant="outline" onClick={() => setNewCohort(true)}>New cohort</Button><Button onClick={() => setAssigning(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Assign trainer</Button></>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Trainer accounts" />
          {trainers.isLoading ? (
            <Skeleton lines={4} />
          ) : (trainers.data?.rows ?? []).length === 0 ? (
            <EmptyState compact icon={<UserCog className="h-5 w-5" />} title="No trainers yet" description="Open a student's account and change the role to TRAINER." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(trainers.data?.rows ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link to={`/admin/students/${t.id}`} className="font-medium text-ink-900 hover:underline">
                      {t.full_name}
                    </Link>
                    <p className="text-xs text-ink-500">{t.email}</p>
                  </div>
                  <Badge size="sm">{(assignments.data ?? []).filter((a) => a.trainer_id === t.id).length} assignment(s)</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Assignments" description="A trainer can only see and assess students in their assigned courses/cohorts." />
          {(assignments.data ?? []).length === 0 ? (
            <EmptyState compact title="No assignments" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {(assignments.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-ink-900">{a.trainer?.full_name}</span> → {a.course?.title}
                    {a.cohort ? ` · ${a.cohort.name}` : ' · all cohorts'}
                    <span className="ml-2 text-xs text-ink-500">{[a.can_grade_exams && 'grades exams', a.can_moderate && 'moderates'].filter(Boolean).join(', ')}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove assignment"
                    onClick={async () => {
                      if (!window.confirm('Remove this assignment?')) return;
                      try {
                        await removeTrainerAssignment(a.id);
                        await assignments.refetch();
                      } catch (err) {
                        toast.error('Failed', friendlyError(err));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Cohorts" />
          {(cohorts.data ?? []).length === 0 ? (
            <EmptyState compact title="No cohorts" description="Cohorts group students (e.g. 'Online Cohort 7') so trainers can be assigned to them." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(cohorts.data ?? []).map((c) => (
                <li key={c.id} className="rounded-xl border border-ink-200 p-3 text-sm">
                  <p className="font-medium text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">
                    {courses.data?.find((x) => x.id === c.course_id)?.title} · {c.start_date ?? 'no start date'} · {c.is_open ? 'open' : 'closed'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={assigning} onClose={() => setAssigning(false)} title="Assign a trainer">
        <form onSubmit={assign} className="space-y-4">
          <Select name="trainer_id" label="Trainer" required placeholder="Choose trainer" options={(trainers.data?.rows ?? []).map((t) => ({ value: t.id, label: t.full_name }))} data-autofocus />
          <Select name="course_id" label="Course" required placeholder="Choose course" options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
          <Select name="cohort_id" label="Cohort" optionalLabel placeholder="All cohorts" options={(cohorts.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          <Checkbox name="grade" label="Can grade examinations" defaultChecked />
          <Checkbox name="moderate" label="Can moderate discussions" defaultChecked />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Assign
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={newCohort} onClose={() => setNewCohort(false)} title="New cohort">
        <form onSubmit={createCohort} className="space-y-4">
          <Select name="course_id" label="Course" required placeholder="Choose course" options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} data-autofocus />
          <Input name="name" label="Cohort name" required placeholder="e.g. Online Cohort 7" />
          <Input name="start_date" type="date" label="Start date" optionalLabel />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewCohort(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
