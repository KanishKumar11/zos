// Expenses overview (the default view): where the money went, the monthly trend and recurring costs.
'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Bento, BigNumber, Price, Tile, TrendDelta } from '@/components/viz';

import { CategoryTreemap } from './category-treemap';
import { categoryLabel } from './expense-meta';
import type { ExpenseRow, ExpenseSummary, ExpenseWindow } from './expenses.hooks';
import { lastMonths, monthName, monthStartYmd, monthToDate, sumByMonth } from './money-time';
import { MonthlyBars } from './monthly-bars';
import { expectedInMonth, recurringSeries } from './recurring';

/** yyyy-mm-dd → "3 Nov" (local noon so it never slips a day). */
const shortDay = (ymd: string) => formatDate(`${ymd}T12:00:00`, { day: 'numeric', month: 'short' });

export function ExpensesOverview({
  summary,
  window: win,
  rangeLabel,
  dateFiltered,
  filtered,
  selectedCategory,
  onSelectCategory,
  onRepeat,
  repeatPending,
  onCreate,
  onClearFilters,
}: {
  /** Summary for the current filters (category totals + gross / net). */
  summary: UseQueryResult<ExpenseSummary>;
  /** Rows for the last 13 months with the current filters except the date range. */
  window: UseQueryResult<ExpenseWindow>;
  rangeLabel: string;
  dateFiltered: boolean;
  filtered: boolean;
  selectedCategory?: string;
  onSelectCategory: (category: string) => void;
  onRepeat: (row: ExpenseRow) => void;
  repeatPending: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  if (summary.isLoading) return <OverviewSkeleton />;
  if (summary.error && !summary.data) {
    return (
      <div className="rounded-[var(--radius)] border bg-card">
        <ErrorState error={summary.error} title="Couldn't load expenses" onRetry={() => void summary.refetch()} />
      </div>
    );
  }
  const s = summary.data;
  if (!s || s.count === 0) {
    return (
      <div className="rounded-[var(--radius)] border bg-card">
        {filtered ? (
          <EmptyState
            illustration="money"
            title="No expenses match these filters"
            action={
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            illustration="money"
            title="No expenses yet"
            description="Log tools, hosting, marketing and other running costs to see where the money goes and your real profit."
            action={
              <Button size="sm" onClick={onCreate}>
                Add your first expense
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const recovered = s.grossPaise - s.netPaise;
  const slices = s.byCategory.map((c) => ({ key: c._id, label: categoryLabel(c._id), paise: c.totalPaise, color: identityColor(c._id), count: c.count }));

  return (
    <Bento>
      <Tile span={8} title="Where it went" action={<span className="text-xs text-muted-foreground">{rangeLabel}</span>}>
        <CategoryTreemap slices={slices} selected={selectedCategory} onSelect={onSelectCategory} label="Spend by category" />
      </Tile>

      <Tile span={4} tone="ink" title={filtered ? 'Spent (filtered)' : 'Spent'}>
        <BigNumber caption={`${s.count} ${s.count === 1 ? 'entry' : 'entries'} · ${rangeLabel}`}>
          <Price paise={s.grossPaise} className="font-display" />
        </BigNumber>
        <dl className="mt-5 space-y-2 border-t border-background/15 pt-4 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-background/70">Net cost</dt>
            <dd>
              <Price paise={s.netPaise} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-background/70">Covered by team</dt>
            <dd>{recovered > 0 ? <Price paise={recovered} /> : <span className="text-background/60">Nothing</span>}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-background/70">Average entry</dt>
            <dd>
              <Price paise={Math.round(s.grossPaise / s.count)} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-background/60">Net cost is what the agency bears after team members chip in through their pay.</p>
      </Tile>

      <TrendTile win={win} dateFiltered={dateFiltered} />
      <RecurringTile win={win} onRepeat={onRepeat} repeatPending={repeatPending} />
    </Bento>
  );
}

function TrendTile({ win, dateFiltered }: { win: UseQueryResult<ExpenseWindow>; dateFiltered: boolean }) {
  const today = todayLocal();
  const months = useMemo(() => lastMonths(12), []);
  const rows = win.data?.items;
  const values = useMemo(() => (rows ? sumByMonth(rows, months, (r) => r.date, (r) => r.amountPaise) : []), [rows, months]);
  const mtd = useMemo(() => (rows ? monthToDate(rows, today, (r) => r.date, (r) => r.amountPaise) : null), [rows, today]);

  return (
    <Tile
      span={7}
      title="Monthly spend"
      action={<span className="text-xs text-muted-foreground">Last 12 months{dateFiltered ? ' · ignores the date filter' : ''}</span>}
    >
      {win.isLoading ? (
        <Skeleton className="h-[214px] w-full" />
      ) : win.error && !win.data ? (
        <ErrorState error={win.error} title="Couldn't load the trend" onRetry={() => void win.refetch()} className="py-8" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[13px] text-muted-foreground">This month so far</span>
            <Price paise={mtd?.current ?? 0} className="font-display text-2xl font-bold" />
            {mtd && <TrendDelta current={mtd.current} previous={mtd.previous} invert suffix="vs this time last month" />}
          </div>
          <MonthlyBars months={months} values={values} seriesName="Spent" label="Monthly spend, last 12 months" />
          {win.data?.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">Showing the newest 5,000 entries — narrow the filters for a complete picture.</p>
          )}
        </>
      )}
    </Tile>
  );
}

function RecurringTile({
  win,
  onRepeat,
  repeatPending,
}: {
  win: UseQueryResult<ExpenseWindow>;
  onRepeat: (row: ExpenseRow) => void;
  repeatPending: boolean;
}) {
  const today = todayLocal();
  const rows = win.data?.items;
  const series = useMemo(() => (rows ? recurringSeries(rows, today) : []), [rows, today]);
  const monthly = series.reduce((sum, x) => sum + x.monthlyPaise, 0);
  const nextMonthKey = monthStartYmd(1).slice(0, 7);
  const expected = expectedInMonth(series, nextMonthKey);
  const nextMonthName = monthName(1);

  return (
    <Tile span={5} title="Recurring costs" action={<Repeat className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}>
      {win.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : win.error && !win.data ? (
        <ErrorState error={win.error} title="Couldn't load recurring costs" onRetry={() => void win.refetch()} className="py-8" />
      ) : series.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing is set to repeat. Mark subscriptions and retainers as monthly or yearly when you add them, and they&apos;ll gather here with
          their next due dates.
        </p>
      ) : (
        <>
          <BigNumber caption={`a month, across ${series.length} ${series.length === 1 ? 'repeating cost' : 'repeating costs'}`}>
            <Price paise={monthly} compact className="font-display" />
          </BigNumber>
          <div className="mt-3 flex items-baseline justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Expected in {nextMonthName}</span>
            <Price paise={expected} className="font-medium" />
          </div>
          <ul className="mt-3 divide-y text-[13px]">
            {series.slice(0, 5).map((x) => (
              <li key={x.row._id} className="flex items-center gap-2 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: identityColor(x.row.category) }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{x.row.title}</span>
                    <Badge variant="muted" className="shrink-0">
                      {x.cadence === 'YEARLY' ? 'Yearly' : 'Monthly'}
                    </Badge>
                  </div>
                  <span className={cn('text-xs', x.overdue ? 'text-warning' : 'text-muted-foreground')}>
                    {x.nextDue === today ? 'Due today' : x.overdue ? `Was due ${shortDay(x.nextDue)}` : `Next ${shortDay(x.nextDue)}`}
                  </span>
                </div>
                <Price paise={x.row.amountPaise} currency={x.row.currency} compact className="text-xs" />
                {x.overdue && (
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={repeatPending} onClick={() => onRepeat(x.row)}>
                    Log it
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {series.length > 5 && <p className="mt-1 text-xs text-muted-foreground">And {series.length - 5} more.</p>}
        </>
      )}
    </Tile>
  );
}

function OverviewSkeleton() {
  return (
    <Bento aria-busy="true" aria-label="Loading overview">
      <div className="col-span-12 rounded-[var(--radius)] border bg-card p-5 lg:col-span-8">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="h-[260px] w-full" />
      </div>
      <div className="col-span-12 rounded-[var(--radius)] border bg-card p-5 sm:col-span-6 lg:col-span-4">
        <Skeleton className="mb-4 h-4 w-20" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
      <div className="col-span-12 rounded-[var(--radius)] border bg-card p-5 lg:col-span-7">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="h-[200px] w-full" />
      </div>
      <div className="col-span-12 rounded-[var(--radius)] border bg-card p-5 lg:col-span-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </Bento>
  );
}
