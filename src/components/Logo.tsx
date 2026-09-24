import { cn } from '@/lib/utils';

/** The authentic MCSLI logo (public/media/logo.jpg) with a rounded crop. */
export function Logo({ className }: { className?: string }) {
  return <img src="/media/logo.jpg" alt="" className={cn('rounded-full object-cover', className)} width={40} height={40} />;
}

/** Original MCSLI-specific mark used for decorative accents (two hands – "the hand can speak"). */
export function HandsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 44V30a3 3 0 0 1 6 0v6m0-10v-8a3 3 0 0 1 6 0v12m0-10a3 3 0 0 1 6 0v10m0-6a3 3 0 0 1 6 0v10c0 7-5 12-12 12h-2c-5 0-8-2-11-6l-5-7a3 3 0 0 1 5-3l3 4" />
    </svg>
  );
}
