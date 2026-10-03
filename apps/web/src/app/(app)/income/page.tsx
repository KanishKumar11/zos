// Other income — money in that isn't a client invoice (affiliate payouts, referrals, interest, refunds).
// Opens on a visual overview (categories, monthly trend, top sources); the table is one toggle away.
'use client';

import { LayoutGrid, MoreHorizontal, Pencil, Plus, Rows3, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Role } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { csvMoney } from '@/lib/csv';
import { describeRange } from '@/lib/date-range';
import { todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, type Column } from '@/components/data/data-table';
import { DateRangeFilter, ExportButton, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { useNewParam } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { Price, PrivacyChip, useCanSeePrices } from '@/components/viz';
import { monthStartYmd } from '@/features/expenses/money-time';
import { ViewReceiptButton } from '@/features/expenses/receipt-field';
import { IncomeFormDialog } from '@/features/income/income-form-dialog';
import { IncomeHero } from '@/features/income/income-hero';
import { IncomeOverview } from '@/features/income/income-overview';
import { INCOME_CATEGORIES, incomeCategoryLabel } from '@/features/income/income-meta';
import {
  incomeApi,
  useDeleteIncome,
  useIncome,
  useIncomeSummary,
  useIncomeWindow,
  type IncomeFilters,
  type IncomeRow,
  type IncomeSort,
} from '@/features/income/income.hooks';

const PAGE_SIZE = 25;
const SORT_IDS = new Set(['date', 'amount']);

type View = 'visual' | 'table';
const VIEW_OPTIONS = [
  { value: 'visual' as const, label: 'Overview', icon: LayoutGrid },
  { value: 'table' as const, label: 'Table', icon: Rows3 },
];
const FILTER_DEFAULTS = { q: '', category: '', range: '', from: '', to: '', sort: 'date:desc' };

export default function IncomePage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState title="Only the owner can see income" />}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const list = useListState('income', { ...FILTER_DEFAULTS, view: 'visual' });
  const { params } = list;
  const view: View = params.view === 'table' ? 'table' : 'visual';
  const canSee = useCanSeePrices();
  const confirm = useConfirm();
  const del = useDeleteIncome();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | undefined>();
  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (r: IncomeRow) => {
    setEditing(r);
    setFormOpen(true);
  };
  useNewParam(openCreate);

  const filters: IncomeFilters = {
    q: params.q || undefined,
    category: params.category || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const sort = (SORT_IDS.has(list.sort?.by ?? '') ? `${list.sort!.by}:${list.sort!.dir}` : 'date:desc') as IncomeSort;
  // The table's page only loads in the table view; the overview works from the summary + a 12-month window.
  const income = useIncome({ ...filters, page: list.page, limit: PAGE_SIZE, sort }, view === 'table');
  const summary = useIncomeSummary(filters);
  const windowRows = useIncomeWindow({ q: filters.q, category: filters.category, from: monthStartYmd(-11) }, view === 'visual');
  const totals = income.data?.totals;
  // The remembered view isn't a filter: leave it out of the count and keep it when filters are cleared.
  const filterCount = list.activeFilterCount - (params.view && params.view !== 'visual' ? 1 : 0);
  const filtered = filterCount > 0;
  const resetFilters = () => list.set(FILTER_DEFAULTS);
  const toggleCategory = (c: string) => list.set({ category: params.category === c ? '' : c });

  const askDelete = async (r: IncomeRow) => {
    const ok = await confirm({
      title: `Delete "${r.title}"?`,
      description: `${canSee ? formatPaise(r.amountPaise, r.currency) : 'This income'} received on ${formatDate(r.date)} will be taken out of income totals and the dashboard's profit figures. This can't be undone.`,
      destructive: true,
    });
    if (ok) del.mutate(r._id);
  };

  const columns: Column<IncomeRow>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>,
      csv: (r) => r.date.slice(0, 10),
      footer: <span className="text-muted-foreground">{filtered ? 'Total (filtered)' : 'Total'}</span>,
    },
    {
      id: 'title',
      header: 'Income',
      cell: (r) => (
        <div className="min-w-0">
          <span className="font-medium">{r.title}</span>
          {r.description && <span className="block line-clamp-1 max-w-[320px] text-xs text-muted-foreground">{r.description}</span>}
        </div>
      ),
      csv: (r) => r.title,
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'sm',
      cell: (r) => <span className="text-muted-foreground">{incomeCategoryLabel(r.category)}</span>,
      csv: (r) => incomeCategoryLabel(r.category),
    },
    {
      id: 'source',
      header: 'Source',
      hideBelow: 'md',
      cell: (r) => <span className="text-muted-foreground">{r.source || '—'}</span>,
      csv: (r) => r.source ?? '',
    },
    {
      id: 'receipt',
      header: <span className="sr-only">Receipt</span>,
      hideBelow: 'sm',
      cell: (r) => (r.receiptRef ? <ViewReceiptButton receiptKey={r.receiptRef} compact /> : null),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      cell: (r) => <Price paise={r.amountPaise} currency={r.currency} className="font-medium" />,
      csv: (r) => csvMoney(r.amountPaise),
      csvHeader: 'Amount (₹)',
      footer: totals ? <Price paise={totals.amountPaise} /> : null,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10',
      cell: (r) => (
        // Menu items render in a portal, but their clicks still bubble to the row — stop them here.
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${r.title}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(r)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void askDelete(r)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
  const csvOnly: Column<IncomeRow>[] = [{ id: 'notes', header: 'Notes', cell: () => null, csv: (r) => r.description ?? '' }];

  const [exporting, setExporting] = useState(false);
  const exportAll = async () => {
    setExporting(true);
    try {
      const rows: IncomeRow[] = [];
      for (let page = 1; ; page++) {
        const res = await incomeApi.list({ ...filters, sort, page, limit: 500 });
        rows.push(...res.items);
        if (page >= res.meta.totalPages) break;
      }
      exportColumnsCsv(`other-income-${todayLocal()}`, [...columns, ...csvOnly], rows);
    } catch (err) {
      toast.error(`Export failed. ${getErrorMessage(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const rangeLabel = params.from || params.to ? describeRange(params.from, params.to) : 'All time';

  return (
    <div className="space-y-5">
      <IncomeHero aside={<PrivacyChip>Only you see these figures</PrivacyChip>} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle<View> value={view} onChange={(v) => list.set({ view: v })} options={VIEW_OPTIONS} />
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton onClick={() => void exportAll()} disabled={!canSee || exporting || !summary.data?.count} />
          <Button size="sm" variant="brand" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add income
          </Button>
        </div>
      </div>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search title, source, notes" />
        <SelectFilter
          value={params.category}
          onChange={(category) => list.set({ category })}
          allLabel="All categories"
          options={INCOME_CATEGORIES.map((c) => ({ value: c, label: incomeCategoryLabel(c) }))}
        />
        <DateRangeFilter preset={params.range} from={params.from} to={params.to} onChange={(r) => list.set(r)} />
        <ResetFilters count={filterCount} onReset={resetFilters} />
      </FilterBar>

      {view === 'visual' ? (
        <IncomeOverview
          summary={summary}
          window={windowRows}
          rangeLabel={rangeLabel}
          dateFiltered={!!(params.from || params.to)}
          filtered={filtered}
          selectedCategory={params.category || undefined}
          onSelectCategory={toggleCategory}
          onCreate={openCreate}
          onClearFilters={resetFilters}
        />
      ) : (
        <>
          {summary.data && summary.data.byCategory.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="By category">
              {summary.data.byCategory.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggleCategory(c._id)}
                  aria-pressed={params.category === c._id}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs transition-colors hover:border-foreground/25 hover:bg-accent/40"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: identityColor(c._id) }} aria-hidden />
                  <span className="text-muted-foreground">{incomeCategoryLabel(c._id)}</span>
                  <Price paise={c.totalPaise} className="font-medium" />
                </button>
              ))}
            </div>
          )}

          <DataTable
            columns={columns}
            rows={income.data?.items}
            rowKey={(r) => r._id}
            loading={income.isLoading}
            error={income.error}
            onRetry={() => void income.refetch()}
            sort={list.sort && SORT_IDS.has(list.sort.by) ? list.sort : { by: 'date', dir: 'desc' }}
            onSortChange={(s) => list.set({ sort: s ? `${s.by}:${s.dir}` : 'date:desc' })}
            onRowClick={openEdit}
            showFooter
            empty={
              filtered ? (
                <EmptyState
                  illustration="money"
                  title="No income matches these filters"
                  action={
                    <Button variant="outline" size="sm" onClick={resetFilters}>
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
                    <Button size="sm" onClick={openCreate}>
                      Add income
                    </Button>
                  }
                />
              )
            }
          />
          {income.data && (
            <Pagination
              page={list.page}
              totalPages={income.data.meta.totalPages}
              total={income.data.meta.total}
              pageSize={PAGE_SIZE}
              onPage={list.setPage}
            />
          )}
        </>
      )}

      <IncomeFormDialog open={formOpen} onOpenChange={setFormOpen} income={editing} />
    </div>
  );
}
