// Payments out — the full ledger of money paid to team members and freelancers (OWNER).
'use client';

import { Download, History, Send } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  PAYOUT_CATEGORY_LABEL,
  PAYOUT_METHOD_LABEL,
  PayeeType,
  PayoutCategory,
  PayoutMethod,
  type ListPayoutsQuery,
} from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { describeRange } from '@/lib/date-range';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useQuickActions } from '@/store/quick-actions.store';

import { DataTable, exportColumnsCsv, type Column } from '@/components/data/data-table';
import { DateRangeFilter, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { useFreelancers } from '@/features/freelancers/freelancers.hooks';
import { payoutsApi, useImportLegacy, useImportStatus, usePayouts, type PayoutRow } from '@/features/payouts/payouts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

const PAGE_SIZE = 25;

export default function PaymentsPage() {
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
  });
  const { params } = list;
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const staff = useStaffDirectory();
  const freelancers = useFreelancers();
  const projects = useAllProjects();

  const query: ListPayoutsQuery = {
    page: list.page,
    pageSize: PAGE_SIZE,
    q: params.q || undefined,
    userId: params.userId || undefined,
    freelancerId: params.freelancerId || undefined,
    projectId: params.projectId || undefined,
    payeeType: (params.payeeType || undefined) as PayeeType | undefined,
    method: (params.method || undefined) as PayoutMethod | undefined,
    category: (params.category || undefined) as PayoutCategory | undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    sort: (params.sort || undefined) as ListPayoutsQuery['sort'],
  };
  const payouts = usePayouts(query);

  const payeeOptions = useMemo(
    () => [
      ...(staff.data ?? []).map((u) => ({ value: `u:${u._id}`, label: u.name, group: 'Team' })),
      ...(freelancers.data ?? []).map((f) => ({ value: `f:${f._id}`, label: f.name, group: 'Freelancers' })),
    ],
    [staff.data, freelancers.data],
  );
  const payeeValue = params.userId ? `u:${params.userId}` : params.freelancerId ? `f:${params.freelancerId}` : undefined;

  const columns: Column<PayoutRow>[] = [
    {
      id: 'paidAt',
      header: 'Date',
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.paidAt)}</span>,
      csv: (r) => r.paidAt.slice(0, 10),
      footer: <span className="text-muted-foreground">This page</span>,
    },
    {
      id: 'payee',
      header: 'Paid to',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Link
            href={r.payeeType === PayeeType.MEMBER ? `/team/${r.userId}` : `/freelancers/${r.freelancerId}`}
            className="font-medium hover:underline"
          >
            {r.payeeName}
          </Link>
          {r.payeeType === PayeeType.FREELANCER && <Badge variant="info">Freelancer</Badge>}
        </div>
      ),
      csv: (r) => r.payeeName,
    },
    { id: 'payeeType', header: 'Type', cell: () => null, className: 'hidden', csv: (r) => (r.payeeType === PayeeType.MEMBER ? 'Team' : 'Freelancer') },
    {
      id: 'project',
      header: 'Project',
      cell: (r) =>
        r.projectId ? (
          <Link href={`/projects/${r.projectId}?tab=people`} className="hover:underline">
            {r.projectName ?? 'Deleted project'}
          </Link>
        ) : (
          <span className="text-muted-foreground">General</span>
        ),
      csv: (r) => r.projectName ?? 'General',
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
      cell: (r) => <span className="font-medium">{formatPaise(r.amountPaise, r.currency)}</span>,
      csv: (r) => csvMoney(r.amountPaise),
      csvHeader: 'Amount (₹)',
      footer: formatPaise((payouts.data?.items ?? []).reduce((s, r) => s + r.amountPaise, 0)),
    },
  ];
  const visibleColumns = columns.filter((c) => c.className !== 'hidden');

  const exportAll = async () => {
    const all = await payoutsApi.list({ ...query, page: 1, pageSize: 500 });
    exportColumnsCsv(`payments-${new Date().toISOString().slice(0, 10)}`, columns, all.items);
  };

  const totals = payouts.data?.totals;
  const filtered = list.activeFilterCount > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments out"
        description="Every payment to team members and freelancers, with what it was for."
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => void exportAll()} disabled={!payouts.data?.items.length}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => openLogPayment()}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
            </Button>
          </>
        }
      />

      <ImportBanner />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={filtered ? 'Total (filtered)' : 'Total paid out'}
          loading={payouts.isLoading}
          value={formatPaise(totals?.amountPaise ?? 0)}
          hint={params.from || params.to ? describeRange(params.from, params.to) : 'All time'}
        />
        <StatCard label="Payments" loading={payouts.isLoading} value={String(totals?.count ?? 0)} />
        <StatCard
          label="Average payment"
          loading={payouts.isLoading}
          value={formatPaise(totals && totals.count ? Math.round(totals.amountPaise / totals.count) : 0)}
        />
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
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>

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
        empty={
          filtered ? (
            <EmptyState title="No payments match these filters" action={<Button variant="outline" size="sm" onClick={list.reset}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Send}
              title="No payments logged yet"
              description="Log what you pay team members and freelancers, project by project."
              action={<Button size="sm" onClick={() => openLogPayment()}>Log your first payment</Button>}
            />
          )
        }
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
    <div className="flex flex-col gap-3 rounded-lg border border-sky-600/30 bg-sky-600/5 p-4 sm:flex-row sm:items-center">
      <History className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" />
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
