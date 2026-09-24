import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}
interface ToastApi {
  toast: (t: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />,
  error: <XCircle className="h-5 w-5 text-danger-600" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-info-600" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.tone === 'error' ? 9000 : 5500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-4" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3.5 shadow-raised animate-slide-up', {
              'border-success-100': t.tone === 'success',
              'border-danger-100': t.tone === 'error',
              'border-warning-100': t.tone === 'warning',
              'border-info-100': t.tone === 'info',
            })}
          >
            {icons[t.tone]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-ink-600">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-md p-1 text-ink-400 hover:text-ink-700" aria-label="Dismiss notification">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
