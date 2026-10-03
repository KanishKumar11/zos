// Contracts — retainers: what's billed monthly, what's due to bill, and what's ending soon (OWNER).
'use client';

import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ContractStatus, Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { thisMonthLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Bento, BigNumber, Hero, HeroFigure, HeroMark, Price, PrivacyChip, Tile, useCanSeePrices } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import {
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_STATUS_TONE,
  contractStatusLabel,
  daysToEnd,
  daysUntil,
  dueThisMonth,
  endsSoon,
  monthLabel,
  nextBillingDate,
  totalsByCurrency,
} from '@/features/contracts/contract-utils';
import { ContractFormDialog } from '@/features/contracts/contract-form-dialog';
import { useContracts, useDeleteContract, type ContractRow } from '@/features/contracts/contracts.hooks';
import { ClientChip, PriceTotals } from '@/features/contracts/price-totals';

export default function ContractsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const inDays = (d: number) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

function Inner() {
  const router = useRouter();
  const confirm = useConfirm();
  const canSee = useCanSeePrices();
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
  const withClient = (href: string) => `${href}${params.clientId ? `&clientId=${params.clientId}` : ''}`;

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
      cell: (c) => <ClientChip clientId={c.clientId} name={clientName.get(c.clientId)} loading={clients.isLoading} href={`/clients/${c.clientId}`} />,
      csv: (c) => nameOf(c.clientId),
    },
    {
      id: 'monthly',
      header: 'Monthly',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.monthlyAmountPaise,
      cell: (c) => <Price paise={c.monthlyAmountPaise} currency={c.currency} className="font-medium" />,
      csv: (c) => (canSee ? csvMoney(c.monthlyAmountPaise) : ''),
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
      header: 'Next bill',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (c) => nextBillingDate(c) ?? '9999',
      cell: (c) => {
        const next = nextBillingDate(c);
        if (!c.billingDay) return <span className="text-muted-foreground">No reminder</span>;
        if (!next) return <span className="text-muted-foreground">Day {c.billingDay}</span>;
        return (
          <span title={`Day ${c.billingDay} of every month`}>
            {formatDate(next)} <span className="text-xs text-muted-foreground">· {inDays(daysUntil(next))}</span>
          </span>
        );
      },
      csv: (c) => c.billingDay ?? '',
      csvHeader: 'Bills on day',
    },
    {
      id: 'billed',
      header: 'Billed so far',
      align: 'right',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (c) => c.billing?.billedPaise ?? 0,
      cell: (c) => (c.billing?.billedPaise ? <Price paise={c.billing.billedPaise} currency={c.currency} /> : <span className="text-muted-foreground">Nothing yet</span>),
      csv: (c) => (canSee ? csvMoney(c.billing?.billedPaise ?? 0) : ''),
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
  const upcoming = active
    .map((c) => ({ c, date: nextBillingDate(c) }))
    .filter((x): x is { c: ContractRow; date: string } => !!x.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextUp = upcoming[0];
  const noReminder = active.filter((c) => !c.billingDay).length;

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Contracts"
        eyebrow={clientLabel ? `Contracts · ${clientLabel}` : `Contracts · ${monthLabel(month)}`}
        loading={contracts.isLoading}
        aside={
          <>
            {all.length > 0 && <PrivacyChip>Only you see these figures</PrivacyChip>}
            <Button variant="outline" size="sm" disabled={!rows.length || !canSee} onClick={() => exportColumnsCsv('contracts', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New contract
            </Button>
          </>
        }
        lede={
          contracts.error ? undefined : forClient.length === 0 ? (
            'Add a retainer to get monthly billing reminders and one-click invoices.'
          ) : due.length > 0 ? (
            <>
              {due.length} {plural(due.length, 'contract still needs', 'contracts still need')} an invoice for {monthLabel(month)} (
              <PriceTotals totals={dueTotals} compact className="font-medium text-foreground" />
              ).{ending.length > 0 && ` ${ending.length} ${plural(ending.length, 'ends', 'end')} in the next 30 days.`}
            </>
          ) : (
            <>
              Everything is billed for {monthLabel(month)}.{ending.length > 0 && ` ${ending.length} ${plural(ending.length, 'contract ends', 'contracts end')} in the next 30 days — time to talk renewal.`}
            </>
          )
        }
      >
        {contracts.error ? (
          'Couldn’t load your contracts.'
        ) : forClient.length === 0 ? (
          clientLabel ? `No retainers with ${clientLabel} yet.` : 'No retainers yet.'
        ) : active.length === 0 ? (
          'No active retainers right now — every contract is paused or ended.'
        ) : (
          <>
            <HeroMark>
              {active.length} active {plural(active.length, 'retainer', 'retainers')}
            </HeroMark>
            {clientLabel ? ` with ${clientLabel}` : ''} bringing in{' '}
            <HeroFigure>
              <PriceTotals totals={mrr} compact />
            </HeroFigure>{' '}
            a month.
          </>
        )}
      </Hero>

      {contracts.isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : (
        !contracts.error &&
        forClient.length > 0 && (
          <Bento>
            <Tile span={3} tone="ink" title="Monthly recurring">
              <BigNumber caption={`${active.length} active ${plural(active.length, 'contract', 'contracts')}`} className="[&>div]:text-brand">
                <PriceTotals totals={mrr} compact />
              </BigNumber>
            </Tile>
            <Tile
              span={3}
              title={`Due to bill · ${monthLabel(month)}`}
              action={
                due.length > 0 ? (
                  <Link href={withClient('/contracts?show=due')} className="text-xs font-medium text-brand-ink hover:underline">
                    Show
                  </Link>
                ) : undefined
              }
            >
              <BigNumber caption={due.length ? `${due.length} not invoiced yet` : 'Nothing left to invoice'} className={due.length ? '[&>div]:text-warning' : undefined}>
                {due.length ? <PriceTotals totals={dueTotals} compact /> : 'All billed'}
              </BigNumber>
            </Tile>
            <Tile span={3} title="Next billing">
              {nextUp ? (
                <BigNumber
                  caption={
                    <>
                      {formatDate(nextUp.date)} · {nextUp.c.name}
                      {upcoming.length > 1 && ` · ${upcoming.length - 1} more after`}
                    </>
                  }
                >
                  {daysUntil(nextUp.date) === 0 ? 'Today' : daysUntil(nextUp.date) === 1 ? 'Tomorrow' : `${daysUntil(nextUp.date)} days`}
                </BigNumber>
              ) : (
                <BigNumber caption={active.length ? 'Set a billing day on a contract to get reminders' : 'No active contracts'}>—</BigNumber>
              )}
              {nextUp && noReminder > 0 && (
                <p className="mt-2 text-xs text-warning">
                  {noReminder} active {plural(noReminder, 'contract has', 'contracts have')} no billing day
                </p>
              )}
            </Tile>
            <Tile
              span={3}
              title="Ending in 30 days"
              action={
                ending.length > 0 ? (
                  <Link href={withClient('/contracts?show=ending')} className="text-xs font-medium text-brand-ink hover:underline">
                    Show
                  </Link>
                ) : undefined
              }
            >
              <BigNumber caption={ending.length ? 'Time to talk renewal' : 'No renewals coming up'} className={ending.length ? '[&>div]:text-warning' : undefined}>
                {ending.length}
              </BigNumber>
              <p className="mt-2 text-xs text-muted-foreground">
                {forClient.length} {plural(forClient.length, 'contract', 'contracts')} in all · {forClient.length - active.length} paused or ended
              </p>
            </Tile>
          </Bento>
        )
      )}

      <FilterBar>
        <SearchFilter value={params.q} onChange={(v) => list.set({ q: v })} placeholder="Search contract or client" />
        <Combobox
          className="w-full min-w-[180px] sm:w-56"
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
            illustration={list.activeFilterCount ? 'inbox' : 'money'}
            title={list.activeFilterCount ? 'No contracts match these filters' : 'No contracts yet'}
            description={list.activeFilterCount ? undefined : 'Add a retainer to get monthly billing reminders and one-click invoices.'}
            action={
              list.activeFilterCount ? (
                <Button size="sm" variant="outline" onClick={list.reset}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" variant="brand" onClick={() => setCreateOpen(true)}>
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
