import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Lock, XCircle, Inbox, Loader2, WifiOff } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { Button, ButtonLink } from './Button';

/* ---------- Avatar ---------- */
export function Avatar({ name, src, size = 'md', className }: { name: string | null | undefined; src?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-800', sizes[size], className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span aria-hidden="true">{initials(name)}</span>}
      <span className="sr-only">{name ?? 'User'}</span>
    </span>
  );
}

/* ---------- Alert ---------- */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export function Alert({ tone = 'info', title, children, action, className }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const map = {
    info: { cls: 'border-info-100 bg-info-50 text-info-700', icon: <Info className="h-5 w-5" aria-hidden="true" /> },
    success: { cls: 'border-success-100 bg-success-50 text-success-700', icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> },
    warning: { cls: 'border-warning-100 bg-warning-50 text-warning-700', icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" /> },
    danger: { cls: 'border-danger-100 bg-danger-50 text-danger-700', icon: <XCircle className="h-5 w-5" aria-hidden="true" /> },
    neutral: { cls: 'border-ink-200 bg-ink-50 text-ink-700', icon: <Info className="h-5 w-5" aria-hidden="true" /> },
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4', map.cls, className)}>
      <span className="mt-0.5 shrink-0">{map.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-current/90')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50/60 text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-card" aria-hidden="true">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Error / offline / denied states ---------- */
export function ErrorState({ title = 'Something went wrong', description, onRetry, className }: { title?: ReactNode; description?: ReactNode; onRetry?: () => void; className?: string }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-2xl border border-danger-100 bg-danger-50/60 px-6 py-12 text-center', className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-danger-600 shadow-card" aria-hidden="true">
        {offline ? <WifiOff className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
      </span>
      <h3 className="text-base font-semibold text-ink-900">{offline ? 'You appear to be offline' : title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-600">{offline ? 'Check your connection and try again. Your progress is saved on the server.' : description ?? 'Please try again. If the problem continues, contact MCSLI support.'}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PermissionDenied({ description }: { description?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-warning-100 bg-warning-50/60 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-warning-600 shadow-card" aria-hidden="true">
        <Lock className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-ink-900">You don't have access to this page</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-600">{description ?? 'This area is restricted to authorised MCSLI staff. If you think this is a mistake, contact support.'}</p>
      <ButtonLink to="/" variant="outline" className="mt-4">
        Go to homepage
      </ButtonLink>
    </div>
  );
}

/* ---------- Loading ---------- */
export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}…</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className, lines }: { className?: string; lines?: number }) {
  if (lines) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={cn('relative h-4 overflow-hidden rounded-md bg-ink-100', i === lines - 1 && 'w-3/4', className)}>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-ink-100', className)} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

/* ---------- Breadcrumb ---------- */
export function Breadcrumb({ items, className }: { items: { label: string; to?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-ink-500">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} className="flex items-center gap-1">
              {it.to && !last ? (
                <Link to={it.to} className="hover:text-ink-900 hover:underline">
                  {it.label}
                </Link>
              ) : (
                <span className={cn(last && 'font-medium text-ink-800')} aria-current={last ? 'page' : undefined}>
                  {it.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pageCount, onChange, className }: { page: number; pageCount: number; onChange: (p: number) => void; className?: string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3', className)}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <p className="text-sm text-ink-600" aria-live="polite">
        Page <span className="font-semibold text-ink-900">{page}</span> of {pageCount}
      </p>
      <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

/* ---------- Description list ---------- */
export function DescriptionList({ items, className, columns = 2 }: { items: { label: ReactNode; value: ReactNode }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink-900">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Section header (public site) ---------- */
export function SectionHeader({ eyebrow, title, description, align = 'left', className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; align?: 'left' | 'center'; className?: string }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-display-sm sm:text-display-md">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg">{description}</p>}
    </div>
  );
}

/* ---------- Visually hidden live region ---------- */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
