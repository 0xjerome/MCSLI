import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState, Skeleton } from './Misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Render the cell. */
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on the mobile card view (e.g. for redundant columns). */
  hideOnMobile?: boolean;
  /** Use as the card title on mobile. */
  primary?: boolean;
  align?: 'left' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  className?: string;
}

/**
 * Responsive table: a real <table> on ≥ md screens and a stacked card list on
 * small screens (no horizontal scrolling for essential content).
 */
export function DataTable<T>({ columns, rows, rowKey, caption, loading, empty, onRowClick, rowActions, className }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        <Skeleton className="h-10" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return <div className={className}>{empty ?? <EmptyState title="Nothing here yet" compact />}</div>;
  }
  const primary = columns.find((c) => c.primary) ?? columns[0]!;

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink-200 md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3', c.align === 'right' && 'text-right', c.className)}>
                  {c.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 bg-white">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(onRowClick && 'cursor-pointer hover:bg-brand-50/40 focus-within:bg-brand-50/40')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle text-ink-800', c.align === 'right' && 'text-right', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-base font-semibold text-ink-900">{primary.cell(row)}</div>
              {rowActions && <div className="shrink-0">{rowActions(row)}</div>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {columns
                .filter((c) => c !== primary && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-xs text-ink-500">{c.header}</dt>
                    <dd className="mt-0.5 break-words text-ink-800">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
            {onRowClick && (
              <button type="button" onClick={() => onRowClick(row)} className="mt-3 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
                View details
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
