import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, MapPin, Megaphone } from 'lucide-react';
import { listPublicCohorts } from '@/services/public';
import { cohortStatusLabel, DELIVERY_MODE_LABEL } from '@/domain/cohorts';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { PublicCohort } from '@/types/database';

export const publicCohortsQuery = { queryKey: ['public-cohorts'] as const, queryFn: listPublicCohorts, staleTime: 5 * 60 * 1000 };

/** The cohort to promote: featured first, then the one accepting applications, then the next upcoming one. */
export function pickCurrentCohort(list: PublicCohort[] | undefined): PublicCohort | null {
  const live = (list ?? []).filter((c) => c.phase !== 'completed');
  return live.find((c) => c.is_featured && c.applications === 'open') ?? live.find((c) => c.applications === 'open') ?? live.find((c) => c.applications === 'opening_soon') ?? live.find((c) => c.is_featured) ?? null;
}

/**
 * One tasteful MCSLI-native call-to-action for the current intake (rendered only while a cohort is
 * open or opening soon). `banner` sits under a page hero; `card` fits inside a grid.
 */
export function CurrentCohort({ variant = 'banner' }: { variant?: 'banner' | 'card' }) {
  const cohorts = useQuery(publicCohortsQuery);
  const c = pickCurrentCohort(cohorts.data);
  if (!c || (c.applications !== 'open' && c.applications !== 'opening_soon')) return null;
  const status = cohortStatusLabel(c.phase, c.applications);
  const open = c.applications === 'open';
  const details = [
    c.start_date ? `Starts ${formatDate(c.start_date)}` : null,
    c.application_deadline ? `Apply by ${formatDate(c.application_deadline)}` : null,
    c.course ? `${c.course.duration_months} months` : null,
    DELIVERY_MODE_LABEL[c.delivery_mode],
  ].filter(Boolean);

  if (variant === 'card') {
    return (
      <div className="card flex h-full flex-col p-5">
        <Badge tone={status.tone} size="sm" icon={<Megaphone className="h-3 w-3" aria-hidden="true" />}>
          {status.label}
        </Badge>
        <h3 className="mt-3 text-lg font-semibold text-ink-900">{c.name}</h3>
        {c.tagline && <p className="mt-1 text-sm text-ink-600">{c.tagline}</p>}
        <p className="mt-2 text-xs text-ink-500">{details.join(' · ')}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <ButtonLink to={open ? `/cohorts/${c.slug}/apply` : `/cohorts/${c.slug}`} size="sm" variant="accent" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            {open ? `Apply for ${c.cohort_number ? `Cohort ${c.cohort_number}` : c.name}` : 'View cohort'}
          </ButtonLink>
          <Link to={`/cohorts/${c.slug}`} className="inline-flex items-center px-2 text-sm font-semibold text-brand-700 hover:underline">
            Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Current cohort" className="container-x -mt-2 pb-2 pt-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-800">
            <Megaphone className="h-4 w-4" aria-hidden="true" /> {open ? 'Applications open' : 'Applications opening soon'} — {c.name}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-700">
            {c.start_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden="true" /> Starts {formatDate(c.start_date)}
              </span>
            )}
            {c.application_deadline && <span>Apply by {formatDate(c.application_deadline)}</span>}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" /> {DELIVERY_MODE_LABEL[c.delivery_mode]}
              {c.physical_location && c.delivery_mode !== 'online' ? ` · ${c.physical_location.split(',')[0]}` : ''}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink to={`/cohorts/${c.slug}`} variant="outline" size="sm">
            View cohort
          </ButtonLink>
          {open && (
            <ButtonLink to={`/cohorts/${c.slug}/apply`} variant="accent" size="sm" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              Apply
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
