// Invoices list (OWNER-only) — filters live in the URL so other pages can link here
// (?status=OVERDUE, ?status=open, ?clientId=, ?projectId=, ?new=1).
'use client';

import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { InvoiceStatus, Role, type ListInvoicesQuery } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, type Column } from '@/components/data/data-table';
import {
  DateRangeFilter,
  ExportButton,
  FilterBar,
  ResetFilters,
  SearchFilter,
  SelectFilter,
} from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { getErrorMessage } from '@/lib/api-client';
import { csvMoney } from '@/lib/csv';
import { describeRange, presetRange } from '@/lib/date-range';
import { todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { useClients } from '@/features/clients/clients.hooks';
import { InvoiceFormDialog } from '@/features/invoices/invoice-form-dialog';
import {
  invoicesApi,
  useInvoiceDashboard,
  useInvoicePage,
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
const SORT_IDS = new Set(['number', 'issueDate', 'dueDate', 'total', 'balance']);

export default function InvoicesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Only the owner can see invoices.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const router = useRouter();
  const list = useListState('invoices', {
    q: '',
    status: '',
    clientId: '',
    projectId: '',
    range: '',
    from: '',
    to: '',
    sort: 'issueDate:desc',
  });
  const { params } = list;
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  useNewParam(() => setCreateOpen(true));

  const clients = useClients();
  const projects = useAllProjects();
  const dash = useInvoiceDashboard();

  const status = params.status === 'overdue' ? InvoiceStatus.OVERDUE : params.status;
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
  const invoices = useInvoicePage(query);
  const totals = invoices.data?.totals;
  const filtered = list.activeFilterCount > 0;

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

  const columns: Column<InvoiceRow>[] = [
    {
      id: 'number',
      header: 'Number',
      sortable: true,
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
      hideBelow: 'md',
      cell: (r) => <span className="whitespace-nowrap">{r.issueDate ? formatDate(r.issueDate) : '—'}</span>,
      csv: (r) => r.issueDate?.slice(0, 10) ?? '',
    },
    {
      id: 'dueDate',
      header: 'Due',
      sortable: true,
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
      cell: (r) => <span className="whitespace-nowrap">{formatPaise(r.totalPaise, r.currency)}</span>,
      csv: (r) => csvMoney(r.totalPaise),
      csvHeader: 'Total (₹)',
      footer: totals ? formatPaise(totals.totalPaise) : null,
    },
    { id: 'paid', header: 'Paid', cell: () => null, className: 'hidden', csv: (r) => csvMoney(r.paidPaise), csvHeader: 'Paid (₹)' },
    {
      id: 'balance',
      header: 'Balance due',
      align: 'right',
      sortable: true,
      cell: (r) => {
        const bal = r.balancePaise ?? Math.max(0, r.totalPaise - r.paidPaise);
        if (r.status === InvoiceStatus.WRITTEN_OFF) return <span className="text-muted-foreground">Written off</span>;
        return (
          <span className={bal > 0 ? (r.isOverdue ? 'font-semibold text-destructive' : 'font-semibold') : 'text-muted-foreground'}>
            {formatPaise(bal, r.currency)}
          </span>
        );
      },
      csv: (r) => csvMoney(r.balancePaise ?? Math.max(0, r.totalPaise - r.paidPaise)),
      csvHeader: 'Balance due (₹)',
      footer: totals ? formatPaise(totals.balancePaise) : null,
    },
  ];
  const visibleColumns = columns.filter((c) => c.className !== 'hidden');

  const exportAll = async () => {
    setExporting(true);
    try {
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

  const d = dash.data;
  const fy = presetRange('this-fy');
  const sortState = list.sort && SORT_IDS.has(list.sort.by) ? list.sort : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="What you've billed clients, what's been paid and what's still owed."
        action={
          <>
            <ExportButton onClick={() => void exportAll()} disabled={exporting || !invoices.data?.items.length} />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New invoice
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          loading={dash.isLoading}
          value={formatPaise(d?.outstandingPaise ?? 0)}
          hint={d ? `${d.openCount ?? 0} open invoice${d.openCount === 1 ? '' : 's'}` : undefined}
          tone="warning"
          href="/invoices?status=open"
        />
        <StatCard
          label="Overdue"
          loading={dash.isLoading}
          value={formatPaise(d?.overduePaise ?? 0)}
          hint={d ? (d.overdueCount ? `${d.overdueCount} past their due date` : 'Nothing overdue') : undefined}
          tone={d?.overduePaise ? 'danger' : 'default'}
          href={`/invoices?status=${InvoiceStatus.OVERDUE}`}
        />
        <StatCard
          label="Collected this financial year"
          loading={dash.isLoading}
          value={formatPaise(d?.collectedFyPaise ?? 0)}
          hint={d?.fyLabel ? `FY ${d.fyLabel} · payments received` : undefined}
          tone="success"
          href={`/invoices?range=this-fy&from=${fy.from}&to=${fy.to}`}
        />
        <StatCard
          label="Drafts"
          loading={dash.isLoading}
          value={String(d?.draftCount ?? 0)}
          hint={d?.draftCount ? `${formatPaise(d.draftPaise ?? 0)} not sent yet` : 'Nothing waiting to be sent'}
          href={`/invoices?status=${InvoiceStatus.DRAFT}`}
        />
      </div>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search number or client" />
        <SelectFilter
          value={status}
          onChange={(s) => list.set({ status: s })}
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
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>
      {(params.from || params.to) && (
        <p className="-mt-2 text-xs text-muted-foreground">Issued {describeRange(params.from, params.to)}</p>
      )}

      <DataTable
        columns={visibleColumns}
        rows={invoices.data?.items}
        rowKey={(r) => r._id}
        loading={invoices.isLoading}
        error={invoices.error}
        onRetry={() => invoices.refetch()}
        sort={sortState}
        onSortChange={(s) => list.set({ sort: s ? `${s.by}:${s.dir}` : 'issueDate:desc' })}
        rowHref={(r) => `/invoices/${r._id}`}
        showFooter
        empty={
          filtered ? (
            <EmptyState
              title="No invoices match these filters"
              action={
                <Button variant="outline" size="sm" onClick={list.reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create an invoice for a client — you can bill several projects or a monthly retainer on one invoice."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create your first invoice
                </Button>
              }
            />
          )
        }
      />
      {invoices.data && (
        <Pagination
          page={list.page}
          totalPages={invoices.data.meta.totalPages}
          total={invoices.data.meta.total}
          pageSize={PAGE_SIZE}
          onPage={list.setPage}
        />
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

/** Projects the invoice bills (header + lines); falls back to retainer contracts. */
function InvoiceLinks({ invoice }: { invoice: InvoiceRow }) {
  const projects = invoice.projects ?? [];
  if (projects.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {projects.map((p) =>
          p.name ? (
            <Link key={p._id} href={`/projects/${p._id}`} className="hover:underline">
              {p.name}
            </Link>
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
