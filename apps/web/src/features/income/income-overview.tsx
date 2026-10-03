// Other-income overview (the default view): category treemap, monthly trend and top sources.
// Other income has no repeat schedule, so there is no recurring tile here.
'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { todayLocal } from '@/lib/form';
import { identityColor } from '@/lib/identity';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Bento, BigNumber, Price, Tile, TrendDelta } from '@/components/viz';
import { CategoryTreemap } from '@/features/expenses/category-treemap';
import { lastMonths, monthToDate, sumByMonth } from '@/features/expenses/money-time';
import { MonthlyBars } from '@/features/expenses/monthly-bars';

import { incomeCategoryLabel } from './income-meta';
import type { IncomeSummary, IncomeWindow } from './income.hooks';

export function IncomeOverview({
  summary,
  window: win,
  rangeLabel,
  dateFiltered,
  filtered,
  selectedCategory,
  onSelectCategory,
  onCreate,
  onClearFilters,
}: {
  /** Summary for the current filters. */
  summary: UseQueryResult<IncomeSummary>;
  /** Rows for the last 12 months with the current filters except the date range. */
  window: UseQueryResult<IncomeWindow>;
  rangeLabel: string;
  dateFiltered: boolean;
  filtered: boolean;
  selectedCategory?: string;
  onSelectCategory: (category: string) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  if (summary.isLoading) return <OverviewSkeleton />;
  if (summary.error && !summary.data) {
    return (
      <div className="rounded-[var(--radius)] border bg-card">
        <ErrorState error={summary.error} title="Couldn't load income" onRetry={() => void summary.refetch()} />
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
            title="No income matches these filters"
            action={
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            illustration="money"
            title="No other income yet"
            description="Record affiliate payouts, referral fees, interest and refunds so profit figures include them."
            action={
              <Button size="sm" onClick={onCreate}>
                Add income
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const top = s.byCategory[0];
  const slices = s.byCategory.map((c) => ({ key: c._id, label: incomeCategoryLabel(c._id), paise: c.totalPaise, color: identityColor(c._id), count: c.count }));

  return (
    <Bento>
      <Tile span={8} title="Where it came from" action={<span className="text-xs text-muted-foreground">{rangeLabel}</span>}>
        <CategoryTreemap slices={slices} selected={selectedCategory} onSelect={onSelectCategory} label="Income by category" />
      </Tile>

      <Tile span={4} tone="ink" title={filtered ? 'Received (filtered)' : 'Received'}>
        <BigNumber caption={`${s.count} ${s.count === 1 ? 'entry' : 'entries'} · ${rangeLabel}`}>
          <Price paise={s.grandTotalPaise} className="font-display" />
        </BigNumber>
        <dl className="mt-5 space-y-2 border-t border-background/15 pt-4 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-background/70">Average entry</dt>
            <dd>
              <Price paise={Math.round(s.grandTotalPaise / s.count)} />
            </dd>
          </div>
          {top && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-background/70">Biggest category</dt>
              <dd className="text-right">
                {incomeCategoryLabel(top._id)} · <Price paise={top.totalPaise} compact />
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-background/60">Counted in the dashboard&apos;s profit alongside client payments.</p>
      </Tile>

      <TrendTile win={win} dateFiltered={dateFiltered} />
      <SourcesTile win={win} dateFiltered={dateFiltered} />
    </Bento>
  );
}

function TrendTile({ win, dateFiltered }: { win: UseQueryResult<IncomeWindow>; dateFiltered: boolean }) {
  const today = todayLocal();
  const months = useMemo(() => lastMonths(12), []);
  const rows = win.data?.items;
  const values = useMemo(() => (rows ? sumByMonth(rows, months, (r) => r.date, (r) => r.amountPaise) : []), [rows, months]);
  const mtd = useMemo(() => (rows ? monthToDate(rows, today, (r) => r.date, (r) => r.amountPaise) : null), [rows, today]);

  return (
    <Tile
      span={7}
      title="Monthly income"
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
            {mtd && <TrendDelta current={mtd.current} previous={mtd.previous} suffix="vs this time last month" />}
          </div>
          <MonthlyBars months={months} values={values} seriesName="Received" label="Monthly other income, last 12 months" />
          {win.data?.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">Showing the newest 5,000 entries — narrow the filters for a complete picture.</p>
          )}
        </>
      )}
    </Tile>
  );
}

function SourcesTile({ win, dateFiltered }: { win: UseQueryResult<IncomeWindow>; dateFiltered: boolean }) {
  const rows = win.data?.items;
  const sources = useMemo(() => {
    const by = new Map<string, { label: string; paise: number; count: number }>();
    for (const r of rows ?? []) {
      const label = r.source?.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const cur = by.get(key) ?? { label, paise: 0, count: 0 };
      cur.paise += r.amountPaise;
      cur.count += 1;
      by.set(key, cur);
    }
    return [...by.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.paise - a.paise);
  }, [rows]);
  const unnamed = (rows ?? []).filter((r) => !r.source?.trim()).length;
  const max = Math.max(1, ...sources.map((x) => x.paise));

  return (
    <Tile
      span={5}
      title="Top sources"
      action={<span className="text-xs text-muted-foreground">Last 12 months{dateFiltered ? ' · ignores the date filter' : ''}</span>}
    >
      {win.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : win.error && !win.data ? (
        <ErrorState error={win.error} title="Couldn't load sources" onRetry={() => void win.refetch()} className="py-8" />
      ) : sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows && rows.length > 0
            ? 'None of these entries name a source yet. Add who paid you (an affiliate programme, a bank, a partner) to see who sends the most.'
            : 'Nothing received in the last 12 months.'}
        </p>
      ) : (
        <>
          <ul className="space-y-2.5 text-[13px]">
            {sources.slice(0, 6).map((x) => (
              <li key={x.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{x.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {x.count} {x.count === 1 ? 'entry' : 'entries'} · <Price paise={x.paise} compact className="text-foreground" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (x.paise / max) * 100)}%`, background: identityColor(x.key) }} />
                </div>
              </li>
            ))}
          </ul>
          {(sources.length > 6 || unnamed > 0) && (
            <p className="mt-3 text-xs text-muted-foreground">
              {sources.length > 6 ? `${sources.length - 6} more ${sources.length - 6 === 1 ? 'source' : 'sources'}` : ''}
              {sources.length > 6 && unnamed > 0 ? ' · ' : ''}
              {unnamed > 0 ? `${unnamed} ${unnamed === 1 ? 'entry has' : 'entries have'} no source` : ''}
            </p>
          )}
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
