import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Award, CalendarDays, Clock, ExternalLink, MapPin, Wifi, Users, Wallet } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { formatDate, formatUGX } from '@/lib/utils';
import { getPublicCohort } from '@/services/public';
import { useSiteContent } from '@/content/useSiteContent';
import { cohortStatusLabel, DELIVERY_MODE_LABEL } from '@/domain/cohorts';
import { Section } from '@/components/public/Sections';
import { Skeleton, ErrorState, EmptyState, Alert } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function CohortPage() {
  const { slug = '' } = useParams();
  const { content } = useSiteContent();
  const cohort = useQuery({ queryKey: ['public-cohort', slug], queryFn: () => getPublicCohort(slug), enabled: Boolean(slug) });
  const c = cohort.data;
  const status = c ? cohortStatusLabel(c.phase, c.applications) : null;
  usePageMeta({
    title: c ? `${c.name} | MCSLI Ugandan Sign Language Training` : 'Cohort',
    description: c ? (c.tagline ?? c.description?.slice(0, 160) ?? `${c.name} – MCSLI sign language training cohort.`) : undefined,
    path: `/cohorts/${slug}`,
    noIndex: !c,
    jsonLd: c && c.start_date
      ? {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: c.course?.title ?? c.name,
          description: c.tagline ?? c.description ?? undefined,
          provider: { '@type': 'Organization', name: 'Master Class Sign Language Initiative', sameAs: 'https://mcsli.org' },
          hasCourseInstance: {
            '@type': 'CourseInstance',
            name: c.name,
            courseMode: c.delivery_mode === 'online' ? 'online' : c.delivery_mode === 'physical' ? 'onsite' : 'blended',
            startDate: c.start_date,
            endDate: c.end_date ?? undefined,
            location: c.physical_location && c.delivery_mode !== 'online' ? { '@type': 'Place', name: c.physical_location } : undefined,
          },
        }
      : undefined,
  });

  if (cohort.isLoading) return <Section><Skeleton className="h-96" /></Section>;
  if (cohort.isError) return <Section><ErrorState onRetry={() => cohort.refetch()} /></Section>;
  if (!c || !status) return <Section><EmptyState title="Cohort not found" description="This cohort is not published or the link is wrong." action={<ButtonLink to="/cohorts">All cohorts</ButtonLink>} /></Section>;

  const open = c.applications === 'open';
  const facts: { icon: typeof CalendarDays; label: string; value: string }[] = [];
  if (c.start_date || c.end_date) facts.push({ icon: CalendarDays, label: 'Dates', value: `${c.start_date ? formatDate(c.start_date, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Start to be announced'}${c.end_date ? ` – ${formatDate(c.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}` });
  if (c.course) facts.push({ icon: Clock, label: 'Duration', value: `${c.course.duration_months} months` });
  facts.push({ icon: c.delivery_mode === 'online' ? Wifi : MapPin, label: 'Learning format', value: DELIVERY_MODE_LABEL[c.delivery_mode] });
  if (c.physical_location && c.delivery_mode !== 'online') facts.push({ icon: MapPin, label: 'Physical classes', value: c.physical_location });
  if (c.application_deadline && c.phase !== 'completed') facts.push({ icon: CalendarDays, label: 'Application deadline', value: formatDate(c.application_deadline, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
  if (c.application_opens_at && c.applications === 'opening_soon') facts.push({ icon: CalendarDays, label: 'Applications open', value: formatDate(c.application_opens_at, { day: 'numeric', month: 'long', year: 'numeric' }) });
  if (c.capacity) facts.push({ icon: Users, label: 'Places', value: `${c.capacity}` });

  return (
    <>
      <section className="bg-white">
        <div className="container-x py-10 sm:py-14">
          <Link to="/cohorts" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All cohorts
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {c.course && <span className="text-sm font-medium text-brand-700">{c.course.title}</span>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-display-md">{c.name}</h1>
          {c.tagline && <p className="mt-3 max-w-2xl text-lg text-ink-600">{c.tagline}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {open ? (
              <ButtonLink to={`/cohorts/${c.slug}/apply`} variant="accent" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
                Apply for {c.cohort_number ? `Cohort ${c.cohort_number}` : c.name}
              </ButtonLink>
            ) : c.applications === 'opening_soon' ? (
              <Alert tone="info" title="Applications are not open yet">{c.application_opens_at ? `Applications open on ${formatDate(c.application_opens_at, { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'MCSLI will announce when applications open.'}</Alert>
            ) : c.phase === 'completed' ? null : (
              <Alert tone="warning" title="Applications are closed">{c.application_deadline ? `The deadline was ${formatDate(c.application_deadline, { day: 'numeric', month: 'long', year: 'numeric' })}. ` : ''}Watch this page for the next intake.</Alert>
            )}
            {c.phase !== 'completed' && c.course?.is_published && (
              <ButtonLink to="/online-learning" variant="outline" size="lg">
                About the course
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            {c.description && (
              <div>
                <h2 className="text-xl font-semibold">About this cohort</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.description}</p>
              </div>
            )}
            {c.schedule_notes && (
              <div>
                <h2 className="text-xl font-semibold">Schedule</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.schedule_notes}</p>
              </div>
            )}
            {c.online_details && c.delivery_mode !== 'physical' && (
              <div>
                <h2 className="text-xl font-semibold">Online classes</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.online_details}</p>
              </div>
            )}
            {c.eligibility && (
              <div>
                <h2 className="text-xl font-semibold">Who can apply</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{c.eligibility}</p>
              </div>
            )}
            {c.phase === 'completed' && (c.completion_summary || c.verified_participant_count != null) && (
              <div>
                <h2 className="text-xl font-semibold">How it went</h2>
                {c.verified_participant_count != null && <p className="mt-3 text-ink-700">{c.verified_participant_count} participants completed this cohort.</p>}
                {c.completion_summary && <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-700">{c.completion_summary}</p>}
              </div>
            )}
            {(c.announcement_url || c.sources.length > 0) && (
              <div className="text-sm text-ink-500">
                <h2 className="text-xs font-semibold uppercase tracking-wider">Sources</h2>
                <ul className="mt-2 space-y-1">
                  {c.announcement_url && (
                    <li>
                      <a href={c.announcement_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        Official announcement <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </li>
                  )}
                  {c.sources.map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                          {s.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        s.label
                      )}
                      {s.note ? ` – ${s.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="space-y-4 lg:col-span-5">
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Key facts</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <dt className="text-ink-500">{f.label}</dt>
                      <dd className="font-medium text-ink-900">{f.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
            {(c.registration_fee != null || c.tuition_online != null || c.tuition_physical != null) && (
              <div className="card p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" /> Fees
                </h2>
                <dl className="mt-4 space-y-2 text-sm">
                  {c.registration_fee != null && (
                    <div className="flex justify-between">
                      <dt className="text-ink-600">Registration fee</dt>
                      <dd className="font-semibold">{formatUGX(Number(c.registration_fee), c.currency)}</dd>
                    </div>
                  )}
                  {c.tuition_physical != null && (
                    <div className="flex justify-between">
                      <dt className="text-ink-600">Physical classes</dt>
                      <dd className="font-semibold">{formatUGX(Number(c.tuition_physical), c.currency)}</dd>
                    </div>
                  )}
                  {c.tuition_online != null && (
                    <div className="flex justify-between">
                      <dt className="text-ink-600">Online classes</dt>
                      <dd className="font-semibold">{formatUGX(Number(c.tuition_online), c.currency)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-xs text-ink-500">Payment details are shown in your MCSLI account after acceptance. Registration fees are non-refundable.</p>
              </div>
            )}
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Award className="h-5 w-5 text-accent-600" aria-hidden="true" /> Certificate
              </h2>
              <p className="mt-2 text-sm text-ink-700">{c.certificate_description ?? (c.course?.certificate_title ? `Graduates receive the ${c.course.certificate_title}, verifiable online.` : content.programs.certificateNote)}</p>
            </div>
            {open && c.fallback_form_url && (
              <p className="text-xs text-ink-500">
                Having trouble with the application?{' '}
                <a href={c.fallback_form_url} target="_blank" rel="noreferrer" className="underline">
                  Use the alternative application method
                </a>
                .
              </p>
            )}
          </aside>
        </div>
      </Section>
    </>
  );
}
