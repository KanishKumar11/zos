// Status lanes — the default visual view of the invoices list. Four lanes (Draft / Sent / Overdue /
// Paid) of compact cards. Part-paid invoices sit in Sent or Overdue depending on whether they are
// late; written-off invoices sit in Paid with a muted badge (closed, nothing more to collect).
// Lanes scroll sideways inside their own container on small screens.
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { InvoiceStatus } from '@agency/shared';

import { Avatar, NewDot, Price, ProjectChip } from '@/components/viz';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { isNewSince } from '@/lib/last-visit';
import { formatDate } from '@/lib/formatters';

import { balanceOf } from './invoice-aging';
import type { InvoiceRow } from './invoices.hooks';

export type LaneKey = 'draft' | 'sent' | 'overdue' | 'paid';

const LANES: { key: LaneKey; label: string; color: string; sumLabel: string }[] = [
  { key: 'draft', label: 'Draft', color: 'hsl(var(--muted-foreground))', sumLabel: 'to send' },
  { key: 'sent', label: 'Sent', color: 'hsl(var(--info))', sumLabel: 'owed' },
  { key: 'overdue', label: 'Overdue', color: 'hsl(var(--destructive))', sumLabel: 'late' },
  { key: 'paid', label: 'Paid', color: 'hsl(var(--success))', sumLabel: 'collected' },
];

/** Cards shown per lane before "see all in the table". */
const LANE_LIMIT = 30;

export function laneOf(row: InvoiceRow): LaneKey {
  if (row.status === InvoiceStatus.DRAFT) return 'draft';
  if (row.status === InvoiceStatus.PAID || row.status === InvoiceStatus.WRITTEN_OFF) return 'paid';
  if (row.isOverdue || row.status === InvoiceStatus.OVERDUE) return balanceOf(row) > 0 ? 'overdue' : 'paid';
  return balanceOf(row) > 0 ? 'sent' : 'paid';
}

const time = (d: string | undefined) => (d ? Date.parse(d) || 0 : 0);

function sortLane(key: LaneKey, rows: InvoiceRow[]): InvoiceRow[] {
  const list = [...rows];
  switch (key) {
    case 'draft':
      return list.sort((a, b) => time(b.createdAt ?? b.issueDate) - time(a.createdAt ?? a.issueDate));
    case 'sent':
      // Soonest due first — what's about to become late.
      return list.sort((a, b) => (time(a.dueDate) || Infinity) - (time(b.dueDate) || Infinity));
    case 'overdue':
      return list.sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));
    case 'paid':
      return list.sort((a, b) => time(lastPaidAt(b) ?? b.issueDate) - time(lastPaidAt(a) ?? a.issueDate));
  }
}

const lastPaidAt = (r: InvoiceRow): string | undefined =>
  r.payments?.length ? [...r.payments].sort((a, b) => time(b.paidAt) - time(a.paidAt))[0]!.paidAt : undefined;

function laneSum(key: LaneKey, rows: InvoiceRow[]): number {
  return rows.reduce((s, r) => {
    if (key === 'draft') return s + r.totalPaise;
    if (key === 'paid') return s + r.paidPaise;
    return s + balanceOf(r);
  }, 0);
}

export function InvoiceLanes({
  rows,
  loading,
  error,
  onRetry,
  onShowTable,
  empty,
  hideEmptyLanes,
  since = null,
}: {
  rows: InvoiceRow[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Switch to the table (used when a lane has more cards than it shows). */
  onShowTable?: () => void;
  /** Shown instead of the lanes when there are no rows at all. */
  empty?: ReactNode;
  /** Leave out lanes with no cards — used when a status or aging filter already narrows the list. */
  hideEmptyLanes?: boolean;
  /** Last visit time (`useLastVisit`) — invoices created or paid since get a "new" dot. */
  since?: number | null;
}) {
  if (loading) return <LanesSkeleton />;
  if (error) return <ErrorState title="Couldn't load invoices" error={error} onRetry={onRetry} className="rounded-[var(--radius)] border bg-card" />;
  if (!rows || rows.length === 0) return <div className="rounded-[var(--radius)] border bg-card">{empty}</div>;

  const byLane = new Map<LaneKey, InvoiceRow[]>(LANES.map((l) => [l.key, []]));
  for (const r of rows) byLane.get(laneOf(r))!.push(r);

  return (
    <div className="overflow-x-auto pb-1" role="region" aria-label="Invoices by status">
      <div className="grid min-w-full auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 lg:auto-cols-[calc((100%_-_2.25rem)/4)]">
        {LANES.filter((lane) => !hideEmptyLanes || byLane.get(lane.key)!.length > 0).map((lane) => {
          const all = sortLane(lane.key, byLane.get(lane.key)!);
          const shown = all.slice(0, LANE_LIMIT);
          return (
            <section key={lane.key} className="flex min-w-0 flex-col rounded-[var(--radius)] border bg-muted/40 p-2.5" aria-label={`${lane.label}: ${all.length}`}>
              <header className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: lane.color }} aria-hidden />
                  {lane.label}
                  <span className="font-figures text-xs font-normal text-muted-foreground">{all.length}</span>
                </h3>
                {all.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    <Price paise={laneSum(lane.key, all)} compact className="font-medium text-foreground" /> {lane.sumLabel}
                  </span>
                )}
              </header>
              <div className="flex flex-col gap-2">
                {shown.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    {lane.key === 'overdue' ? 'Nothing is late. Nice.' : 'Nothing here'}
                  </p>
                ) : (
                  shown.map((r) => <InvoiceCard key={r._id} row={r} lane={lane.key} since={since} />)
                )}
                {all.length > shown.length && (
                  <button type="button" onClick={onShowTable} className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground">
                    {all.length - shown.length} more — see them all in the table
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function InvoiceCard({ row, lane, since }: { row: InvoiceRow; lane: LaneKey; since: number | null }) {
  const balance = balanceOf(row);
  const writtenOff = row.status === InvoiceStatus.WRITTEN_OFF;
  const partial = row.paidPaise > 0 && balance > 0;
  const projects = row.projects ?? [];
  const contracts = row.contracts ?? [];
  const paidAt = lastPaidAt(row);

  return (
    <Link
      href={`/invoices/${row._id}`}
      className={cn(
        'group block rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        lane === 'overdue' && 'border-destructive/30',
        writtenOff && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[12.5px] font-medium group-hover:underline">{row.number}</span>
          <NewDot show={isNewSince(row.createdAt, since) || isNewSince(paidAt, since)} />
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          {lane === 'overdue' && (
            <Badge variant="danger">
              {row.daysOverdue ? `${row.daysOverdue} day${row.daysOverdue === 1 ? '' : 's'} late` : 'Late'}
            </Badge>
          )}
          {partial && <Badge variant="warning">Part paid</Badge>}
          {writtenOff && <Badge variant="muted">Written off</Badge>}
        </div>
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2 text-[13px]">
        {row.clientName ? (
          <>
            <Avatar id={row.clientId} name={row.clientName} size="xs" />
            <span className="truncate font-medium">{row.clientName}</span>
            {row.clientDeleted && <span className="shrink-0 text-xs text-muted-foreground">(deleted)</span>}
          </>
        ) : (
          <>
            <span className="h-5 w-5 shrink-0 rounded-full border border-dashed" aria-hidden />
            <span className="text-muted-foreground">Deleted client</span>
          </>
        )}
      </div>

      {(projects.length > 0 || contracts.length > 0) && (
        <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {projects.slice(0, 2).map((p) =>
            p.name ? (
              <ProjectChip key={p._id} id={p._id} name={p.name} className="max-w-full" />
            ) : (
              <span key={p._id}>Deleted project</span>
            ),
          )}
          {projects.length === 0 &&
            contracts.slice(0, 2).map((c) => <span key={c._id} className="truncate">{c.name ?? 'Deleted contract'}</span>)}
          {projects.length > 2 && <span>+{projects.length - 2} more</span>}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {lane === 'sent' || lane === 'overdue' ? (
            <>
              <Price
                paise={balance}
                currency={row.currency}
                className={cn('block text-[15px] font-semibold', lane === 'overdue' && 'text-destructive')}
              />
              <span className="text-[11px] text-muted-foreground">
                {partial ? (
                  <>
                    due of <Price paise={row.totalPaise} currency={row.currency} />
                  </>
                ) : (
                  'due'
                )}
              </span>
            </>
          ) : (
            <>
              <Price
                paise={row.totalPaise}
                currency={row.currency}
                className={cn('block text-[15px] font-semibold', writtenOff && 'text-muted-foreground line-through')}
              />
              {writtenOff && row.paidPaise > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  <Price paise={row.paidPaise} currency={row.currency} /> received
                </span>
              )}
            </>
          )}
        </div>
        <span className={cn('shrink-0 text-right text-[11px] text-muted-foreground', lane === 'overdue' && 'text-destructive')}>
          {lane === 'draft'
            ? row.issueDate
              ? `Dated ${formatDate(row.issueDate)}`
              : 'Not dated'
            : lane === 'paid'
              ? writtenOff
                ? row.writtenOffAt
                  ? `Written off ${formatDate(row.writtenOffAt)}`
                  : ''
                : paidAt
                  ? `Paid ${formatDate(paidAt)}`
                  : ''
              : row.dueDate
                ? `${lane === 'overdue' ? 'Was due' : 'Due'} ${formatDate(row.dueDate)}`
                : 'No due date'}
        </span>
      </div>
    </Link>
  );
}

function LanesSkeleton() {
  return (
    <div className="overflow-x-auto pb-1" aria-busy>
      <div className="grid min-w-full auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 lg:auto-cols-[calc((100%_-_2.25rem)/4)]">
        {LANES.map((l) => (
          <div key={l.key} className="space-y-2 rounded-[var(--radius)] border bg-muted/40 p-2.5">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
