import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  label,
  showValue = true,
  size = 'md',
  tone = 'brand',
  className,
}: {
  value: number;
  label: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'accent' | 'success';
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
  const colors = { brand: 'bg-brand-600', accent: 'bg-accent-500', success: 'bg-success-600' };
  return (
    <div className={className}>
      {(showValue || label) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-ink-700">{label}</span>
          {showValue && <span className="tabular-nums text-ink-600">{v}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className={cn('w-full overflow-hidden rounded-full bg-ink-100', heights[size])}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', colors[tone])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 6, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(v)}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-ink-100" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-brand-600 transition-[stroke-dashoffset] duration-500"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (v / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-ink-900 font-display text-sm font-bold">
        {Math.round(v)}%
      </text>
    </svg>
  );
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                state === 'done' && 'bg-brand-600 text-white',
                state === 'current' && 'bg-brand-50 text-brand-700 ring-2 ring-brand-600',
                state === 'todo' && 'bg-ink-100 text-ink-500',
              )}
            >
              {i + 1}
            </span>
            <span className={cn('hidden text-sm sm:inline', state === 'current' ? 'font-semibold text-ink-900' : 'text-ink-500')}>{s}</span>
            <span className="sr-only">{state === 'done' ? '(completed)' : state === 'current' ? '(current step)' : ''}</span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', i < current ? 'bg-brand-600' : 'bg-ink-200')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
