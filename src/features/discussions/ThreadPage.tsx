import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, Pin, Megaphone, Lock, EyeOff, Eye, MoreHorizontal } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { isStaff } from '@/domain/roles';
import { getThread, listPosts, createPost, reportContent, moderate } from '@/services/community';
import { Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton, ErrorState, Avatar, Alert } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDateTime } from '@/lib/utils';

export default function ThreadPage() {
  const { threadId = '' } = useParams();
  const { user, role } = useAuth();
  const location = useLocation();
  const base = location.pathname.startsWith('/admin') ? '/admin' : location.pathname.startsWith('/trainer') ? '/trainer' : '/app';
  const staff = isStaff(role);
  const qc = useQueryClient();
  const toast = useToast();
  const thread = useQuery({ queryKey: ['thread', threadId], queryFn: () => getThread(threadId) });
  const posts = useQuery({ queryKey: ['posts', threadId], queryFn: () => listPosts(threadId), enabled: Boolean(thread.data) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<{ threadId?: string; postId?: string } | null>(null);
  usePageMeta({ title: thread.data?.title ?? 'Discussion', noIndex: true });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['thread', threadId] }), qc.invalidateQueries({ queryKey: ['posts', threadId] }), qc.invalidateQueries({ queryKey: ['threads'] })]);

  if (thread.isLoading) return <Skeleton className="h-96" />;
  if (thread.isError) return <ErrorState onRetry={() => thread.refetch()} />;
  if (!thread.data) return <ErrorState title="Discussion not found" description="It may have been removed or you may not have access." />;
  const t = thread.data;

  const reply = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await createPost({ threadId: t.id, authorId: user.id, body: String(fd.get('body')) });
      await refresh();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const doModerate = async (input: Parameters<typeof moderate>[0], msg: string) => {
    try {
      await moderate(input);
      await refresh();
      toast.success(msg);
    } catch (err) {
      toast.error('Moderation failed', friendlyError(err));
    }
  };

  const submitReport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !report) return;
    const fd = new FormData(e.currentTarget);
    try {
      await reportContent({ ...report, reporterId: user.id, reason: String(fd.get('reason')) });
      setReport(null);
      toast.success('Reported', 'Thank you — a trainer or admin will review it.');
    } catch (err) {
      toast.error('Could not report', friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`${base}/discussions`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All discussions
      </Link>
      <article className="mt-4 rounded-2xl border border-ink-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Avatar name={t.author?.full_name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {t.is_pinned && <Pin className="h-4 w-4 text-accent-600" aria-label="Pinned" />}
              {t.is_announcement && <Badge tone="accent" size="sm" icon={<Megaphone className="h-3 w-3" aria-hidden="true" />}>Announcement</Badge>}
              {t.is_locked && <Badge size="sm" icon={<Lock className="h-3 w-3" aria-hidden="true" />}>Locked</Badge>}
              {t.is_hidden && <Badge tone="danger" size="sm">Hidden</Badge>}
            </div>
            <h1 className="mt-1 text-xl font-semibold text-ink-900">{t.title}</h1>
            <p className="text-xs text-ink-500">
              {t.author?.full_name ?? 'Member'}
              {t.author?.role && t.author.role !== 'STUDENT' ? ` · ${t.author.role.toLowerCase()}` : ''} · {formatDateTime(t.created_at)}
            </p>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-800">{t.body}</p>
          </div>
          <Dropdown
            label="Thread actions"
            items={[
              ...(staff
                ? [
                    { id: 'pin', label: t.is_pinned ? 'Unpin' : 'Pin', icon: <Pin className="h-4 w-4" aria-hidden="true" />, onSelect: () => doModerate({ threadId: t.id, pinned: !t.is_pinned, hidden: t.is_hidden }, t.is_pinned ? 'Unpinned' : 'Pinned') },
                    { id: 'lock', label: t.is_locked ? 'Unlock replies' : 'Lock replies', icon: <Lock className="h-4 w-4" aria-hidden="true" />, onSelect: () => doModerate({ threadId: t.id, locked: !t.is_locked, hidden: t.is_hidden }, t.is_locked ? 'Unlocked' : 'Locked') },
                    { id: 'hide', label: t.is_hidden ? 'Unhide' : 'Hide (remove)', icon: t.is_hidden ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />, danger: !t.is_hidden, onSelect: () => doModerate({ threadId: t.id, hidden: !t.is_hidden }, t.is_hidden ? 'Thread visible again' : 'Thread hidden') },
                  ]
                : []),
              { id: 'report', label: 'Report', icon: <Flag className="h-4 w-4" aria-hidden="true" />, onSelect: () => setReport({ threadId: t.id }) },
            ]}
            trigger={(p) => (
              <button type="button" {...p} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" aria-label="Thread actions">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          />
        </div>
      </article>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-500">{posts.data?.length ?? 0} replies</h2>
      <ol className="mt-3 space-y-3">
        {posts.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          (posts.data ?? []).map((p) => {
            const isTrainer = p.author?.role && p.author.role !== 'STUDENT';
            return (
              <li key={p.id} className={cn('flex gap-3 rounded-2xl border bg-white p-4', isTrainer ? 'border-brand-200' : 'border-ink-200', p.is_hidden && 'opacity-60')}>
                <Avatar name={p.author?.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span className="font-semibold text-ink-800">{p.author?.full_name ?? 'Member'}</span>
                    {isTrainer && <Badge tone="brand" size="sm">{p.author!.role === 'TRAINER' ? 'Trainer' : 'MCSLI'}</Badge>}
                    {p.is_hidden && <Badge tone="danger" size="sm">Hidden</Badge>}
                    <span>{formatDateTime(p.created_at)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-800">{p.body}</p>
                </div>
                <Dropdown
                  label="Reply actions"
                  items={[
                    ...(staff ? [{ id: 'hide', label: p.is_hidden ? 'Unhide' : 'Hide (remove)', danger: !p.is_hidden, onSelect: () => doModerate({ postId: p.id, hidden: !p.is_hidden }, p.is_hidden ? 'Reply visible again' : 'Reply hidden') }] : []),
                    { id: 'report', label: 'Report', icon: <Flag className="h-4 w-4" aria-hidden="true" />, onSelect: () => setReport({ postId: p.id }) },
                  ]}
                  trigger={(pp) => (
                    <button type="button" {...pp} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Reply actions">
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                />
              </li>
            );
          })
        )}
      </ol>

      {t.is_locked && !staff ? (
        <Alert tone="neutral" className="mt-6">
          This discussion is locked; no more replies can be added.
        </Alert>
      ) : (
        <form onSubmit={reply} className="mt-6 rounded-2xl border border-ink-200 bg-white p-4">
          <Textarea name="body" label="Write a reply" required minLength={1} rows={4} />
          {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
          <Button type="submit" className="mt-3" loading={busy}>
            Reply
          </Button>
        </form>
      )}

      <Dialog open={Boolean(report)} onClose={() => setReport(null)} title="Report content" description="Tell us what is wrong. Trainers and admins review every report.">
        <form onSubmit={submitReport} className="space-y-3">
          <Textarea name="reason" label="Reason" required minLength={3} rows={3} data-autofocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setReport(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Submit report
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
