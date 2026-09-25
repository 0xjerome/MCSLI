import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}

/** Accessible menu button (WAI-ARIA menu pattern with roving focus). */
export function Dropdown({
  trigger,
  items,
  align = 'right',
  label,
}: {
  trigger: (props: { open: boolean; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void; onKeyDown: (e: KeyboardEvent) => void }) => ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, active]);

  const enabled = items.filter((i) => !i.disabled);

  const onTriggerKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setActive(0);
      setOpen(true);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(enabled.length - 1);
      setOpen(true);
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      (rootRef.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % enabled.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + enabled.length) % enabled.length);
    }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger({ open, 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen((o) => !o), onKeyDown: onTriggerKey })}
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-raised animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {enabled.map((item, i) => {
            const cls = cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus:bg-ink-100',
              item.danger ? 'text-danger-700' : 'text-ink-800',
            );
            const common = {
              role: 'menuitem' as const,
              tabIndex: i === active ? 0 : -1,
              ref: (el: HTMLElement | null) => {
                itemRefs.current[i] = el;
              },
              onMouseEnter: () => setActive(i),
            };
            if (item.href) {
              return (
                <a key={item.id} href={item.href} className={cls} {...common} onClick={() => setOpen(false)}>
                  {item.icon}
                  {item.label}
                </a>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                className={cls}
                {...common}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
