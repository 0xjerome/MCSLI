import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, StoryCard, CtaBand } from '@/components/public/Sections';
import { SectionHeader, EmptyState } from '@/components/ui/Misc';
import { formatDate, cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function ResourcesPage() {
  const { content } = useSiteContent();
  const { faq, announcements, stories } = content;
  const [openQ, setOpenQ] = useState<string | null>(null);
  usePageMeta({ title: 'Resources & Updates', description: 'MCSLI announcements, learner stories and answers to common questions about learning Ugandan Sign Language.', path: '/resources' });

  const categories = Array.from(new Set(faq.map((f) => f.category)));

  return (
    <>
      <PageHero eyebrow="Resources" title="Updates, stories and answers" description="News from MCSLI, first-hand stories from learners, and answers to the questions we hear most often." />

      <Section>
        <SectionHeader eyebrow="Announcements" title="Latest from MCSLI" />
        <div className="mt-8">
          {announcements.length === 0 ? (
            <EmptyState compact title="No announcements right now" description="MCSLI posts cohort dates, events and platform updates here." />
          ) : (
            <ul className="divide-y divide-ink-200 rounded-2xl border border-ink-200">
              {announcements.map((a) => (
                <li key={a.id} className="p-5">
                  <p className="text-xs text-ink-500">{formatDate(a.publishedAt)}</p>
                  <h3 className="mt-1 font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{a.body}</p>
                  {a.link && (
                    <Link to={a.link} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
                      {a.linkLabel ?? 'Learn more'}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeader eyebrow="Learner stories" title="In their own words" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.slice(0, 3).map((s) => (
            <StoryCard key={s.slug} story={s} compact />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-8 space-y-8">
          {categories.map((c) => (
            <div key={c}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">{c}</h3>
              <ul className="mt-3 divide-y divide-ink-200 rounded-2xl border border-ink-200">
                {faq
                  .filter((f) => f.category === c)
                  .map((f) => {
                    const id = `${c}-${f.question}`;
                    const open = openQ === id;
                    return (
                      <li key={id}>
                        <h4>
                          <button type="button" aria-expanded={open} aria-controls={`panel-${id}`} onClick={() => setOpenQ(open ? null : id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink-900 hover:bg-ink-50">
                            {f.question}
                            <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                          </button>
                        </h4>
                        {open && (
                          <div id={`panel-${id}`} className="px-5 pb-5 text-sm leading-relaxed text-ink-600">
                            {f.answer}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
