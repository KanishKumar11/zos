// Payments out — the full ledger of money paid to team members and freelancers (OWNER).
// Opens with a sentence about this month, a paid-out calendar, then the payments as a day-by-day
// timeline (default) or the table. Filters, list state, CSV and the import banner work in both views.
'use client';

import { History, ListTree, MoreHorizontal, Pencil, Rows3, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
  PAYOUT_CATEGORY_LABEL,
  PAYOUT_METHOD_LABEL,
  PayeeType,
  PayoutCategory,
  PayoutMethod,
  type ListPayoutsQuery,
} from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { csvMoney } from '@/lib/csv';
import { describeRange } from '@/lib/date-range';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useQuickActions } from '@/store/quick-actions.store';

import { DataTable, exportColumnsCsv, type Column } from '@/components/data/data-table';
import { DateRangeFilter, ExportButton, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  Bento,
  BigNumber,
  CalendarHeatmap,
  formatCompact,
  Hero,
  HeroFigure,
  HeroMark,
  Price,
  PrivacyChip,
  Tile,
  useCanSeePrices,
} from '@/components/viz';
import { useFreelancers } from '@/features/freelancers/freelancers.hooks';
import { PayeeBars } from '@/features/payouts/payee-bars';
import { heatDays, heatWindowStart, monthStartLocal, payDay } from '@/features/payouts/payout-days';
import { useLastVisit } from '@/lib/last-visit';
import { PayoutDayTimeline, PayoutProject, payeeHref } from '@/features/payouts/payout-timeline';
import {
  payoutsApi,
  useDeletePayout,
  useImportLegacy,
  useImportStatus,
  usePayouts,
  type PayoutRow,
} from '@/features/payouts/payouts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

const PAGE_SIZE = 25;
const HEAT_WEEKS = 26;
/** The API's largest page — used for the calendar and the "who was paid most" summary. */
const SUMMARY_SIZE = 500;

type View = 'timeline' | 'table';

export default function PaymentsPage() {
  const since = useLastVisit('payments');
  const list = useListState('payments', {
    q: '',
    payee: '',
    userId: '',
    freelancerId: '',
    projectId: '',
    payeeType: '',
    method: '',
    category: '',
    range: '',
    from: '',
    to: '',
    sort: 'paidAt:desc',
    view: 'timeline',
  });
  const { params } = list;
  const view: View = params.view === 'table' ? 'table' : 'timeline';
  const canSee = useCanSeePrices();
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  useNewParam(() => openLogPayment());
  const confirm = useConfirm();
  const remove = useDeletePayout();
  const staff = useStaffDirectory();
  const freelancers = useFreelancers();
  const projects = useAllProjects();

  const filters: ListPayoutsQuery = {
    q: params.q || undefined,
    userId: params.userId || undefined,
    freelancerId: params.freelancerId || undefined,
    projectId: params.projectId || undefined,
    payeeType: (params.payeeType || undefined) as PayeeType | undefined,
    method: (params.method || undefined) as PayoutMethod | undefined,
    category: (params.category || undefined) as PayoutCategory | undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const query: ListPayoutsQuery = {
    ...filters,
    page: list.page,
    pageSize: PAGE_SIZE,
    // The timeline is always newest first; the table honours the chosen sort.
    sort: view === 'table' ? ((params.sort || undefined) as ListPayoutsQuery['sort']) : 'paidAt:desc',
  };
  const payouts = usePayouts(query);
  // Everything matching the filters (up to the API's page limit) for "who was paid the most".
  const summary = usePayouts({ ...filters, page: 1, pageSize: SUMMARY_SIZE, sort: 'paidAt:desc' }, { enabled: view === 'timeline' });
  // Company-wide window for the hero sentence and the calendar (not affected by filters).
  const windowFrom = heatWindowStart(HEAT_WEEKS);
  const recent = usePayouts({ from: windowFrom, page: 1, pageSize: SUMMARY_SIZE, sort: 'paidAt:desc' });

  const payeeOptions = useMemo(
    () => [
      ...(staff.data ?? []).map((u) => ({ value: `u:${u._id}`, label: u.name, group: 'Team' })),
      ...(freelancers.data ?? []).map((f) => ({ value: `f:${f._id}`, label: f.name, group: 'Freelancers' })),
    ],
    [staff.data, freelancers.data],
  );
  const payeeValue = params.userId ? `u:${params.userId}` : params.freelancerId ? `f:${params.freelancerId}` : undefined;

  const deletePayment = async (r: PayoutRow) => {
    const ok = await confirm({
      title: 'Delete this payment?',
      description: `${canSee ? `${formatCompact(r.amountPaise, r.currency)} to ` : 'The payment to '}${r.payeeName} on ${formatDate(r.paidAt)} will be removed. Balances update straight away, and it's recorded in the audit log.`,
      destructive: true,
      confirmText: 'Delete payment',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(r._id);
    } catch {
      // The global mutation handler shows the error toast.
    }
  };

  const pageSum = (payouts.data?.items ?? []).reduce((s, r) => s + r.amountPaise, 0);

  const columns: Column<PayoutRow>[] = [
    {
      id: 'paidAt',
      header: 'Date',
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.paidAt)}</span>,
      csv: (r) => payDay(r),
      footer: <span className="text-muted-foreground">This page</span>,
    },
    {
      id: 'payee',
      header: 'Paid to',
      cell: (r) => {
        const href = payeeHref(r);
        return (
          <div className="flex items-center gap-2">
            {href ? (
              <Link href={href} className="font-medium hover:underline">
                {r.payeeName}
              </Link>
            ) : (
              <span className="font-medium">{r.payeeName}</span>
            )}
            {r.payeeType === PayeeType.FREELANCER && <Badge variant="info">Freelancer</Badge>}
          </div>
        );
      },
      csv: (r) => r.payeeName,
    },
    { id: 'payeeType', header: 'Type', cell: () => null, className: 'hidden', csv: (r) => (r.payeeType === PayeeType.MEMBER ? 'Team' : 'Freelancer') },
    {
      id: 'project',
      header: 'Project',
      cell: (r) => <PayoutProject row={r} />,
      csv: (r) => (r.projectId ? (r.projectName ?? 'Deleted project') : 'General'),
    },
    {
      id: 'method',
      header: 'Method',
      hideBelow: 'md',
      cell: (r) => (
        <span className="text-muted-foreground">
          {PAYOUT_METHOD_LABEL[r.method]}
          {r.reference ? <span className="block text-xs">{r.reference}</span> : null}
        </span>
      ),
      csv: (r) => PAYOUT_METHOD_LABEL[r.method],
    },
    { id: 'reference', header: 'Reference', cell: () => null, className: 'hidden', csv: (r) => r.reference },
    {
      id: 'category',
      header: 'Kind',
      hideBelow: 'lg',
      cell: (r) => <span className="text-muted-foreground">{PAYOUT_CATEGORY_LABEL[r.category]}</span>,
      csv: (r) => PAYOUT_CATEGORY_LABEL[r.category],
    },
    {
      id: 'note',
      header: 'Note',
      hideBelow: 'lg',
      cell: (r) => <span className="line-clamp-1 max-w-[220px] text-muted-foreground">{r.note}</span>,
      csv: (r) => r.note,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      cell: (r) => <Price paise={r.amountPaise} currency={r.currency} className="font-medium" />,
      csv: (r) => csvMoney(r.amountPaise),
      csvHeader: 'Amount (₹)',
      footer: <Price paise={pageSum} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        // Menu clicks bubble through the portal to the row; stop them here so the row doesn't open too.
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Actions for payment to ${r.payeeName}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openLogPayment({}, r._id)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit payment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void deletePayment(r)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete payment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
  const visibleColumns = columns.filter((c) => c.className !== 'hidden');

  const exportAll = async () => {
    if (!canSee) return;
    try {
      const all = await payoutsApi.list({ ...query, page: 1, pageSize: SUMMARY_SIZE });
      exportColumnsCsv(`payments-${todayLocal()}`, columns, all.items);
    } catch (err) {
      toast.error(`Couldn't export: ${getErrorMessage(err)}`);
    }
  };

  const totals = payouts.data?.totals;
  const filterCount = list.activeFilterCount - (params.view && params.view !== 'timeline' ? 1 : 0);
  const filtered = filterCount > 0;
  const rangeText = params.from || params.to ? describeRange(params.from, params.to) : 'All time';

  // Clear the filters but stay on the chosen view.
  const clearFilters = () =>
    list.set({ q: '', payee: '', userId: '', freelancerId: '', projectId: '', payeeType: '', method: '', category: '', range: '', from: '', to: '', sort: 'paidAt:desc' });

  const filteredEmpty = (
    <EmptyState
      illustration="money"
      title="No payments match these filters"
      action={
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  );
  const firstEmpty = (
    <EmptyState
      illustration="money"
      title="No payments logged yet"
      description="Log what you pay team members and freelancers, project by project. Balances update as you go."
      action={
        <Button size="sm" variant="brand" onClick={() => openLogPayment()}>
          Log your first payment
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <PaymentsHero rows={recent.data?.items} windowTotal={recent.data?.totals.amountPaise ?? 0} loading={recent.isLoading} error={recent.isError} onLog={() => openLogPayment()} />

      <ImportBanner />

      <Bento>
        <Tile
          span={8}
          title={`Paid out per day · last ${HEAT_WEEKS} weeks`}
          action={
            recent.data && recent.data.items.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                <Price paise={recent.data.totals.amountPaise} compact className="text-foreground" /> across {recent.data.totals.count} payment
                {recent.data.totals.count === 1 ? '' : 's'}
              </span>
            ) : undefined
          }
        >
          {recent.isLoading ? (
            <Skeleton className="h-[132px] w-full" />
          ) : recent.isError ? (
            <ErrorState title="Couldn't load the calendar" error={recent.error} onRetry={() => recent.refetch()} className="py-6" />
          ) : (
            <>
              <CalendarHeatmap
                days={heatDays(recent.data?.items ?? [])}
                weeks={HEAT_WEEKS}
                split={false}
                colorA="hsl(var(--primary))"
                labelA="Paid out"
                format={(v) => (canSee ? formatCompact(v) : '')}
              />
              {recent.data && recent.data.meta.total > recent.data.items.length && (
                <p className="mt-2 text-xs text-muted-foreground">Showing the latest {recent.data.items.length} payments in this window.</p>
              )}
            </>
          )}
        </Tile>
        <Tile span={4} tone="ink" title={filtered ? 'Total for these filters' : 'Total paid out'}>
          {payouts.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-40 bg-background/20" />
              <Skeleton className="h-3 w-28 bg-background/20" />
            </div>
          ) : (
            <div className="space-y-4">
              <BigNumber caption={rangeText}>
                <Price paise={totals?.amountPaise ?? 0} compact className="text-brand" />
              </BigNumber>
              <dl className="grid grid-cols-2 gap-3 border-t border-background/15 pt-3 text-sm">
                <div>
                  <dt className="text-xs opacity-70">Payments</dt>
                  <dd className="font-figures font-semibold">{totals?.count ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs opacity-70">Average</dt>
                  <dd className="font-semibold">
                    <Price paise={totals && totals.count ? Math.round(totals.amountPaise / totals.count) : 0} compact />
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Tile>
      </Bento>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">All payments</h2>
          <div className="flex flex-wrap items-center gap-2">
            {canSee && <ExportButton onClick={() => void exportAll()} disabled={!payouts.data?.items.length} />}
            <ViewToggle<View>
              value={view}
              onChange={(v) => list.set({ view: v })}
              options={[
                { value: 'timeline', label: 'Timeline', icon: ListTree },
                { value: 'table', label: 'Table', icon: Rows3 },
              ]}
            />
          </div>
        </div>

        <FilterBar>
          <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search name, project, note, reference" />
          <div className="w-full sm:w-56">
            <Combobox
              options={payeeOptions}
              value={payeeValue}
              allowClear
              placeholder="Anyone"
              searchPlaceholder="Search people…"
              onChange={(v) =>
                list.set({
                  userId: v?.startsWith('u:') ? v.slice(2) : '',
                  freelancerId: v?.startsWith('f:') ? v.slice(2) : '',
                })
              }
            />
          </div>
          <div className="w-full sm:w-56">
            <Combobox
              options={(projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name, keywords: p.code }))}
              value={params.projectId || undefined}
              allowClear
              placeholder="Any project"
              searchPlaceholder="Search projects…"
              onChange={(v) => list.set({ projectId: v ?? '' })}
            />
          </div>
          <SelectFilter
            value={params.payeeType}
            onChange={(payeeType) => list.set({ payeeType })}
            allLabel="Team & freelancers"
            options={[
              { value: PayeeType.MEMBER, label: 'Team only' },
              { value: PayeeType.FREELANCER, label: 'Freelancers only' },
            ]}
          />
          <SelectFilter
            value={params.method}
            onChange={(method) => list.set({ method })}
            allLabel="Any method"
            options={Object.values(PayoutMethod).map((m) => ({ value: m, label: PAYOUT_METHOD_LABEL[m] }))}
          />
          <SelectFilter
            value={params.category}
            onChange={(category) => list.set({ category })}
            allLabel="Any kind"
            options={Object.values(PayoutCategory).map((c) => ({ value: c, label: PAYOUT_CATEGORY_LABEL[c] }))}
          />
          <DateRangeFilter preset={params.range} from={params.from} to={params.to} onChange={(r) => list.set(r)} />
          <ResetFilters count={Math.max(0, filterCount)} onReset={clearFilters} />
        </FilterBar>
      </div>

      {view === 'timeline' ? (
        <Bento>
          <Tile span={summary.data && summary.data.items.length === 0 ? 12 : 8} title="Day by day">
            {payouts.isLoading ? (
              <TimelineSkeleton />
            ) : payouts.isError ? (
              <ErrorState error={payouts.error} onRetry={() => payouts.refetch()} />
            ) : (
              <div className="space-y-5">
                <PayoutDayTimeline
                  rows={payouts.data?.items ?? []}
                  onOpen={(r) => openLogPayment({}, r._id)}
                  since={since}
                  empty={filtered ? filteredEmpty : firstEmpty}
                />
                {payouts.data && (
                  <Pagination
                    page={list.page}
                    totalPages={payouts.data.meta.totalPages}
                    total={payouts.data.meta.total}
                    pageSize={PAGE_SIZE}
                    onPage={list.setPage}
                  />
                )}
              </div>
            )}
          </Tile>
          {!(summary.data && summary.data.items.length === 0) && (
            <Tile span={4} title="Who was paid the most" action={<span className="text-xs text-muted-foreground">{filtered ? 'These filters' : 'All time'}</span>}>
              {summary.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-7 w-full" />
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-2.5" style={{ width: `${90 - i * 18}%` }} />
                    </div>
                  ))}
                </div>
              ) : summary.isError ? (
                <ErrorState error={summary.error} onRetry={() => summary.refetch()} className="py-6" />
              ) : (
                <>
                  <PayeeBars rows={summary.data?.items ?? []} />
                  {summary.data && summary.data.meta.total > summary.data.items.length && (
                    <p className="mt-2 text-xs text-muted-foreground">Based on the latest {summary.data.items.length} payments.</p>
                  )}
                </>
              )}
            </Tile>
          )}
        </Bento>
      ) : (
        <>
          <DataTable
            columns={visibleColumns}
            rows={payouts.data?.items}
            rowKey={(r) => r._id}
            loading={payouts.isLoading}
            error={payouts.error}
            onRetry={() => payouts.refetch()}
            sort={list.sort ? { by: list.sort.by === 'amount' ? 'amount' : 'paidAt', dir: list.sort.dir } : undefined}
            onSortChange={(s) => list.set({ sort: s ? `${s.by === 'amount' ? 'amount' : 'paidAt'}:${s.dir}` : 'paidAt:desc' })}
            onRowClick={(r) => openLogPayment({}, r._id)}
            showFooter
            empty={filtered ? filteredEmpty : firstEmpty}
          />
          {payouts.data && (
            <Pagination
              page={list.page}
              totalPages={payouts.data.meta.totalPages}
              total={payouts.data.meta.total}
              pageSize={PAGE_SIZE}
              onPage={list.setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

/** "You've paid out ₹X this month to N people — ₹Y of it to freelancers." */
function PaymentsHero({
  rows,
  windowTotal,
  loading,
  error,
  onLog,
}: {
  rows: PayoutRow[] | undefined;
  windowTotal: number;
  loading: boolean;
  error: boolean;
  onLog: () => void;
}) {
  const monthStart = monthStartLocal();
  const all = rows ?? [];
  const month = all.filter((r) => payDay(r) >= monthStart);
  const total = month.reduce((s, r) => s + r.amountPaise, 0);
  const flPaise = month.filter((r) => r.payeeType === PayeeType.FREELANCER).reduce((s, r) => s + r.amountPaise, 0);
  const people = new Map(month.map((r) => [`${r.payeeType}:${r.userId ?? r.freelancerId ?? r.payeeName}`, r.payeeName]));
  const last = all[0];
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  let sentence: ReactNode;
  let lede: ReactNode;
  if (error) {
    sentence = 'Every payment to your team and freelancers, in one place.';
    lede = "We couldn't load this month's figures just now — the calendar below has a retry.";
  } else if (total > 0) {
    const who = people.size === 1 ? [...people.values()][0] : `${people.size} people`;
    sentence = (
      <>
        You&apos;ve paid out{' '}
        <HeroFigure>
          <Price paise={total} compact className="font-display" />
        </HeroFigure>{' '}
        this month to {who}
        {flPaise === 0 ? (
          <>, all of it to your team.</>
        ) : flPaise === total ? (
          <>, all of it to freelancers.</>
        ) : (
          <>
            {' '}
            —{' '}
            <HeroMark>
              <Price paise={flPaise} compact className="font-display" />
            </HeroMark>{' '}
            of it to freelancers.
          </>
        )}
      </>
    );
    lede = (
      <>
        {month.length} payment{month.length === 1 ? '' : 's'} so far this month. Over the last {HEAT_WEEKS} weeks you&apos;ve paid{' '}
        <Price paise={windowTotal} compact className="text-foreground" />.
      </>
    );
  } else {
    sentence = 'Nothing paid out yet this month.';
    lede = last ? (
      <>
        Your last payment was <Price paise={last.amountPaise} currency={last.currency} compact className="text-foreground" /> to {last.payeeName} on{' '}
        {formatDate(last.paidAt)}.
      </>
    ) : (
      'When you pay someone, log it here and every project and person balance updates with it.'
    );
  }

  return (
    <Hero
      pageTitle="Payments out"
      eyebrow={`Payments out · ${monthName}`}
      loading={loading}
      lede={lede}
      aside={
        <>
          <PrivacyChip>Only you see these figures</PrivacyChip>
          <Button variant="brand" size="sm" onClick={onLog}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
          </Button>
        </>
      }
    >
      {sentence}
    </Hero>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-3.5 w-24" />
          {Array.from({ length: 3 }).map((__, i) => (
            <div key={i} className="flex items-center gap-3 pl-6">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** One-time import of payments recorded the old way (on projects / old freelancer records). */
function ImportBanner() {
  const status = useImportStatus();
  const importLegacy = useImportLegacy();
  const confirm = useConfirm();
  const s = status.data;
  if (!s?.pending) return null;
  const count = s.memberPayments + s.freelancerPayments;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-info/30 bg-info/5 p-4 sm:flex-row sm:items-center">
      <History className="h-5 w-5 shrink-0 text-info" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Bring your older payments into this ledger</p>
        <p className="text-muted-foreground">
          {count} payment{count === 1 ? '' : 's'} were recorded the old way
          {s.freelancerRecords ? ` (including ${s.freelancerRecords} freelancer record${s.freelancerRecords === 1 ? '' : 's'})` : ''}. Import them so
          balances and reports include them. It&apos;s safe to run more than once.
        </p>
      </div>
      <Button
        size="sm"
        disabled={importLegacy.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: `Import ${count} older payment${count === 1 ? '' : 's'}?`,
            description:
              'Team payments move from projects into the ledger. Old freelancer records become freelancer profiles linked to their projects; any we can’t match will be listed on the Freelancers page for you to link.',
            confirmText: 'Import',
          });
          if (ok) importLegacy.mutate();
        }}
      >
        {importLegacy.isPending ? 'Importing…' : 'Import now'}
      </Button>
    </div>
  );
}
