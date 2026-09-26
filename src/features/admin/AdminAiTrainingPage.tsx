import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, CheckCircle2, ShieldCheck, Sparkles, Video } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listAiTrainingAssets, reviewAiTrainingAsset } from '@/services/staff';
import { PageHeader } from '@/app/layouts/Shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { AiTrainingAsset } from '@/types/database';

export default function AdminAiTrainingPage() {
  usePageMeta({ title: 'AI training', noIndex: true });
  const toast = useToast();
  const assets = useQuery({ queryKey: ['ai-training-assets'], queryFn: listAiTrainingAssets });

  if (assets.isLoading) return <Skeleton className="h-96" />;
  if (assets.isError) return <ErrorState onRetry={() => assets.refetch()} />;

  const rows = assets.data ?? [];
  const approved = rows.filter((a) => a.training_approved).length;
  const ready = rows.filter(
    (a) => !a.training_approved && a.signer_consent_confirmed && a.training_rights_confirmed && a.quality_status === 'approved',
  ).length;

  const change = async (asset: AiTrainingAsset, patch: Parameters<typeof reviewAiTrainingAsset>[1], message: string) => {
    try {
      await reviewAiTrainingAsset(asset.id, patch);
      await assets.refetch();
      toast.success(message);
    } catch (err) {
      toast.error('Not changed', friendlyError(err));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Responsible AI"
        title="AI training library"
        description="Videos uploaded to lessons and practice signs enter this review queue automatically. Nothing trains itself: consent, MCSLI training rights and quality must all be confirmed before a video can be approved for a future dataset."
      />

      <Alert tone="info" className="mb-6" title="Dataset collection is active; model training is not">
        Uploading or approving a video does not run a model or make an AI feature live. Approval only marks material as eligible for a reviewed future dataset.
      </Alert>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-500">Video candidates</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Ready for final approval</p>
          <p className="mt-1 text-2xl font-bold">{ready}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Training approved</p>
          <p className="mt-1 text-2xl font-bold">{approved}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="No training candidates yet"
          description="When Maurice or another administrator uploads a real lesson or practice video, it will appear here automatically."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => {
            const canApprove =
              a.active && a.signer_consent_confirmed && a.training_rights_confirmed && a.quality_status === 'approved';
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Video className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      <h2 className="font-semibold text-ink-900">{a.label}</h2>
                      <Badge size="sm" tone={a.source_kind === 'practice' ? 'info' : 'neutral'}>
                        {a.source_kind === 'practice' ? 'Practice sign' : 'Lesson'}
                      </Badge>
                      {a.training_approved && <Badge size="sm" tone="success">AI approved</Badge>}
                      {a.quality_status === 'rejected' && <Badge size="sm" tone="danger">Rejected</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{a.sign_language}</p>
                    <p className="mt-1 max-w-3xl truncate font-mono text-xs text-ink-400">{a.media_ref}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ReviewStep
                    title="Signer consent"
                    done={a.signer_consent_confirmed}
                    onConfirm={() => change(a, { signer_consent_confirmed: true, training_approved: false }, 'Signer consent confirmed')}
                    onUndo={() => change(a, { signer_consent_confirmed: false, training_approved: false }, 'Signer consent cleared')}
                  />
                  <ReviewStep
                    title="MCSLI training rights"
                    done={a.training_rights_confirmed}
                    onConfirm={() => change(a, { training_rights_confirmed: true, training_approved: false }, 'Training rights confirmed')}
                    onUndo={() => change(a, { training_rights_confirmed: false, training_approved: false }, 'Training rights cleared')}
                  />
                  <div className="rounded-xl border border-ink-200 p-3">
                    <p className="text-sm font-semibold">Video quality</p>
                    <p className="mt-1 text-xs text-ink-500">Correct label, clear signing, usable framing and no known content error.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={a.quality_status === 'approved' ? 'primary' : 'outline'}
                        onClick={() => change(a, { quality_status: 'approved', training_approved: false }, 'Quality approved')}
                      >
                        Approve quality
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => change(a, { quality_status: 'rejected', training_approved: false }, 'Video rejected for AI training')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
                  {a.training_approved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" />
                      <span className="text-sm font-semibold text-success-700">Eligible for future AI training</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => change(a, { training_approved: false }, 'Training approval removed')}
                      >
                        Remove approval
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canApprove}
                      leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => change(a, { training_approved: true }, 'Video approved for the future AI dataset')}
                    >
                      Approve for AI dataset
                    </Button>
                  )}
                  {!canApprove && !a.training_approved && (
                    <span className="text-xs text-ink-500">Complete all three review checks first.</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function ReviewStep({
  title,
  done,
  onConfirm,
  onUndo,
}: {
  title: string;
  done: boolean;
  onConfirm: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className={`h-4 w-4 ${done ? 'text-success-600' : 'text-ink-400'}`} aria-hidden="true" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        {done ? 'Confirmed.' : title === 'Signer consent' ? 'Confirm that the visible signer agreed to AI training use.' : 'Confirm MCSLI owns or has permission to use this recording for model training.'}
      </p>
      <Button size="sm" variant="outline" className="mt-3" onClick={done ? onUndo : onConfirm}>
        {done ? 'Clear confirmation' : 'Confirm'}
      </Button>
    </div>
  );
}
