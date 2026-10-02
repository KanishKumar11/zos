// DataTable — the one table every list page uses: sortable headers, skeleton while loading,
// error with retry, empty state, optional totals footer, row click-through, CSV export.
'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { downloadCsv } from '@/lib/csv';
import type { SortState } from '@/lib/list-state';

import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';

export interface Column<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Enables header sorting. For client-side sorting also give sortValue. */
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | undefined | null;
  align?: 'left' | 'right';
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** CSV value; columns without it are left out of the export. */
  csv?: (row: Row) => string | number | null | undefined;
  csvHeader?: string;
  footer?: ReactNode;
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: SortState;
  onSortChange?: (s: SortState | undefined) => void;
  rowHref?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  empty?: ReactNode;
  /** Show the footer row (column.footer cells). */
  showFooter?: boolean;
  className?: string;
  rowClassName?: (row: Row) => string | undefined;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  rowHref,
  onRowClick,
  empty,
  showFooter,
  className,
  rowClassName,
}: DataTableProps<Row>) {
  const router = useRouter();

  const toggleSort = (col: Column<Row>) => {
    if (!col.sortable || !onSortChange) return;
    if (sort?.by !== col.id) onSortChange({ by: col.id, dir: col.align === 'right' ? 'desc' : 'asc' });
    else if (sort.dir === 'asc') onSortChange({ by: col.id, dir: 'desc' });
    else onSortChange({ by: col.id, dir: 'asc' });
  };

  const clickable = !!rowHref || !!onRowClick;

  return (
    <div className={cn('relative w-full overflow-x-auto rounded-lg border bg-card', className)}>
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            {columns.map((col) => {
              const active = sort?.by === col.id;
              const SortIcon = !active ? ArrowUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'h-10 whitespace-nowrap px-4 text-xs font-medium text-muted-foreground',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.hideBelow && HIDE[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded hover:text-foreground',
                        active && 'text-foreground',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      <SortIcon className={cn('h-3 w-3', !active && 'opacity-40')} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {!loading && !error && rows && rows.length > 0 && (
          <tbody className="divide-y">
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button,input,select,textarea,[role=button]')) return;
                    if (onRowClick) onRowClick(row);
                    else if (href) router.push(href);
                  }}
                  className={cn(
                    'transition-colors hover:bg-muted/30',
                    clickable && 'cursor-pointer',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'px-4 py-3 align-middle text-[13px]',
                        col.align === 'right' && 'text-right tabular-nums',
                        col.hideBelow && HIDE[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        )}
        {showFooter && !loading && !error && rows && rows.length > 0 && (
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    'px-4 py-2.5 text-[13px]',
                    col.align === 'right' && 'text-right tabular-nums',
                    col.hideBelow && HIDE[col.hideBelow],
                  )}
                >
                  {col.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {loading && <TableSkeleton columns={Math.min(columns.length, 6)} />}
      {!loading && !!error && <ErrorState error={error} onRetry={onRetry} />}
      {!loading && !error && (!rows || rows.length === 0) && (empty ?? <EmptyState title="Nothing here yet" />)}
    </div>
  );
}

/** Client-side sort for lists whose API doesn't sort. */
export function sortRows<Row>(rows: Row[] | undefined, columns: Column<Row>[], sort: SortState | undefined): Row[] {
  const list = rows ?? [];
  if (!sort) return list;
  const col = columns.find((c) => c.id === sort.by);
  if (!col?.sortValue) return list;
  const get = col.sortValue;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === vb) return 0;
    if (va === undefined || va === null || va === '') return 1;
    if (vb === undefined || vb === null || vb === '') return -1;
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
  });
}

/** Export the columns that define `csv` for the given rows. */
export function exportColumnsCsv<Row>(filename: string, columns: Column<Row>[], rows: Row[]): void {
  const cols = columns.filter((c) => c.csv);
  downloadCsv(
    filename,
    cols.map((c) => c.csvHeader ?? (typeof c.header === 'string' ? c.header : c.id)),
    rows.map((r) => cols.map((c) => c.csv!(r))),
  );
}
