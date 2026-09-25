import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

export function Card({ padding = 'md', interactive, className, as = 'div', ...rest }: CardProps) {
  const Tag = as as 'div';
  return (
    <Tag
      className={cn(
        'min-w-0 rounded-2xl border border-ink-200 bg-white shadow-card',
        interactive && 'transition-shadow hover:shadow-raised',
        paddings[padding],
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  to,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success' | 'brand';
  to?: string;
}) {
  const tones = {
    default: 'text-ink-900',
    warning: 'text-warning-700',
    danger: 'text-danger-700',
    success: 'text-success-700',
    brand: 'text-brand-700',
  };
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        {icon && <span className="text-ink-400" aria-hidden="true">{icon}</span>}
      </div>
      <p className={cn('mt-2 font-display text-3xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <a href={to} className="card block p-5 transition-shadow hover:shadow-raised focus-visible:shadow-raised">
        {inner}
      </a>
    );
  }
  return <div className="card p-5">{inner}</div>;
}
