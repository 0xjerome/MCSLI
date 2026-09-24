import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Video, ExternalLink } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { listPublishedEvents } from '@/services/public';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, CtaBand } from '@/components/public/Sections';
import { EmptyState, Skeleton, SectionHeader } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

export default function EventsPage() {
  const { content } = useSiteContent();
  const events = useQuery({ queryKey: ['public-events'], queryFn: listPublishedEvents });
  usePageMeta({ title: 'Events', description: 'Upcoming MCSLI training cohorts, community awareness sessions and Deaf community events in Uganda.', path: '/events' });

  const now = Date.now();
  const upcoming = (events.data ?? []).filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now);
  const past = (events.data ?? []).filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < now).reverse();

  return (
    <>
      <PageHero eyebrow="Events" title="Training cohorts, awareness days and community gatherings" description="MCSLI runs regular online and in-person training, community awareness sessions and Deaf community celebrations. Events are announced here as MCSLI schedules them." />

      <Section>
        <SectionHeader title="Upcoming events" />
        <div className="mt-8">
          {events.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No upcoming events have been published yet"
              description="Our regular training schedule runs all year. Contact us to join the next cohort or follow MCSLI on social media for announcements."
              action={<ButtonLink to="/programs">See the training schedule</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {upcoming.map((e) => (
                <li key={e.id} className="card p-6">
                  <p className="text-sm font-semibold text-accent-600">{formatDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <h3 className="mt-1 text-lg font-semibold">{e.title}</h3>
                  {e.description && <p className="mt-2 text-sm text-ink-600">{e.description}</p>}
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                    {e.is_online ? <Video className="h-4 w-4 text-brand-600" aria-hidden="true" /> : <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" />}
                    {e.is_online ? 'Online' : e.location ?? content.contact.addressShort}
                  </p>
                  {e.registration_url && (
                    <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                      Register <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeader title="Regular schedule" description="Our standing weekly training times in Kampala and online." />
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {content.programs.schedule.map((s) => (
            <li key={s.type} className="card p-5">
              <p className="font-semibold">{s.type}</p>
              <p className="mt-2 text-sm text-ink-700">{s.days}</p>
              <p className="text-sm text-ink-700">{s.time}</p>
              <p className="mt-1 text-xs text-ink-500">{s.format}</p>
            </li>
          ))}
        </ul>
        {past.length > 0 && (
          <>
            <h2 className="mt-12 text-lg font-semibold">Past events</h2>
            <ul className="mt-4 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
              {past.slice(0, 12).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-medium text-ink-900">{e.title}</span>
                  <span className="text-ink-500">{formatDate(e.starts_at)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <CtaBand />
    </>
  );
}
