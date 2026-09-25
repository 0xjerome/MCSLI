import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Stethoscope, Shield, Heart, Building2, User, GraduationCap, Hand, Megaphone, Users, Lightbulb, Globe, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteContent } from '@/content/schema';

export const iconMap: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  shield: Shield,
  heart: Heart,
  building: Building2,
  user: User,
  graduation: GraduationCap,
  hand: Hand,
  megaphone: Megaphone,
  users: Users,
  lightbulb: Lightbulb,
  globe: Globe,
};

export function Section({ children, className, tone = 'white', id }: { children: ReactNode; className?: string; tone?: 'white' | 'muted' | 'dark' | 'brand'; id?: string }) {
  const tones = { white: 'bg-white', muted: 'bg-ink-50', dark: 'bg-ink-950 text-ink-200', brand: 'bg-brand-900 text-brand-50' };
  return (
    <section id={id} className={cn('py-16 sm:py-20 lg:py-24', tones[tone], className)}>
      <div className="container-x">{children}</div>
    </section>
  );
}

export function PageHero({ eyebrow, title, description, image, imageAlt, children }: { eyebrow?: string; title: string; description?: string; image?: string; imageAlt?: string; children?: ReactNode }) {
  return (
    <section className="border-b border-ink-200 bg-ink-50">
      <div className={cn('container-x py-12 sm:py-16', image && 'grid items-center gap-10 lg:grid-cols-2')}>
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="text-display-md sm:text-display-lg">{title}</h1>
          {description && <p className="mt-4 text-lg leading-relaxed text-ink-600">{description}</p>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {image && (
          <div className="relative">
            <img src={image} alt={imageAlt ?? ''} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-raised" loading="eager" width={1200} height={900} />
          </div>
        )}
      </div>
    </section>
  );
}

export function ProgramCard({ program }: { program: SiteContent['programs']['training'][number] }) {
  const Icon = iconMap[program.icon] ?? Hand;
  return (
    <article className="card flex h-full flex-col p-6 transition-shadow hover:shadow-raised">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink-900">{program.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{program.description}</p>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
        <div>
          <dt className="sr-only">Duration</dt>
          <dd>
            <span className="font-semibold text-ink-700">Duration:</span> {program.duration}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Format</dt>
          <dd>
            <span className="font-semibold text-ink-700">Format:</span> {program.format}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function StoryCard({ story, compact }: { story: SiteContent['stories'][number]; compact?: boolean }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden p-0">
      {story.image && (
        <div className={cn('overflow-hidden bg-ink-100', compact ? 'aspect-[4/3]' : 'aspect-[4/3]')}>
          <img src={story.image} alt={`Portrait of ${story.name}`} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" width={800} height={600} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
          {story.year}
          {story.cohort ? ` · ${story.cohort}` : ''}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-ink-900">{story.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 line-clamp-4">{story.summary}</p>
        <Link to={`/impact/${story.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          Read {story.name.split(' ')[0]}'s story
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function CtaBand() {
  return (
    <Section tone="brand" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-8 lg:grid-cols-[1.4fr,1fr] lg:items-center">
        <div>
          <h2 className="text-display-sm text-white sm:text-display-md">Join us in creating change</h2>
          <p className="mt-4 max-w-xl text-lg text-brand-100">
            Together we can build a Uganda where communication barriers no longer exist. Learn the language, bring MCSLI to your organisation, or support our work.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Link to="/register" className="flex items-center justify-between rounded-xl bg-accent-500 px-5 py-4 font-semibold text-white hover:bg-accent-600">
            Start Learning <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link to="/contact?topic=partnership" className="flex items-center justify-between rounded-xl bg-white/10 px-5 py-4 font-semibold text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">
            Partner with MCSLI <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link to="/donate" className="flex items-center justify-between rounded-xl bg-white/10 px-5 py-4 font-semibold text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">
            Support MCSLI <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Section>
  );
}
