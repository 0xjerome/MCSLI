import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ChevronDown, Download, ExternalLink, ListChecks } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { getLesson, listModulesWithLessons, listLessonProgress, saveLessonProgress, listLessonResources, resolveMediaUrl } from '@/services/student';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Skeleton, ErrorState, Breadcrumb } from '@/components/ui/Misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { LockedCard } from '@/components/LockedCard';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import type { LockReason } from '@/domain/types';

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const { enrollment, isLoading } = useMyEnrollment();
  const qc = useQueryClient();
  const toast = useToast();
  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => getLesson(lessonId) });
  const monthId = lesson.data?.module?.month_id;
  const modules = useQuery({ queryKey: ['modules', monthId], queryFn: () => listModulesWithLessons(monthId!), enabled: Boolean(monthId) });
  const progress = useQuery({ queryKey: ['lesson-progress', enrollment?.id], queryFn: () => listLessonProgress(enrollment!.id), enabled: Boolean(enrollment) });
  const resources = useQuery({ queryKey: ['lesson-resources', lessonId], queryFn: () => listLessonResources(lessonId), enabled: Boolean(lesson.data) });
  const map = useCourseMap(enrollment?.id);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<'about' | 'transcript' | 'resources'>('about');
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  usePageMeta({ title: lesson.data?.title ?? 'Lesson', noIndex: true });

  useEffect(() => {
    const l = lesson.data;
    if (!l) return;
    let cancelled = false;
    Promise.all([resolveMediaUrl(l.video_path, l.video_url), resolveMediaUrl(l.captions_path, l.captions_path?.startsWith('/') ? l.captions_path : null)])
      .then(([v, c]) => {
        if (!cancelled) {
          setVideoUrl(v);
          setCaptionsUrl(c);
        }
      })
      .catch(() => {
        if (!cancelled) setVideoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.data]);

  const lessons = useMemo(() => (modules.data ?? []).flatMap((m) => m.lessons), [modules.data]);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const myProgress = progress.data?.find((p) => p.lesson_id === lessonId);
  const done = new Set((progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const completed = Boolean(myProgress?.completed_at);

  const onProgress = useCallback(
    (seconds: number, duration: number) => {
      if (!lesson.data) return;
      const finished = duration > 0 && seconds >= duration - 1;
      saveLessonProgress(lesson.data.id, seconds, finished).then(() => {
        if (finished) void qc.invalidateQueries({ queryKey: ['lesson-progress'] });
      }).catch(() => undefined);
    },
    [lesson.data, qc],
  );

  const markComplete = async () => {
    if (!lesson.data) return;
    setCompleting(true);
    try {
      await saveLessonProgress(lesson.data.id, myProgress?.last_position_seconds ?? 0, true);
      await qc.invalidateQueries({ queryKey: ['lesson-progress'] });
      await qc.invalidateQueries({ queryKey: ['course-map'] });
      toast.success('Lesson completed', next ? `Next: ${next.title}` : 'You have finished the last lesson of this month.');
    } catch (e) {
      toast.error('Could not save', friendlyError(e));
    } finally {
      setCompleting(false);
    }
  };

  if (isLoading || lesson.isLoading) return <Skeleton className="h-[60vh]" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (lesson.isError) return <ErrorState onRetry={() => lesson.refetch()} />;
  if (!lesson.data) {
    // Either it does not exist or RLS hid it because the month is locked. Explain the lock if we can.
    const locked = map.data?.find((m) => !m.access.allowed);
    return (
      <div className="mx-auto max-w-xl">
        {locked ? <LockedCard title={`Month ${locked.month_number}`} reasons={locked.access.reasons as LockReason[]} /> : <ErrorState title="Lesson not available" description="This lesson does not exist or is not available to you." />}
        <ButtonLink to="/app/course" variant="outline" className="mt-4">
          Back to my course
        </ButtonLink>
      </div>
    );
  }
  const l = lesson.data;
  const month = l.module.month;

  return (
    <div className="lg:grid lg:grid-cols-[18rem,1fr] lg:gap-8">
      {/* Curriculum sidebar (desktop) / collapsible (mobile) */}
      <aside className="mb-4 lg:mb-0">
        <button type="button" className="flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold lg:hidden" aria-expanded={curriculumOpen} aria-controls="curriculum" onClick={() => setCurriculumOpen((o) => !o)}>
          Month {month.month_number} curriculum
          <ChevronDown className={cn('h-4 w-4 transition-transform', curriculumOpen && 'rotate-180')} aria-hidden="true" />
        </button>
        <nav id="curriculum" aria-label="Lessons in this month" className={cn('mt-2 rounded-2xl border border-ink-200 bg-white lg:sticky lg:top-20 lg:mt-0 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto', !curriculumOpen && 'hidden')}>
          <div className="border-b border-ink-200 px-4 py-3">
            <Link to={`/app/course/${enrollment.course_id}/month/${month.id}`} className="text-xs font-semibold uppercase tracking-wider text-brand-700 hover:underline">
              Month {month.month_number} · {month.title}
            </Link>
          </div>
          {(modules.data ?? []).map((mod) => (
            <div key={mod.id} className="border-b border-ink-100 last:border-0">
              <p className="px-4 pb-1 pt-3 text-xs font-semibold text-ink-500">{mod.title}</p>
              <ol>
                {mod.lessons.map((item) => {
                  const active = item.id === lessonId;
                  return (
                    <li key={item.id}>
                      <Link to={`/app/lessons/${item.id}`} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-2 px-4 py-2 text-sm', active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-700 hover:bg-ink-50')}>
                        {done.has(item.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-label="Completed" /> : <Circle className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />}
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>
      </aside>

      {/* Lesson */}
      <article className="min-w-0">
        <Breadcrumb items={[{ label: 'My course', to: `/app/course/${enrollment.course_id}` }, { label: `Month ${month.month_number}`, to: `/app/course/${enrollment.course_id}/month/${month.id}` }, { label: l.title }]} className="mb-3" />
        <h1 className="text-display-sm">{l.title}</h1>
        <div className="mt-4">
          <VideoPlayer src={videoUrl} captionsSrc={captionsUrl} title={l.title} startAt={myProgress?.last_position_seconds ?? 0} onProgress={onProgress} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {completed ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-success-50 px-4 py-2.5 text-sm font-semibold text-success-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Completed
            </span>
          ) : (
            <Button onClick={markComplete} loading={completing} leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
              Mark as complete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {prev && (
              <ButtonLink to={`/app/lessons/${prev.id}`} variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
                Previous
              </ButtonLink>
            )}
            {next ? (
              <ButtonLink to={`/app/lessons/${next.id}`} variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Next lesson
              </ButtonLink>
            ) : (
              <ButtonLink to={`/app/course/${enrollment.course_id}/month/${month.id}`} variant="secondary" size="sm" rightIcon={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
                Month quizzes
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Tabs aria-label="Lesson details" value={tab} onChange={setTab} tabs={[{ id: 'about', label: 'About' }, { id: 'transcript', label: 'Transcript' }, { id: 'resources', label: 'Resources', count: resources.data?.length }]} />
          <TabPanel id="about" value={tab} className="py-5">
            {l.description && <p className="prose-mcsli">{l.description}</p>}
            {l.objectives.length > 0 && (
              <>
                <h2 className="mt-5 text-sm font-semibold uppercase tracking-wider text-ink-500">Learning objectives</h2>
                <ul className="mt-2 space-y-1.5">
                  {l.objectives.map((o) => (
                    <li key={o} className="flex gap-2 text-sm text-ink-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" /> {o}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </TabPanel>
          <TabPanel id="transcript" value={tab} className="py-5">
            {l.transcript ? <div className="prose-mcsli whitespace-pre-line text-sm">{l.transcript}</div> : <p className="text-sm text-ink-500">No transcript has been added to this lesson yet.</p>}
          </TabPanel>
          <TabPanel id="resources" value={tab} className="py-5">
            {(resources.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-500">No downloadable resources for this lesson.</p>
            ) : (
              <ul className="space-y-2">
                {(resources.data ?? []).map((r) => (
                  <li key={r.id}>
                    <ResourceLink title={r.title} path={r.storage_path} url={r.external_url} downloadable={r.is_downloadable} />
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </div>
      </article>
    </div>
  );
}

function ResourceLink({ title, path, url, downloadable }: { title: string; path: string | null; url: string | null; downloadable: boolean }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const open = async () => {
    if (url) return window.open(url, '_blank', 'noopener');
    if (!path) return;
    setBusy(true);
    try {
      const signed = await resolveMediaUrl(path, null, 'lesson-resources');
      if (signed) window.open(signed, '_blank', 'noopener');
    } catch (e) {
      toast.error('Could not open resource', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={open} loading={busy} leftIcon={url ? <ExternalLink className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} disabled={!downloadable && !url}>
      {title}
    </Button>
  );
}
