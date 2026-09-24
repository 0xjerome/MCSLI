import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, StoryCard, CtaBand } from '@/components/public/Sections';
import { SectionHeader } from '@/components/ui/Misc';

export default function ImpactPage() {
  const { content } = useSiteContent();
  const { stories, impact_stats } = content;
  usePageMeta({ title: 'Impact Stories', description: 'Real stories from people whose lives have been changed through sign language education and community connection with MCSLI.', path: '/impact' });
  const verified = impact_stats.stats.filter((s) => s.verified);
  const featured = stories.find((s) => s.featured) ?? stories[0];
  const rest = stories.filter((s) => s !== featured);

  return (
    <>
      <PageHero eyebrow="Real stories, real impact" title="Voices of impact" description="Discover the journeys of individuals whose lives have been changed through sign language education, community connection and breaking down communication barriers." />

      {verified.length > 0 && (
        <Section className="!py-10">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {verified.map((s) => (
              <div key={s.label} className="rounded-2xl border border-ink-200 p-5 text-center">
                <dd className="font-display text-3xl font-bold text-brand-700">{s.value}</dd>
                <dt className="mt-1 text-sm text-ink-600">{s.label}</dt>
              </div>
            ))}
          </dl>
          {impact_stats.asOf && <p className="mt-3 text-center text-xs text-ink-500">Figures as of {impact_stats.asOf}, published by MCSLI.</p>}
        </Section>
      )}

      {featured && (
        <Section tone="muted">
          <article className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            {featured.image && (
              <div className="lg:col-span-5">
                <img src={featured.image} alt={`Portrait of ${featured.name}`} className="aspect-[4/5] w-full rounded-2xl object-cover object-top shadow-raised" width={800} height={1000} />
              </div>
            )}
            <div className="lg:col-span-7">
              <p className="eyebrow">Featured story · {featured.year}</p>
              <h2 className="mt-3 text-display-sm sm:text-display-md">{featured.name}</h2>
              <p className="mt-4 text-lg text-ink-600">{featured.summary}</p>
              <div className="prose-mcsli mt-6 whitespace-pre-line text-[15px]">{featured.testimony}</div>
            </div>
          </article>
        </Section>
      )}

      <Section>
        <SectionHeader eyebrow="More stories" title="Each story is a testament to the power of connection" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((s) => (
            <StoryCard key={s.slug} story={s} />
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
