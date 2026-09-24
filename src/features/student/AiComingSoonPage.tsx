import { Sparkles, Hand, BookOpenCheck, Search } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { PageHeader } from '@/app/layouts/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Misc';

/**
 * Honest placeholder for future AI features. Nothing here pretends to work.
 * Architecture note: an `ai_feedback` table + Edge Function can be added later and
 * surfaced on the Practice page without changing the progression rules.
 */
export default function AiComingSoonPage() {
  usePageMeta({ title: 'AI features (coming soon)', noIndex: true });
  return (
    <>
      <PageHeader eyebrow="Roadmap" title={<span className="inline-flex items-center gap-2">AI-powered learning <Badge tone="accent">Coming soon</Badge></span>} description="MCSLI plans to add AI assistance to the platform. These features are not available yet." />
      <Alert tone="info" className="mb-6" title="What this means for you today">
        All feedback and grading on this platform comes from qualified MCSLI trainers. When AI assistance arrives it will be clearly labelled as assistance and will never replace trainer assessment or certification.
      </Alert>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Hand, t: 'Practice hints', d: 'Possible future capability: hints on hand shape and movement while you practise a sign, shown beside the reference video.' },
          { icon: BookOpenCheck, t: 'Revision suggestions', d: 'Possible future capability: suggested lessons and signs to review based on your quiz and assessment history.' },
          { icon: Search, t: 'Sign dictionary search', d: 'Possible future capability: search USL signs by word and see the reference video instantly.' },
        ].map((f) => (
          <Card key={f.t} className="border-dashed">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600" aria-hidden="true">
              <f.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 flex items-center gap-2 font-semibold">
              {f.t} <Sparkles className="h-4 w-4 text-accent-500" aria-hidden="true" />
            </h2>
            <p className="mt-1 text-sm text-ink-600">{f.d}</p>
            <Badge size="sm" className="mt-3">Planned – not yet available</Badge>
          </Card>
        ))}
      </div>
    </>
  );
}
