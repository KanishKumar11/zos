// Invoices list (OWNER-only) — filters live in the URL so other pages can link here
// (?status=OVERDUE, ?status=open, ?status=open&aging=current|1-30|31-60|60plus, ?clientId=,
// ?projectId=, ?new=1). Opens with a narrative hero and an aging bar; the default view is status
// lanes, with the original table one toggle away.
'use client';

import { useLastVisit } from '@/lib/last-visit';
import { LayoutGrid, Plus, Rows3, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { InvoiceStatus, Role, type ListInvoicesQuery } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import {
  DateRangeFilter,
  ExportButton,
  FilterBar,
  ResetFilters,
  SearchFilter,
  SelectFilter,
} from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { Bento, BigNumber, Hero, HeroFigure, HeroMark, PrivacyChip, Price, ProjectChip, Tile, useCanSeePrices } from '@/components/viz';
import { getErrorMessage } from '@/lib/api-client';
import { csvMoney } from '@/lib/csv';
import { describeRange, presetRange } from '@/lib/date-range';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { useClients } from '@/features/clients/clients.hooks';
import { AGING_COLOR, AGING_LABEL, agingBucketOf, balanceOf, isAgingKey, type AgingKey } from '@/features/invoices/invoice-aging';
import { InvoiceAgingBar } from '@/features/invoices/invoice-aging-bar';
import { InvoiceFormDialog } from '@/features/invoices/invoice-form-dialog';
import { InvoiceLanes } from '@/features/invoices/invoice-lanes';
import {
  invoicesApi,
  useInvoiceDashboard,
  useInvoiceList,
  useInvoicePage,
  useInvoices,
  type InvoiceListFilters,
  type InvoiceListTotals,
  type InvoiceRow,
} from '@/features/invoices/invoices.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open (sent, part paid, overdue)' },
  { value: InvoiceStatus.OVERDUE, label: 'Overdue' },
  { value: InvoiceStatus.DRAFT, label: 'Draft' },
  { value: InvoiceStatus.SENT, label: 'Sent' },
  { value: InvoiceStatus.PARTIAL, label: 'Part paid' },
  { value: InvoiceStatus.PAID, label: 'Paid' },
  { value: InvoiceStatus.WRITTEN_OFF, label: 'Written off' },
];
/** Statuses that can never have an aging bucket — picking one clears the aging filter. */
const CLOSED_STATUSES = new Set<string>([InvoiceStatus.DRAFT, InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF]);
const SORT_IDS = new Set(['number', 'issueDate', 'dueDate', 'total', 'balance']);

type View = 'board' | 'table';

const DEFAULTS = {
  q: '',
  status: '',
  clientId: '',
  projectId: '',
  range: '',
  from: '',
  to: '',
  aging: '',
  view: 'board',
  sort: 'issueDate:desc',
};
/** Everything "Clear filters" resets — the chosen view stays. */
const FILTER_RESET = { q: '', status: '', clientId: '', projectId: '', range: '', from: '', to: '', aging: '' };

export default function InvoicesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Only the owner can see invoices.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const since = useLastVisit('invoices');
  const router = useRouter();
  const canSeePrices = useCanSeePrices();
  const list = useListState('invoices', DEFAULTS);
  const { params } = list;
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  useNewParam(() => setCreateOpen(true));

  const view: View = params.view === 'table' ? 'table' : 'board';
  const aging: AgingKey | null = isAgingKey(params.aging) ? params.aging : null;
  const status = params.status === 'overdue' ? InvoiceStatus.OVERDUE : params.status;
  // `view` lives in the list state so it is remembered, but it isn't a filter.
  const filterCount = list.activeFilterCount - (params.view && params.view !== DEFAULTS.view ? 1 : 0);
  const filtered = filterCount > 0;
  const resetFilters = () => list.set(FILTER_RESET);

  const clients = useClients();
  const projects = useAllProjects();
  const dash = useInvoiceDashboard();
  // Every open invoice — the hero sentence (whole business) and the aging bar (respects client/project).
  const openAll = useInvoices({ status: 'open' });
  const openScoped = useInvoices({ status: 'open', clientId: params.clientId || undefined, projectId: params.projectId || undefined });

  // The server list has no aging filter: when one is set, load the full open list with the other
  // filters and narrow it here (lanes and table alike).
  const listFilters: InvoiceListFilters = {
    q: params.q || undefined,
    status: ((aging ? status || 'open' : status) || undefined) as InvoiceListFilters['status'],
    clientId: params.clientId || undefined,
    projectId: params.projectId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const clientSide = view === 'board' || !!aging;
  const full = useInvoiceList(listFilters, clientSide);
  const clientRows = useMemo(
    () => (aging ? (full.data ?? []).filter((r) => agingBucketOf(r) === aging) : full.data),
    [full.data, aging],
  );

  const query: ListInvoicesQuery = {
    page: list.page,
    pageSize: PAGE_SIZE,
    q: params.q || undefined,
    status: (status || undefined) as ListInvoicesQuery['status'],
    clientId: params.clientId || undefined,
    projectId: params.projectId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    sort: (params.sort || undefined) as ListInvoicesQuery['sort'],
  };
  const serverTable = view === 'table' && !aging;
  const invoices = useInvoicePage(query, serverTable);

  const sortState = list.sort && SORT_IDS.has(list.sort.by) ? list.sort : undefined;

  const clientOptions = useMemo(
    () => (clients.data ?? []).map((c) => ({ value: c._id, label: c.name })),
    [clients.data],
  );
  const projectOptions = useMemo(
    () =>
      (projects.data?.items ?? [])
        .filter((p) => !params.clientId || p.clientId === params.clientId)
        .map((p) => ({ value: p._id, label: p.name, keywords: p.code })),
    [projects.data, params.clientId],
  );

  // Client-side table (aging filter on): sort + paginate locally, totals from the filtered rows.
  const localTotals: InvoiceListTotals | undefined = useMemo(() => {
    if (!clientRows) return undefined;
    return clientRows.reduce<InvoiceListTotals>(
      (t, r) => ({
        count: t.count + 1,
        totalPaise: t.totalPaise + r.totalPaise,
        paidPaise: t.paidPaise + r.paidPaise,
        balancePaise: t.balancePaise + balanceOf(r),
        overduePaise: t.overduePaise + (r.isOverdue ? balanceOf(r) : 0),
      }),
      { count: 0, totalPaise: 0, paidPaise: 0, balancePaise: 0, overduePaise: 0 },
    );
  }, [clientRows]);
  const totals = serverTable ? invoices.data?.totals : localTotals;

  const columns: Column<InvoiceRow>[] = [
    {
      id: 'number',
      header: 'Number',
      sortable: true,
      sortValue: (r) => r.number,
      cell: (r) => (
        <Link href={`/invoices/${r._id}`} className="whitespace-nowrap font-mono text-[12.5px] font-medium hover:underline">
          {r.number}
        </Link>
      ),
      csv: (r) => r.number,
      footer: <span className="text-muted-foreground">{totals ? `${totals.count} invoice${totals.count === 1 ? '' : 's'}` : ''}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      cell: (r) =>
        r.clientName ? (
          <Link href={`/clients/${r.clientId}`} className="font-medium hover:underline">
            {r.clientName}
            {r.clientDeleted && <span className="ml-1 text-xs font-normal text-muted-foreground">(deleted)</span>}
          </Link>
        ) : (
          <span className="text-muted-foreground">Deleted client</span>
        ),
      csv: (r) => r.clientName ?? 'Deleted client',
    },
    {
      id: 'projects',
      header: 'Projects',
      hideBelow: 'lg',
      cell: (r) => <InvoiceLinks invoice={r} />,
      csv: (r) =>
        (r.projects?.length ? r.projects.map((p) => p.name ?? 'Deleted project') : (r.contracts ?? []).map((c) => c.name ?? 'Deleted contract')).join('; '),
    },
    {
      id: 'issueDate',
      header: 'Issued',
      sortable: true,
      sortValue: (r) => r.issueDate,
      hideBelow: 'md',
      cell: (r) => <span className="whitespace-nowrap">{r.issueDate ? formatDate(r.issueDate) : '—'}</span>,
      csv: (r) => r.issueDate?.slice(0, 10) ?? '',
    },
    {
      id: 'dueDate',
      header: 'Due',
      sortable: true,
      sortValue: (r) => r.dueDate,
      hideBelow: 'sm',
      cell: (r) =>
        r.dueDate ? (
          <span className={r.isOverdue ? 'whitespace-nowrap font-medium text-destructive' : 'whitespace-nowrap'}>
            {formatDate(r.dueDate)}
            {r.isOverdue && !!r.daysOverdue && (
              <span className="block text-xs font-normal">{r.daysOverdue} day{r.daysOverdue === 1 ? '' : 's'} late</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      csv: (r) => r.dueDate?.slice(0, 10) ?? '',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          {r.isOverdue && r.status !== InvoiceStatus.OVERDUE && <Badge variant="danger">Overdue</Badge>}
        </div>
      ),
      csv: (r) => (r.isOverdue && r.status !== InvoiceStatus.OVERDUE ? `${statusLabel(r.status)} (overdue)` : statusLabel(r.status)),
    },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.totalPaise,
      cell: (r) => <Price paise={r.totalPaise} currency={r.currency} className="whitespace-nowrap" />,
      csv: (r) => csvMoney(r.totalPaise),
      csvHeader: 'Total (₹)',
      footer: totals ? <Price paise={totals.totalPaise} /> : null,
    },
    { id: 'paid', header: 'Paid', cell: () => null, className: 'hidden', csv: (r) => csvMoney(r.paidPaise), csvHeader: 'Paid (₹)' },
    {
      id: 'balance',
      header: 'Balance due',
      align: 'right',
      sortable: true,
      sortValue: (r) => balanceOf(r),
      cell: (r) => {
        const bal = r.balancePaise ?? Math.max(0, r.totalPaise - r.paidPaise);
        if (r.status === InvoiceStatus.WRITTEN_OFF) return <span className="text-muted-foreground">Written off</span>;
        return (
          <Price
            paise={bal}
            currency={r.currency}
            className={bal > 0 ? (r.isOverdue ? 'font-semibold text-destructive' : 'font-semibold') : 'text-muted-foreground'}
          />
        );
      },
      csv: (r) => csvMoney(r.balancePaise ?? Math.max(0, r.totalPaise - r.paidPaise)),
      csvHeader: 'Balance due (₹)',
      footer: totals ? <Price paise={totals.balancePaise} /> : null,
    },
  ];
  const visibleColumns = columns.filter((c) => c.className !== 'hidden');

  const sortedLocal = useMemo(() => sortRows(clientRows, columns, sortState), [clientRows, sortState?.by, sortState?.dir]); // eslint-disable-line react-hooks/exhaustive-deps
  const localPages = Math.max(1, Math.ceil(sortedLocal.length / PAGE_SIZE));
  const localPage = Math.min(list.page, localPages);
  const localSlice = sortedLocal.slice((localPage - 1) * PAGE_SIZE, localPage * PAGE_SIZE);

  const exportAll = async () => {
    if (!canSeePrices) return;
    setExporting(true);
    try {
      if (clientSide && clientRows) {
        // Lanes / aging filter: the rows on screen are already the full filtered set.
        exportColumnsCsv(`invoices-${todayLocal()}`, columns, sortedLocal);
        return;
      }
      const rows: InvoiceRow[] = [];
      for (let page = 1; ; page++) {
        const res = await invoicesApi.page({ ...query, page, pageSize: 500 });
        rows.push(...res.items);
        if (page >= res.meta.totalPages) break;
      }
      exportColumnsCsv(`invoices-${todayLocal()}`, columns, rows);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't export invoices."));
    } finally {
      setExporting(false);
    }
  };

  const selectAging = (key: AgingKey) =>
    list.set(aging === key ? { aging: '' } : { aging: key, status: status === InvoiceStatus.OVERDUE && key !== 'current' ? status : 'open' });

  const emptyState = filtered ? (
    <EmptyState
      illustration="inbox"
      title="No invoices match these filters"
      action={
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      illustration="money"
      title="No invoices yet"
      description="Create an invoice for a client — you can bill several projects or a monthly retainer on one invoice."
      action={
        <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
          Create your first invoice
        </Button>
      }
    />
  );

  const d = dash.data;
  const fy = presetRange('this-fy');
  const hasRows = clientSide ? !!clientRows?.length : !!invoices.data?.items.length;

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Invoices"
        eyebrow="Invoices · what you've billed and what's still owed"
        loading={openAll.isLoading}
        aside={
          <>
            <PrivacyChip>Only you see these figures</PrivacyChip>
            <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New invoice
            </Button>
          </>
        }
        lede={<HeroLede open={openAll.data} draftCount={d?.draftCount} collectedFyPaise={d?.collectedFyPaise} failed={openAll.isError} />}
      >
        <HeroSentence open={openAll.data} failed={openAll.isError} />
      </Hero>

      <Bento>
        <Tile
          span={7}
          title="Clients owe you"
          action={
            aging ? (
              <button type="button" onClick={() => list.set({ aging: '' })} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Show all ages
              </button>
            ) : (
              <button
                type="button"
                onClick={() => list.set({ status: InvoiceStatus.OVERDUE, aging: '' })}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Overdue only
              </button>
            )
          }
        >
          {openScoped.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : openScoped.isError ? (
            <ErrorState title="Couldn't work out what you're owed" error={openScoped.error} onRetry={() => openScoped.refetch()} className="py-6" />
          ) : (
            <>
              <BigNumber
                caption={
                  (openScoped.data?.length ?? 0) === 0
                    ? params.clientId || params.projectId
                      ? 'Nothing open for this filter.'
                      : 'Nothing open — every sent invoice is paid.'
                    : `Across ${openScoped.data!.length} open invoice${openScoped.data!.length === 1 ? '' : 's'}${params.clientId || params.projectId ? ' for this filter' : ''}. Tap a segment to filter.`
                }
              >
                <Price paise={(openScoped.data ?? []).reduce((s, r) => s + balanceOf(r), 0)} compact className="font-display" />
              </BigNumber>
              <InvoiceAgingBar rows={openScoped.data} active={aging} onSelect={selectAging} className="mt-4" />
            </>
          )}
        </Tile>

        <Tile span={5} tone="ink" title="Collected this financial year">
          {dash.isLoading ? (
            <Skeleton className="h-9 w-32 bg-background/20" />
          ) : dash.isError ? (
            <p className="text-sm text-background/70">
              Couldn&apos;t load the totals.{' '}
              <button type="button" className="underline" onClick={() => dash.refetch()}>
                Try again
              </button>
            </p>
          ) : (
            <>
              <BigNumber caption={d?.fyLabel ? `FY ${d.fyLabel} · payments received` : 'Payments received'}>
                <button
                  type="button"
                  onClick={() => list.set({ range: 'this-fy', from: fy.from, to: fy.to, aging: '' })}
                  className="hover:underline"
                  title="Show invoices issued this financial year"
                >
                  <Price paise={d?.collectedFyPaise ?? 0} compact className="font-display text-brand" />
                </button>
              </BigNumber>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-background/15 pt-3 text-sm">
                <span className="text-background/75">
                  {d?.draftCount ? (
                    <>
                      {d.draftCount} draft{d.draftCount === 1 ? '' : 's'} not sent · <Price paise={d.draftPaise ?? 0} compact />
                    </>
                  ) : (
                    'Nothing waiting to be sent'
                  )}
                </span>
                {!!d?.draftCount && (
                  <button
                    type="button"
                    onClick={() => list.set({ status: InvoiceStatus.DRAFT, aging: '' })}
                    className="shrink-0 text-xs font-medium text-background/80 underline-offset-2 hover:underline"
                  >
                    Show drafts
                  </button>
                )}
              </div>
            </>
          )}
        </Tile>
      </Bento>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewToggle<View>
            value={view}
            onChange={(v) => list.set({ view: v })}
            options={[
              { value: 'board', label: 'Lanes', icon: LayoutGrid },
              { value: 'table', label: 'Table', icon: Rows3 },
            ]}
          />
          {canSeePrices && <ExportButton onClick={() => void exportAll()} disabled={exporting || !hasRows} />}
        </div>

        <FilterBar>
          <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search number or client" />
          <SelectFilter
            value={status}
            onChange={(s) => list.set(CLOSED_STATUSES.has(s) ? { status: s, aging: '' } : { status: s })}
            allLabel="Any status"
            options={STATUS_OPTIONS}
          />
          <div className="w-full sm:w-52">
            <Combobox
              options={clientOptions}
              value={params.clientId || undefined}
              allowClear
              placeholder="Any client"
              searchPlaceholder="Search clients…"
              loading={clients.isLoading}
              onChange={(v) => list.set({ clientId: v ?? '', projectId: '' })}
            />
          </div>
          <div className="w-full sm:w-52">
            <Combobox
              options={projectOptions}
              value={params.projectId || undefined}
              allowClear
              placeholder="Any project"
              searchPlaceholder="Search projects…"
              loading={projects.isLoading}
              onChange={(v) => list.set({ projectId: v ?? '' })}
            />
          </div>
          <DateRangeFilter preset={params.range} from={params.from} to={params.to} onChange={(r) => list.set(r)} />
          {aging && (
            <button
              type="button"
              onClick={() => list.set({ aging: '' })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium hover:bg-accent"
              aria-label={`Remove filter: ${AGING_LABEL[aging]}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: AGING_COLOR[aging] }} aria-hidden />
              {AGING_LABEL[aging]}
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <ResetFilters count={filterCount} onReset={resetFilters} />
        </FilterBar>
        {(params.from || params.to) && <p className="text-xs text-muted-foreground">Issued {describeRange(params.from, params.to)}</p>}
      </div>

      {view === 'board' ? (
        <InvoiceLanes
          since={since}
          rows={clientRows}
          loading={full.isLoading}
          error={full.error}
          onRetry={() => full.refetch()}
          hideEmptyLanes={!!status || !!aging}
          onShowTable={() => list.set({ view: 'table' })}
          empty={emptyState}
        />
      ) : (
        <>
          <DataTable
            columns={visibleColumns}
            rows={serverTable ? invoices.data?.items : localSlice}
            rowKey={(r) => r._id}
            loading={serverTable ? invoices.isLoading : full.isLoading}
            error={serverTable ? invoices.error : full.error}
            onRetry={() => (serverTable ? invoices.refetch() : full.refetch())}
            sort={sortState}
            onSortChange={(s) => list.set({ sort: s ? `${s.by}:${s.dir}` : 'issueDate:desc' })}
            rowHref={(r) => `/invoices/${r._id}`}
            showFooter
            empty={emptyState}
          />
          {serverTable
            ? invoices.data && (
                <Pagination
                  page={list.page}
                  totalPages={invoices.data.meta.totalPages}
                  total={invoices.data.meta.total}
                  pageSize={PAGE_SIZE}
                  onPage={list.setPage}
                />
              )
            : clientRows && (
                <Pagination page={localPage} totalPages={localPages} total={sortedLocal.length} pageSize={PAGE_SIZE} onPage={list.setPage} />
              )}
        </>
      )}

      <InvoiceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultClientId={params.clientId || undefined}
        defaultProjectId={params.projectId || undefined}
        onSaved={(inv) => router.push(`/invoices/${inv._id}`)}
      />
    </div>
  );
}

/** "₹4.2L outstanding, 3 overdue." — written from every open invoice. */
function HeroSentence({ open, failed }: { open: InvoiceRow[] | undefined; failed: boolean }) {
  if (failed || !open) return <>Your invoices.</>;
  const outstanding = open.reduce((s, r) => s + balanceOf(r), 0);
  const overdue = open.filter((r) => r.isOverdue && balanceOf(r) > 0).length;
  if (outstanding <= 0) return <>Every invoice is paid. Nice.</>;
  return (
    <>
      <HeroFigure>
        <Price paise={outstanding} compact className="font-display" />
      </HeroFigure>{' '}
      outstanding, {overdue > 0 ? <HeroMark>{overdue} overdue</HeroMark> : 'nothing overdue'}.
    </>
  );
}

function HeroLede({
  open,
  draftCount,
  collectedFyPaise,
  failed,
}: {
  open: InvoiceRow[] | undefined;
  draftCount?: number;
  collectedFyPaise?: number;
  failed: boolean;
}) {
  if (failed) return <>We couldn&apos;t add up what you&apos;re owed right now — the list below still works.</>;
  if (!open) return null;
  const late = open.filter((r) => r.isOverdue && balanceOf(r) > 0);
  const latePaise = late.reduce((s, r) => s + balanceOf(r), 0);
  const oldest = late.reduce((m, r) => Math.max(m, r.daysOverdue ?? 0), 0);
  const upcoming = open
    .filter((r) => !r.isOverdue && balanceOf(r) > 0 && r.dueDate)
    .sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!))[0];
  const collected = collectedFyPaise ? (
    <>
      {' '}
      You&apos;ve collected <Price paise={collectedFyPaise} compact /> this financial year.
    </>
  ) : null;

  if (late.length > 0) {
    return (
      <>
        <Price paise={latePaise} compact /> of it is late{oldest > 0 ? ` — the oldest is ${oldest} day${oldest === 1 ? '' : 's'} past due` : ''}.
        {collected}
      </>
    );
  }
  if (open.length > 0) {
    return (
      <>
        {open.length} open invoice{open.length === 1 ? '' : 's'}
        {upcoming?.dueDate ? `, the next one due ${formatDate(upcoming.dueDate)}` : ''}.{collected}
      </>
    );
  }
  return (
    <>
      {draftCount ? `${draftCount} draft${draftCount === 1 ? ' is' : 's are'} waiting to be sent.` : 'Nothing is waiting on a client.'}
      {collected}
    </>
  );
}

/** Projects the invoice bills (header + lines); falls back to retainer contracts. */
function InvoiceLinks({ invoice }: { invoice: InvoiceRow }) {
  const projects = invoice.projects ?? [];
  if (projects.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {projects.map((p) =>
          p.name ? (
            <ProjectChip key={p._id} id={p._id} name={p.name} href={`/projects/${p._id}`} />
          ) : (
            <span key={p._id} className="text-muted-foreground">
              Deleted project
            </span>
          ),
        )}
      </div>
    );
  }
  const contracts = invoice.contracts ?? [];
  if (contracts.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {contracts.map((c) =>
        c.name ? (
          <Link key={c._id} href={`/contracts/${c._id}`} className="hover:underline">
            {c.name}
          </Link>
        ) : (
          <span key={c._id} className="text-muted-foreground">
            Deleted contract
          </span>
        ),
      )}
    </div>
  );
}
