import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, CameraOff, FlipHorizontal2, Sparkles, Hand } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useMyEnrollment, useCourseMap } from './useEnrollment';
import { listPracticeItems, resolveMediaUrl } from '@/services/student';
import { VideoPlayer } from '@/components/VideoPlayer';
import { PageHeader } from '@/app/layouts/Shell';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { PracticeItem } from '@/types/database';

export default function PracticePage() {
  const { enrollment, isLoading } = useMyEnrollment();
  const map = useCourseMap(enrollment?.id);
  const unlocked = (map.data ?? []).filter((m) => m.access.allowed);
  const [monthId, setMonthId] = useState<string>('');
  const activeMonth = monthId || unlocked[unlocked.length - 1]?.id || '';
  const items = useQuery({ queryKey: ['practice', activeMonth], queryFn: () => listPracticeItems(activeMonth), enabled: Boolean(activeMonth) });
  const [selected, setSelected] = useState<PracticeItem | null>(null);
  usePageMeta({ title: 'Practice signs', noIndex: true });

  useEffect(() => {
    if (items.data?.length && (!selected || !items.data.some((i) => i.id === selected.id))) setSelected(items.data[0]!);
  }, [items.data, selected]);

  if (isLoading || map.isLoading) return <Skeleton className="h-96" />;
  if (!enrollment) return <Navigate to="/app/onboarding" replace />;
  if (map.isError) return <ErrorState onRetry={() => map.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Practice" title="Practice signs" description="Watch the reference sign, slow it down, mirror it, and practise beside it with your own camera. Nothing is recorded." />
      {unlocked.length === 0 ? (
        <EmptyState icon={<Hand className="h-6 w-6" />} title="Practice opens with Month 1" description="Once your payment is confirmed you can practise every sign from your unlocked months." />
      ) : (
        <>
          {unlocked.length > 1 && <Tabs aria-label="Month" variant="pills" className="mb-6 w-fit" value={activeMonth} onChange={setMonthId} tabs={unlocked.map((m) => ({ id: m.id, label: `Month ${m.month_number}` }))} />}
          <div className="grid gap-6 lg:grid-cols-[16rem,1fr]">
            <nav aria-label="Practice items" className="rounded-2xl border border-ink-200 bg-white lg:max-h-[70vh] lg:overflow-y-auto">
              {items.isLoading ? (
                <div className="p-3">
                  <Skeleton lines={5} />
                </div>
              ) : (items.data ?? []).length === 0 ? (
                <p className="p-4 text-sm text-ink-500">No practice signs for this month yet.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {(items.data ?? []).map((it) => (
                    <li key={it.id}>
                      <button type="button" onClick={() => setSelected(it)} aria-current={selected?.id === it.id ? 'true' : undefined} className={cn('block w-full px-4 py-3 text-left text-sm', selected?.id === it.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-700 hover:bg-ink-50')}>
                        {it.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
            <div>{selected ? <PracticeStage item={selected} /> : null}</div>
          </div>
        </>
      )}
    </>
  );
}

function PracticeStage({ item }: { item: PracticeItem }) {
  const [src, setSrc] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [mirror, setMirror] = useState(false);
  const [slow, setSlow] = useState(false);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'denied'>('off');
  const camRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    resolveMediaUrl(item.video_path, item.video_url).then((u) => !cancelled && setSrc(u)).catch(() => !cancelled && setSrc(null));
    setPoster(null);
    if (item.thumbnail_path) resolveMediaUrl(item.thumbnail_path, null).then((u) => !cancelled && setPoster(u)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [item]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (camRef.current) camRef.current.srcObject = null;
    setCamera('off');
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      streamRef.current = stream;
      if (camRef.current) {
        camRef.current.srcObject = stream;
        await camRef.current.play();
      }
      setCamera('on');
    } catch {
      setCamera('denied');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{item.title}</h2>
          {item.description && <p className="mt-1 text-sm text-ink-600">{item.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={slow ? 'secondary' : 'outline'} size="sm" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
            {slow ? 'Slow (0.5×)' : 'Normal speed'}
          </Button>
          <Button variant={mirror ? 'secondary' : 'outline'} size="sm" aria-pressed={mirror} onClick={() => setMirror((m) => !m)} leftIcon={<FlipHorizontal2 className="h-4 w-4" aria-hidden="true" />}>
            Mirror
          </Button>
        </div>
      </div>

      <div className={cn('mt-4 grid gap-4', camera === 'on' && 'md:grid-cols-2')}>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-500">Reference sign</p>
          <VideoPlayer key={`${item.id}-${slow}`} src={src} poster={poster} title={`Reference: ${item.title}`} mirror={mirror} loop compact defaultRate={slow ? 0.5 : 1} />
        </div>
        {camera === 'on' && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-500">You (not recorded)</p>
            <div className="overflow-hidden rounded-2xl bg-ink-950">
              <video ref={camRef} muted playsInline className="aspect-video w-full -scale-x-100 object-cover" aria-label="Your camera preview" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {camera === 'on' ? (
          <Button variant="danger" size="sm" onClick={stopCamera} leftIcon={<CameraOff className="h-4 w-4" aria-hidden="true" />}>
            Stop camera
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={startCamera} loading={camera === 'starting'} leftIcon={<Camera className="h-4 w-4" aria-hidden="true" />}>
            Practise with my camera
          </Button>
        )}
        <p className="text-xs text-ink-500">Your camera stays on this device. It is never recorded or uploaded.</p>
      </div>
      {camera === 'denied' && (
        <Alert tone="warning" className="mt-3" title="Camera unavailable">
          Allow camera access in your browser settings, or continue practising with the reference video only.
        </Alert>
      )}

      {item.movement_notes && (
        <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Key movement notes</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{item.movement_notes}</p>
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-accent-200 bg-accent-50/60 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" aria-hidden="true" />
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
            AI-assisted practice feedback <Badge tone="accent" size="sm">Coming soon</Badge>
          </p>
          <p className="mt-1 text-sm text-ink-600">MCSLI is exploring automated hints on hand shape and movement. For now, your trainer gives all feedback during assessments.</p>
        </div>
      </div>
    </div>
  );
}
