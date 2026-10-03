// Expenses — business costs with gross / net (after team contributions), project links, repeats.
// Opens on a visual overview (where the money went, monthly trend, recurring costs); the table is
// one toggle away and keeps filters, sorting, CSV export and footer totals.
'use client';

import { LayoutGrid, MoreHorizontal, Pencil, Plus, Repeat, Rows3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { Role } from '@agency/shared';

import { toast } from 'sonner';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { ExpenseFormDialog } from '@/features/expenses/expense-form-dialog';
import {
  EXPENSE_CATEGORIES,
  LEGACY_EXPENSE_CATEGORIES,
  RECURRING_LABEL,
  categoryLabel,
  isRecurring,
  nextPeriodYmd,
  storedYmd,
} from '@/features/expenses/expense-meta';
import {
  expensesApi,
  useDeleteExpense,
  useExpenseSummary,
  useExpenseWindow,
  useExpenses,
  useRepeatExpense,
  type ExpenseFilters,
  type ExpenseRow,
  type ExpenseSort,
} from '@/features/expenses/expenses.hooks';
import { ExpensesHero } from '@/features/expenses/expenses-hero';
import { ExpensesOverview } from '@/features/expenses/expenses-overview';
import { monthStartYmd } from '@/features/expenses/money-time';
import { ViewReceiptButton } from '@/features/expenses/receipt-field';
import { useAllProjects } from '@/features/projects/projects.hooks';

const PAGE_SIZE = 25;
const SORT_IDS = new Set(['date', 'amount']);

type View = 'visual' | 'table';
const VIEW_OPTIONS = [
  { value: 'visual' as const, label: 'Overview', icon: LayoutGrid },
  { value: 'table' as const, label: 'Table', icon: Rows3 },
];
const FILTER_DEFAULTS = { q: '', category: '', projectId: '', range: '', from: '', to: '', sort: 'date:desc' };

/** yyyy-mm-dd → "3 Nov 2026" (parsed as local noon so it never slips a day). */
const fmtYmd = (ymd: string) => formatDate(`${ymd}T12:00:00`);

export default function ExpensesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState title="Only the owner can see expenses" />}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const list = useListState('expenses', { ...FILTER_DEFAULTS, view: 'visual' });
  const { params } = list;
  const view: View = params.view === 'table' ? 'table' : 'visual';
  const canSee = useCanSeePrices();
  const confirm = useConfirm();
  const projects = useAllProjects();
  const repeat = useRepeatExpense();
  const del = useDeleteExpense();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | undefined>();
  const [viewing, setViewing] = useState<ExpenseRow | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (r: ExpenseRow) => {
    setViewing(null);
    setEditing(r);
    setFormOpen(true);
  };
  useNewParam(openCreate);

  const filters: ExpenseFilters = {
    q: params.q || undefined,
    category: params.category || undefined,
    projectId: params.projectId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const sort = (SORT_IDS.has(list.sort?.by ?? '') ? `${list.sort!.by}:${list.sort!.dir}` : 'date:desc') as ExpenseSort;
  // The table's page only loads in the table view; the overview works from the summary + a 13-month window.
  const expenses = useExpenses({ ...filters, page: list.page, limit: PAGE_SIZE, sort }, view === 'table');
  const summary = useExpenseSummary(filters);
  const windowRows = useExpenseWindow(
    { q: filters.q, category: filters.category, projectId: filters.projectId, from: monthStartYmd(-12) },
    view === 'visual',
  );
  const totals = expenses.data?.totals;
  // The remembered view isn't a filter: leave it out of the count and keep it when filters are cleared.
  const filterCount = list.activeFilterCount - (params.view && params.view !== 'visual' ? 1 : 0);
  const filtered = filterCount > 0;
  const resetFilters = () => list.set(FILTER_DEFAULTS);

  const projectOptions: ComboboxOption[] = useMemo(() => {
    const opts: ComboboxOption[] = (projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name, keywords: p.code }));
    if (params.projectId && !opts.some((o) => o.value === params.projectId) && !projects.isLoading) {
      opts.unshift({ value: params.projectId, label: 'Deleted project' });
    }
    return opts;
  }, [projects.data, projects.isLoading, params.projectId]);

  // ── Row actions ────────────────────────────────────────────────────────────────

  const askRepeat = async (r: ExpenseRow) => {
    if (!isRecurring(r.recurring)) return;
    const next = nextPeriodYmd(storedYmd(r.date), r.recurring);
    const ok = await confirm({
      title: `Add ${r.title} for ${fmtYmd(next)}?`,
      description: `This adds a copy dated ${fmtYmd(next)}${canSee ? ` for ${formatPaise(r.amountPaise, r.currency)}` : ''}${
        r.contributions.length ? ', with the same team contributions' : ''
      }. The receipt isn't copied. If this period's bill is different, edit the copy afterwards.`,
      confirmText: 'Add copy',
    });
    if (ok) repeat.mutate(r._id, { onSuccess: () => setViewing(null) });
  };

  const askDelete = async (r: ExpenseRow) => {
    const ok = await confirm({
      title: `Delete "${r.title}"?`,
      description: `${canSee ? formatPaise(r.amountPaise, r.currency) : 'This expense'} on ${formatDate(r.date)} will be taken out of expense totals, the dashboard and profit figures${
        r.projectId ? `, and no longer count toward ${r.projectName ?? 'its project'}'s costs` : ''
      }. This can't be undone.`,
      destructive: true,
    });
    if (ok) del.mutate(r._id, { onSuccess: () => setViewing(null) });
  };

  // ── Table ──────────────────────────────────────────────────────────────────────

  const columns: Column<ExpenseRow>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>,
      csv: (r) => storedYmd(r.date),
      footer: <span className="text-muted-foreground">{filtered ? 'Total (filtered)' : 'Total'}</span>,
    },
    {
      id: 'title',
      header: 'Expense',
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{r.title}</span>
            {isRecurring(r.recurring) && <Badge variant="info">{r.recurring === 'YEARLY' ? 'Yearly' : 'Monthly'}</Badge>}
            {r.billable && <Badge variant="warning">Billable</Badge>}
          </div>
          {r.vendor && <span className="block text-xs text-muted-foreground md:hidden">{r.vendor}</span>}
        </div>
      ),
      csv: (r) => r.title,
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'sm',
      cell: (r) => <span className="text-muted-foreground">{categoryLabel(r.category)}</span>,
      csv: (r) => categoryLabel(r.category),
    },
    {
      id: 'project',
      header: 'Project',
      hideBelow: 'lg',
      cell: (r) =>
        r.projectId ? (
          r.projectDeleted ? (
            <span className="text-muted-foreground">{r.projectName ? `${r.projectName} (deleted)` : 'Deleted project'}</span>
          ) : (
            <Link href={`/projects/${r.projectId}`} className="hover:underline">
              {r.projectName}
            </Link>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      csv: (r) => (r.projectId ? (r.projectName ?? 'Deleted project') : ''),
    },
    {
      id: 'vendor',
      header: 'Vendor',
      hideBelow: 'md',
      cell: (r) => <span className="text-muted-foreground">{r.vendor || '—'}</span>,
      csv: (r) => r.vendor ?? '',
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
      cell: (r) => (
        <div>
          <Price paise={r.amountPaise} currency={r.currency} className="font-medium" />
          {r.contributions.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              net <Price paise={r.netPaise ?? r.amountPaise} currency={r.currency} />
            </span>
          )}
        </div>
      ),
      csv: (r) => csvMoney(r.amountPaise),
      csvHeader: 'Amount (₹)',
      footer: totals ? (
        <div>
          <Price paise={totals.grossPaise} />
          {totals.netPaise !== totals.grossPaise && (
            <span className="block text-xs font-normal text-muted-foreground">
              net <Price paise={totals.netPaise} />
            </span>
          )}
        </div>
      ) : null,
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
              {isRecurring(r.recurring) && (
                <DropdownMenuItem onClick={() => void askRepeat(r)} disabled={repeat.isPending}>
                  <Repeat className="mr-2 h-3.5 w-3.5" /> Repeat for {fmtYmd(nextPeriodYmd(storedYmd(r.date), r.recurring))}
                </DropdownMenuItem>
              )}
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
  const csvOnly: Column<ExpenseRow>[] = [
    { id: 'net', header: 'Net', cell: () => null, csv: (r) => csvMoney(r.netPaise ?? r.amountPaise), csvHeader: 'Net cost (₹)' },
    {
      id: 'contributors',
      header: 'Covered by team',
      cell: () => null,
      csv: (r) => r.contributions.map((c) => `${c.userName ?? 'Former member'} ${csvMoney(c.amountPaise)}`).join('; '),
    },
    { id: 'billable', header: 'Billable', cell: () => null, csv: (r) => (r.billable ? 'Yes' : 'No') },
    { id: 'recurring', header: 'Repeats', cell: () => null, csv: (r) => RECURRING_LABEL[r.recurring ?? 'NONE'] },
    { id: 'notes', header: 'Notes', cell: () => null, csv: (r) => r.description ?? '' },
  ];

  const [exporting, setExporting] = useState(false);
  const exportAll = async () => {
    setExporting(true);
    try {
      const rows: ExpenseRow[] = [];
      for (let page = 1; ; page++) {
        const res = await expensesApi.list({ ...filters, sort, page, limit: 500 });
        rows.push(...res.items);
        if (page >= res.meta.totalPages) break;
      }
      exportColumnsCsv(`expenses-${todayLocal()}`, [...columns, ...csvOnly], rows);
    } catch (err) {
      toast.error(`Export failed. ${getErrorMessage(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const rangeLabel = params.from || params.to ? describeRange(params.from, params.to) : 'All time';
  const toggleCategory = (c: string) => list.set({ category: params.category === c ? '' : c });

  return (
    <div className="space-y-5">
      <ExpensesHero aside={<PrivacyChip>Only you see these figures</PrivacyChip>} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle<View> value={view} onChange={(v) => list.set({ view: v })} options={VIEW_OPTIONS} />
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton onClick={() => void exportAll()} disabled={!canSee || exporting || !summary.data?.count} />
          <Button size="sm" variant="brand" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add expense
          </Button>
        </div>
      </div>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search title, vendor, notes, project" />
        <SelectFilter
          value={params.category}
          onChange={(category) => list.set({ category })}
          allLabel="All categories"
          options={[...EXPENSE_CATEGORIES, ...LEGACY_EXPENSE_CATEGORIES].map((c) => ({ value: c, label: categoryLabel(c) }))}
        />
        <div className="w-full sm:w-56">
          <Combobox
            options={projectOptions}
            value={params.projectId || undefined}
            allowClear
            loading={projects.isLoading}
            placeholder="Any project"
            searchPlaceholder="Search projects…"
            onChange={(v) => list.set({ projectId: v ?? '' })}
          />
        </div>
        <DateRangeFilter preset={params.range} from={params.from} to={params.to} onChange={(r) => list.set(r)} />
        <ResetFilters count={filterCount} onReset={resetFilters} />
      </FilterBar>

      {view === 'visual' ? (
        <ExpensesOverview
          summary={summary}
          window={windowRows}
          rangeLabel={rangeLabel}
          dateFiltered={!!(params.from || params.to)}
          filtered={filtered}
          selectedCategory={params.category || undefined}
          onSelectCategory={toggleCategory}
          onRepeat={(r) => void askRepeat(r)}
          repeatPending={repeat.isPending}
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
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-foreground/25 hover:bg-accent/40"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: identityColor(c._id) }} aria-hidden />
                  <span className="text-muted-foreground">{categoryLabel(c._id)}</span>
                  <Price paise={c.totalPaise} className="font-medium" />
                  {c.netPaise !== c.totalPaise && (
                    <span className="text-muted-foreground">
                      · net <Price paise={c.netPaise} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <DataTable
            columns={columns}
            rows={expenses.data?.items}
            rowKey={(r) => r._id}
            loading={expenses.isLoading}
            error={expenses.error}
            onRetry={() => void expenses.refetch()}
            sort={list.sort && SORT_IDS.has(list.sort.by) ? list.sort : { by: 'date', dir: 'desc' }}
            onSortChange={(s) => list.set({ sort: s ? `${s.by}:${s.dir}` : 'date:desc' })}
            onRowClick={(r) => setViewing(r)}
            showFooter
            empty={
              filtered ? (
                <EmptyState
                  illustration="money"
                  title="No expenses match these filters"
                  action={
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  illustration="money"
                  title="No expenses yet"
                  description="Log tools, hosting, marketing and other running costs to see your real profit."
                  action={
                    <Button size="sm" onClick={openCreate}>
                      Add your first expense
                    </Button>
                  }
                />
              )
            }
          />
          {expenses.data && (
            <Pagination
              page={list.page}
              totalPages={expenses.data.meta.totalPages}
              total={expenses.data.meta.total}
              pageSize={PAGE_SIZE}
              onPage={list.setPage}
            />
          )}
        </>
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
        defaultProjectId={params.projectId || undefined}
      />

      <ExpenseDetailDialog
        expense={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
        onRepeat={(r) => void askRepeat(r)}
        onDelete={(r) => void askDelete(r)}
      />
    </div>
  );
}

function ExpenseDetailDialog({
  expense: e,
  onClose,
  onEdit,
  onRepeat,
  onDelete,
}: {
  expense: ExpenseRow | null;
  onClose: () => void;
  onEdit: (r: ExpenseRow) => void;
  onRepeat: (r: ExpenseRow) => void;
  onDelete: (r: ExpenseRow) => void;
}) {
  return (
    <Dialog open={!!e} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {e && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {e.title}
                {isRecurring(e.recurring) && <Badge variant="info">{RECURRING_LABEL[e.recurring!]}</Badge>}
                {e.billable && <Badge variant="warning">Billable</Badge>}
              </DialogTitle>
              <DialogDescription>
                {categoryLabel(e.category)} · {formatDate(e.date)}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Detail label={e.contributions.length ? 'Gross amount' : 'Amount'} value={<Price paise={e.amountPaise} currency={e.currency} />} />
                <Detail label="Vendor" value={e.vendor || '—'} />
                <Detail
                  label="Project"
                  value={
                    e.projectId ? (
                      e.projectDeleted ? (
                        e.projectName ? `${e.projectName} (deleted)` : 'Deleted project'
                      ) : (
                        <Link href={`/projects/${e.projectId}`} className="hover:underline">
                          {e.projectName}
                        </Link>
                      )
                    ) : (
                      '—'
                    )
                  }
                />
                <Detail label="Repeats" value={RECURRING_LABEL[e.recurring ?? 'NONE']} />
                <Detail label="Added by" value={e.addedByName ?? '—'} />
                <Detail label="Logged" value={formatDate(e.createdAt)} />
              </div>

              {e.contributions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Covered by team</p>
                  <div className="mt-1 space-y-1">
                    {e.contributions.map((c, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span>
                          {c.userId ? (
                            <Link href={`/team/${c.userId}`} className="hover:underline">
                              {c.userName ?? 'Former member'}
                            </Link>
                          ) : (
                            'Former member'
                          )}
                          {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
                        </span>
                        <span className="text-success">
                          −<Price paise={c.amountPaise} currency={e.currency} />
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-medium">
                      <span>Net cost to the agency</span>
                      <Price paise={e.netPaise ?? e.amountPaise} currency={e.currency} />
                    </div>
                  </div>
                </div>
              )}

              {e.description && <Detail label="Notes" value={e.description} />}

              <div>
                <p className="text-xs text-muted-foreground">Receipt</p>
                <div className="mt-1">
                  {e.receiptRef ? (
                    <ViewReceiptButton receiptKey={e.receiptRef} />
                  ) : (
                    <span className="text-muted-foreground">No receipt attached.</span>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(e)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
              <div className="flex gap-2">
                {isRecurring(e.recurring) && (
                  <Button variant="outline" onClick={() => onRepeat(e)}>
                    <Repeat className="mr-1.5 h-3.5 w-3.5" /> Repeat
                  </Button>
                )}
                <Button onClick={() => onEdit(e)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words">{value}</p>
    </div>
  );
}
