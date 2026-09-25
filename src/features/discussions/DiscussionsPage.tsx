import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Pin, Megaphone, Plus, Lock } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { isStaff } from '@/domain/roles';
import { useMyEnrollment, useCourseMap } from '@/features/student/useEnrollment';
import { listThreads, createThread } from '@/services/community';
import { listAllCourses, listMonths } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Field';
import { EmptyState, Skeleton, ErrorState, Alert, Avatar } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/utils';

export default function DiscussionsPage() {
  const { user, role } = useAuth();
  const location = useLocation();
  const staff = isStaff(role) && !location.pathname.startsWith('/app');
  const base = location.pathname.startsWith('/admin') ? '/admin' : location.pathname.startsWith('/trainer') ? '/trainer' : '/app';
  const qc = useQueryClient();
  const { enrollment, isLoading: enrLoading } = useMyEnrollment();
  const courses = useQuery({ queryKey: ['staff-courses'], queryFn: listAllCourses, enabled: staff });
  const [courseId, setCourseId] = useState<string>('');
  const activeCourse = staff ? courseId || courses.data?.[0]?.id || '' : enrollment?.course_id ?? '';
  const [monthFilter, setMonthFilter] = useState<string>('');
  const map = useCourseMap(!staff ? enrollment?.id : null);
  const months = useQuery({ queryKey: ['months', activeCourse], queryFn: () => listMonths(activeCourse), enabled: staff && Boolean(activeCourse) });
  const threads = useQuery({ queryKey: ['threads', activeCourse, monthFilter], queryFn: () => listThreads(activeCourse, monthFilter || null), enabled: Boolean(activeCourse) });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: 'Discussions', noIndex: true });

  const monthOptions = (staff ? months.data ?? [] : (map.data ?? []).filter((m) => m.access.allowed)).map((m) => ({ value: m.id, label: `Month ${m.month_number}` }));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !activeCourse) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const id = await createThread({ courseId: activeCourse, monthId: String(fd.get('month_id')) || null, authorId: user.id, title: String(fd.get('title')), body: String(fd.get('body')), isAnnouncement: staff && fd.get('announcement') === 'on', isPinned: staff && fd.get('pinned') === 'on' });
      await qc.invalidateQueries({ queryKey: ['threads'] });
      setOpen(false);
      window.location.assign(`${base}/discussions/${id}`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!staff && enrLoading) return <Skeleton className="h-96" />;
  if (!staff && !enrollment) return <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="Enroll to join discussions" description="Course discussions open once you are enrolled." />;

  return (
    <>
      <PageHeader eyebrow="Community" title="Discussions" description="Ask questions, share tips and read trainer announcements for your course." actions={activeCourse ? <Button onClick={() => setOpen(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>{staff ? 'New post / announcement' : 'Ask a question'}</Button> : undefined} />
      <div className="mb-4 flex flex-wrap gap-3">
        {staff && (courses.data?.length ?? 0) > 1 && <Select label={<span className="sr-only">Course</span>} value={activeCourse} onChange={(e) => setCourseId(e.target.value)} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} wrapperClassName="w-64" />}
        <Select label={<span className="sr-only">Month</span>} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} options={[{ value: '', label: 'All months' }, ...monthOptions]} wrapperClassName="w-44" />
      </div>
      {threads.isLoading ? (
        <Skeleton lines={5} />
      ) : threads.isError ? (
        <ErrorState onRetry={() => threads.refetch()} />
      ) : (threads.data ?? []).length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="No discussions yet" description="Be the first to ask a question — trainers and classmates will reply." action={<Button variant="outline" onClick={() => setOpen(true)}>Start a discussion</Button>} />
      ) : (
        <ul className="divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
          {(threads.data ?? []).map((t) => (
            <li key={t.id}>
              <Link to={`${base}/discussions/${t.id}`} className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                <Avatar name={t.author?.full_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {t.is_pinned && <Pin className="h-3.5 w-3.5 text-accent-600" aria-label="Pinned" />}
                    {t.is_announcement && <Badge tone="accent" size="sm" icon={<Megaphone className="h-3 w-3" aria-hidden="true" />}>Announcement</Badge>}
                    {t.is_locked && <Lock className="h-3.5 w-3.5 text-ink-400" aria-label="Locked" />}
                    {t.is_hidden && <Badge tone="danger" size="sm">Hidden</Badge>}
                    <span className="font-medium text-ink-900">{t.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-600">{t.body}</span>
                  <span className="block text-xs text-ink-500">
                    {t.author?.full_name ?? 'Member'}
                    {t.author?.role && t.author.role !== 'STUDENT' ? ` (${t.author.role.toLowerCase()})` : ''} · {relativeTime(t.created_at)} · {t.posts?.[0]?.count ?? 0} replies
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={staff ? 'New post' : 'Ask a question'} size="lg">
        <form onSubmit={submit} className="space-y-4" id="new-thread">
          <Input name="title" label="Title" required minLength={3} maxLength={200} data-autofocus />
          <Select name="month_id" label="Related month" optionalLabel placeholder="General / whole course" options={monthOptions} />
          <Textarea name="body" label="Your question or message" required minLength={1} rows={6} />
          {staff && (
            <div className="flex flex-wrap gap-6">
              <Checkbox name="announcement" label="Post as announcement" description="Notifies every enrolled student." />
              <Checkbox name="pinned" label="Pin to top" />
            </div>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Post
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
