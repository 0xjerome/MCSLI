import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { formatDate, formatUGX } from '@/lib/utils';
import { cohortStatusLabel, DELIVERY_MODE_LABEL } from '@/domain/cohorts';
import { publicCohortsQuery } from '@/components/public/CurrentCohort';
import { Section, PageHero, CtaBand } from '@/components/public/Sections';
import { SectionHeader, Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { PublicCohort } from '@/types/database';

function CohortCard({ c, primary }: { c: PublicCohort; primary?: boolean }) {
  const status = cohortStatusLabel(c.phase, c.applications);
  const open = c.applications === 'open';
  return (
    <article className={`card flex h-full flex-col p-6 ${primary ? 'border-brand-200 ring-1 ring-brand-100' : ''}`} aria-labelledby={`cohort-${c.slug}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {c.is_featured && primary && <Badge tone="accent">Current</Badge>}
      </div>
      <h3 id={`cohort-${c.slug}`} className="mt-3 font-display text-xl font-bold text-ink-900">
        {c.name}
      </h3>
      {c.course && <p className="mt-1 text-sm font-medium text-brand-700">{c.course.title}</p>}
      {c.tagline && <p className="mt-2 text-sm text-ink-600">{c.tagline}</p>}
      <dl className="mt-4 grid gap-2 text-sm text-ink-700">
        {(c.start_date || c.end_date) && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <dt className="sr-only">Dates</dt>
            <dd>
              {c.start_date ? formatDate(c.start_date) : 'Start date to be announced'}
              {c.end_date ? ` – ${formatDate(c.end_date)}` : ''}
            </dd>
          </div>
        )}
        {c.application_deadline && c.phase !== 'completed' && (
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Application deadline</dt>
            <dd>Apply by {formatDate(c.application_deadline, { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <dt className="sr-only">Learning format</dt>
          <dd>
            {DELIVERY_MODE_LABEL[c.delivery_mode]}
            {c.course ? ` · ${c.course.duration_months} months` : ''}
          </dd>
        </div>
        {c.phase === 'completed' && c.verified_participant_count != null && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <dt className="sr-only">Participants</dt>
            <dd>{c.verified_participant_count} participants</dd>
          </div>
        )}
        {c.registration_fee != null && c.phase !== 'completed' && (
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Fees</dt>
            <dd className="text-ink-600">
              Registration {formatUGX(Number(c.registration_fee), c.currency)}
              {c.tuition_online != null ? ` · online ${formatUGX(Number(c.tuition_online), c.currency)}` : ''}
              {c.tuition_physical != null ? ` · physical ${formatUGX(Number(c.tuition_physical), c.currency)}` : ''}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <ButtonLink to={`/cohorts/${c.slug}`} variant={primary ? 'outline' : 'ghost'} size="sm">
          {c.phase === 'completed' ? 'Cohort summary' : 'View cohort'}
        </ButtonLink>
        {open && (
          <ButtonLink to={`/cohorts/${c.slug}/apply`} variant="accent" size="sm" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            Apply now
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export default function CohortsPage() {
  const cohorts = useQuery(publicCohortsQuery);
  usePageMeta({
    title: 'Cohorts – MCSLI Ugandan Sign Language Training',
    description: 'Current, upcoming and previous MCSLI sign language training cohorts: dates, learning format, fees and how to apply.',
    path: '/cohorts',
  });
  const list = cohorts.data ?? [];
  const current = list.filter((c) => c.phase !== 'completed' && (c.applications === 'open' || c.applications === 'opening_soon' || c.is_featured || c.phase === 'in_progress'));
  const upcoming = list.filter((c) => c.phase === 'upcoming' && !current.includes(c));
  const previous = list.filter((c) => c.phase === 'completed');

  return (
    <>
      <PageHero eyebrow="Cohorts" title="Join the next MCSLI sign language cohort" description="MCSLI runs its Ugandan Sign Language training in cohorts – groups of learners who start and finish together, online, in Kampala or both. Apply here; your application stays with MCSLI from start to finish." image="/media/gallery/classroom-sign-language-training.jpg" imageAlt="MCSLI learners in a sign language class in Kampala.">
        {current.some((c) => c.applications === 'open') && (
          <ButtonLink to={`/cohorts/${current.find((c) => c.applications === 'open')!.slug}/apply`} variant="accent" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
            Apply for {current.find((c) => c.applications === 'open')!.name}
          </ButtonLink>
        )}
      </PageHero>

      <Section>
        {cohorts.isLoading ? (
          <Skeleton className="h-64" />
        ) : cohorts.isError ? (
          <ErrorState onRetry={() => cohorts.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No cohort is published yet" description="MCSLI announces every new intake here and on its social channels. In the meantime you can register for the online course." action={<ButtonLink to="/online-learning">Online course</ButtonLink>} />
        ) : (
          <div className="space-y-16">
            <div>
              <SectionHeader eyebrow="Now" title={current.length ? 'Current cohort' : 'No cohort is accepting applications right now'} description={current.length ? 'Applications are handled on mcsli.org. You will receive a reference number and an e-mail confirmation.' : 'The next intake will be announced here. Previous cohorts are listed below.'} />
              {current.length > 0 && (
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  {current.map((c) => (
                    <CohortCard key={c.id} c={c} primary />
                  ))}
                </div>
              )}
            </div>
            {upcoming.length > 0 && (
              <div>
                <SectionHeader eyebrow="Next" title="Upcoming cohorts" />
                <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((c) => (
                    <CohortCard key={c.id} c={c} />
                  ))}
                </div>
              </div>
            )}
            {previous.length > 0 && (
              <div>
                <SectionHeader eyebrow="Archive" title="Previous cohorts" description="Every MCSLI intake since the programme began. Where MCSLI has verified details – dates, learning format, participant numbers – they are shown; otherwise the cohort is simply listed." />
                <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {previous.map((c) => (
                    <li key={c.id} className="card p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-ink-900">{c.name}</h3>
                        <Badge size="sm">Completed</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-600">
                        {c.start_date || c.end_date ? `${c.start_date ? formatDate(c.start_date, { month: 'short', year: 'numeric' }) : ''}${c.end_date ? ` – ${formatDate(c.end_date, { month: 'short', year: 'numeric' })}` : ''}` : ''}
                        {c.start_date || c.end_date ? ' · ' : ''}
                        {DELIVERY_MODE_LABEL[c.delivery_mode]}
                        {c.verified_participant_count != null ? ` · ${c.verified_participant_count} participants` : ''}
                      </p>
                      {c.completion_summary && <p className="mt-2 text-sm text-ink-600">{c.completion_summary}</p>}
                      <Link to={`/cohorts/${c.slug}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
                        Details
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Section>
      <CtaBand />
    </>
  );
}
