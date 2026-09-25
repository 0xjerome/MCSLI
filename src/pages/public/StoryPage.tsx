import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, StoryCard, CtaBand } from '@/components/public/Sections';
import { Breadcrumb } from '@/components/ui/Misc';
import NotFoundPage from './NotFoundPage';

export default function StoryPage() {
  const { slug } = useParams();
  const { content } = useSiteContent();
  const story = content.stories.find((s) => s.slug === slug);
  usePageMeta({ title: story ? `${story.name}'s story` : 'Story', description: story?.summary, path: `/impact/${slug}`, image: story?.image ? `https://mcsli.org${story.image}` : undefined });
  if (!story) return <NotFoundPage />;
  const others = content.stories.filter((s) => s.slug !== slug).slice(0, 3);

  return (
    <>
      <Section className="!pb-8">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Impact stories', to: '/impact' }, { label: story.name }]} />
        <article className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
          {story.image && (
            <div className="lg:col-span-4">
              <img src={story.image} alt={`Portrait of ${story.name}`} className="aspect-[4/5] w-full rounded-2xl object-cover object-top shadow-raised" width={800} height={1000} />
            </div>
          )}
          <div className="lg:col-span-8">
            <p className="eyebrow">
              {story.year}
              {story.cohort ? ` · ${story.cohort}` : ''}
            </p>
            <h1 className="mt-3 text-display-sm sm:text-display-md">{story.name}</h1>
            <p className="mt-4 text-lg text-ink-600">{story.summary}</p>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-500">Original testimony</h2>
            <div className="prose-mcsli mt-3 whitespace-pre-line text-[15px]">{story.testimony}</div>
            <Link to="/impact" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All impact stories
            </Link>
          </div>
        </article>
      </Section>
      <Section tone="muted">
        <h2 className="text-display-sm">More stories</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((s) => (
            <StoryCard key={s.slug} story={s} compact />
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
