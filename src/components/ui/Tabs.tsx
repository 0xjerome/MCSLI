import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = 'underline',
  'aria-label': ariaLabel,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  variant?: 'underline' | 'pills';
  'aria-label': string;
}) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = (i + keys[e.key]! + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next]!.id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'no-scrollbar flex gap-1 overflow-x-auto',
        variant === 'underline' ? 'border-b border-ink-200' : 'rounded-xl bg-ink-100 p-1',
        className,
      )}
    >
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-3', selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-600 hover:text-ink-900')
                : cn('rounded-lg px-3 py-2', selected ? 'bg-white text-ink-900 shadow-card' : 'text-ink-600 hover:text-ink-900'),
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', selected ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-700')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({ id, value, children, className }: { id: T; value: T; children: ReactNode; className?: string }) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" tabIndex={0} className={cn('animate-fade-in focus:outline-none', className)}>
      {children}
    </div>
  );
}
