// Contracts — retainers: what's billed monthly, what's due to bill, and what's ending soon (OWNER).
'use client';

import { Download, Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ContractStatus, Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { thisMonthLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { useClients } from '@/features/clients/clients.hooks';
import {
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_STATUS_TONE,
  contractStatusLabel,
  daysToEnd,
  dueThisMonth,
  endsSoon,
  formatTotals,
  monthLabel,
  totalsByCurrency,
} from '@/features/contracts/contract-utils';
import { ContractFormDialog } from '@/features/contracts/contract-form-dialog';
import { useContracts, useDeleteContract, type ContractRow } from '@/features/contracts/contracts.hooks';

export default function ContractsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const router = useRouter();
  const confirm = useConfirm();
  const list = useListState('contracts', { q: '', status: '', clientId: '', show: '', sort: 'name:asc' });
  const { params } = list;
  const contracts = useContracts();
  const clients = useClients();
  const del = useDeleteContract();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  useNewParam(() => setCreateOpen(true));

  const month = thisMonthLocal();
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c._id, c.name])), [clients.data]);
  const nameOf = (id: string) => clientName.get(id) ?? (clients.isLoading ? '…' : 'Deleted client');

  const remove = async (c: ContractRow) => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      description: 'Invoices already generated from it stay as they are, but you won’t be able to bill this contract again.',
      confirmText: 'Delete contract',
      destructive: true,
    });
    if (ok) del.mutate(c._id);
  };

  const columns: Column<ContractRow>[] = [
    {
      id: 'name',
      header: 'Contract',
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="min-w-0">
          <Link href={`/contracts/${c._id}`} className="font-medium hover:underline">
            {c.name}
          </Link>
          {c.description && <p className="max-w-xs truncate text-xs text-muted-foreground">{c.description}</p>}
        </div>
      ),
      csv: (c) => c.name,
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (c) => nameOf(c.clientId).toLowerCase(),
      cell: (c) =>
        clientName.has(c.clientId) ? (
          <Link href={`/clients/${c.clientId}`} className="hover:underline">
            {nameOf(c.clientId)}
          </Link>
        ) : (
          <span className="text-muted-foreground">{nameOf(c.clientId)}</span>
        ),
      csv: (c) => nameOf(c.clientId),
    },
    {
      id: 'monthly',
      header: 'Monthly',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.monthlyAmountPaise,
      cell: (c) => formatPaise(c.monthlyAmountPaise, c.currency),
      csv: (c) => csvMoney(c.monthlyAmountPaise),
    },
    { id: 'currency', header: 'Currency', cell: () => null, className: 'hidden', csv: (c) => c.currency },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.status,
      cell: (c) => {
        const d = daysToEnd(c);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={CONTRACT_STATUS_TONE[c.status]}>{contractStatusLabel(c.status)}</Badge>
            {endsSoon(c) && <Badge variant="warning">{d === 0 ? 'Ends today' : `Ends in ${d} day${d === 1 ? '' : 's'}`}</Badge>}
            {c.status === ContractStatus.ACTIVE && d !== undefined && d < 0 && <Badge variant="danger">Past end date</Badge>}
            {dueThisMonth(c, month) && <Badge variant="info">To bill</Badge>}
          </div>
        );
      },
      csv: (c) => contractStatusLabel(c.status),
    },
    {
      id: 'term',
      header: 'Term',
      hideBelow: 'md',
      sortable: true,
      sortValue: (c) => c.endDate ?? '9999',
      cell: (c) => (
        <span className="text-muted-foreground">
          {c.startDate ? formatDate(c.startDate) : 'No start'} – {c.endDate ? formatDate(c.endDate) : 'ongoing'}
        </span>
      ),
      csv: (c) => `${c.startDate?.slice(0, 10) ?? ''} – ${c.endDate?.slice(0, 10) ?? ''}`,
    },
    {
      id: 'billingDay',
      header: 'Bills on',
      hideBelow: 'lg',
      cell: (c) => (c.billingDay ? `Day ${c.billingDay}` : <span className="text-muted-foreground">No reminder</span>),
      csv: (c) => c.billingDay ?? '',
    },
    {
      id: 'billed',
      header: 'Billed so far',
      align: 'right',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (c) => c.billing?.billedPaise ?? 0,
      cell: (c) => (c.billing?.billedPaise ? formatPaise(c.billing.billedPaise, c.currency) : <span className="text-muted-foreground">—</span>),
      csv: (c) => csvMoney(c.billing?.billedPaise ?? 0),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-20',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label={`Delete ${c.name}`} onClick={() => void remove(c)} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');

  const all = contracts.data ?? [];
  const forClient = params.clientId ? all.filter((c) => c.clientId === params.clientId) : all;
  const q = params.q.trim().toLowerCase();
  const rows = forClient.filter((c) => {
    if (params.status && c.status !== params.status) return false;
    if (params.show === 'due' && !dueThisMonth(c, month)) return false;
    if (params.show === 'ending' && !endsSoon(c)) return false;
    if (q && !`${c.name} ${c.description ?? ''} ${nameOf(c.clientId)}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = sortRows(rows, columns, list.sort);

  const active = forClient.filter((c) => c.status === ContractStatus.ACTIVE);
  const mrr = totalsByCurrency(active, (c) => c.monthlyAmountPaise, (c) => c.currency);
  const due = forClient.filter((c) => dueThisMonth(c, month));
  const dueTotals = totalsByCurrency(due, (c) => c.monthlyAmountPaise, (c) => c.currency);
  const ending = forClient.filter(endsSoon);
  const clientLabel = params.clientId ? nameOf(params.clientId) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contracts"
        description={clientLabel ? `Retainers with ${clientLabel}.` : 'Retainers and monthly contracts — what to bill and what’s ending.'}
        action={
          <>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportColumnsCsv('contracts', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New contract
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly recurring"
          loading={contracts.isLoading}
          value={formatTotals(mrr, formatPaise)}
          hint={`${active.length} active contract${active.length === 1 ? '' : 's'}`}
          href={`/contracts?status=${ContractStatus.ACTIVE}${params.clientId ? `&clientId=${params.clientId}` : ''}`}
        />
        <StatCard
          label={`Due to bill · ${monthLabel(month)}`}
          loading={contracts.isLoading}
          tone={due.length ? 'warning' : 'default'}
          value={due.length ? formatTotals(dueTotals, formatPaise) : 'All billed'}
          hint={due.length ? `${due.length} contract${due.length === 1 ? '' : 's'} not invoiced yet` : 'Nothing left to invoice this month'}
          href={`/contracts?show=due${params.clientId ? `&clientId=${params.clientId}` : ''}`}
        />
        <StatCard
          label="Ending in 30 days"
          loading={contracts.isLoading}
          tone={ending.length ? 'warning' : 'default'}
          value={String(ending.length)}
          hint={ending.length ? 'Time to talk renewal' : 'No renewals coming up'}
          href={`/contracts?show=ending${params.clientId ? `&clientId=${params.clientId}` : ''}`}
        />
        <StatCard label="All contracts" loading={contracts.isLoading} value={String(forClient.length)} hint={`${forClient.length - active.length} paused or ended`} />
      </div>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(v) => list.set({ q: v })} placeholder="Search contract or client" />
        <Combobox
          className="w-auto min-w-[180px] sm:w-56"
          options={(clients.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
          value={params.clientId || undefined}
          onChange={(v) => list.set({ clientId: v ?? '' })}
          placeholder="All clients"
          searchPlaceholder="Search clients"
          allowClear
        />
        <SelectFilter value={params.status} onChange={(v) => list.set({ status: v })} allLabel="Any status" options={CONTRACT_STATUS_OPTIONS} />
        <SelectFilter
          value={params.show}
          onChange={(v) => list.set({ show: v })}
          allLabel="All contracts"
          options={[
            { value: 'due', label: 'Due to bill this month' },
            { value: 'ending', label: 'Ending in 30 days' },
          ]}
        />
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>

      <DataTable
        columns={visible}
        rows={sorted}
        rowKey={(c) => c._id}
        loading={contracts.isLoading}
        error={contracts.error}
        onRetry={() => contracts.refetch()}
        sort={list.sort}
        onSortChange={list.setSort}
        rowHref={(c) => `/contracts/${c._id}`}
        empty={
          <EmptyState
            icon={Handshake}
            title={list.activeFilterCount ? 'No contracts match these filters' : 'No contracts yet'}
            description={list.activeFilterCount ? undefined : 'Add a retainer to get monthly billing reminders and one-click invoices.'}
            action={
              list.activeFilterCount ? (
                <Button size="sm" variant="outline" onClick={list.reset}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Add a contract
                </Button>
              )
            }
          />
        }
      />

      <ContractFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultClientId={params.clientId || undefined}
        onSaved={(c) => router.push(`/contracts/${c._id}`)}
      />
      <ContractFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} contract={editing ?? undefined} />
    </div>
  );
}
