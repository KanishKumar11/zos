// Clients — with what each owes, projects and portal access at a glance (OWNER).
'use client';

import { Building2, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { csvMoney } from '@/lib/csv';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { ClientFormDialog } from '@/features/clients/client-form-dialog';
import { useClientsWithStats, type ClientRow } from '@/features/clients/clients.hooks';

export default function ClientsPage() {
  const router = useRouter();
  const list = useListState('clients', { q: '', show: '', sort: 'name:asc' });
  const clients = useClientsWithStats(list.params.q || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  useNewParam(() => setCreateOpen(true));

  const columns: Column<ClientRow>[] = [
    {
      id: 'name',
      header: 'Client',
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div>
          <Link href={`/clients/${c._id}`} className="font-medium hover:underline">
            {c.name}
          </Link>
          <p className="text-xs text-muted-foreground">{[c.contacts[0]?.name, c.billingEmail || c.contacts[0]?.email].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
      csv: (c) => c.name,
    },
    { id: 'gstin', header: 'GSTIN', cell: () => null, className: 'hidden', csv: (c) => c.gstin },
    {
      id: 'projects',
      header: 'Projects',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      sortValue: (c) => c.stats?.activeProjects ?? 0,
      cell: (c) => (
        <span>
          {c.stats?.activeProjects ?? 0}
          <span className="text-muted-foreground"> / {c.stats?.totalProjects ?? 0}</span>
        </span>
      ),
      csv: (c) => c.stats?.totalProjects ?? 0,
    },
    {
      id: 'invoiced',
      header: 'Invoiced',
      align: 'right',
      sortable: true,
      hideBelow: 'md',
      sortValue: (c) => c.stats?.invoicedPaise ?? 0,
      cell: (c) => formatPaise(c.stats?.invoicedPaise ?? 0),
      csv: (c) => csvMoney(c.stats?.invoicedPaise ?? 0),
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.stats?.outstandingPaise ?? 0,
      cell: (c) => {
        const s = c.stats;
        if (!s?.outstandingPaise) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={s.overduePaise ? 'font-medium text-destructive' : 'font-medium'}>
            {formatPaise(s.outstandingPaise)}
            {s.overduePaise > 0 && <span className="block text-[11px] font-normal">{formatPaise(s.overduePaise)} overdue</span>}
          </span>
        );
      },
      csv: (c) => csvMoney(c.stats?.outstandingPaise ?? 0),
    },
    {
      id: 'lastPayment',
      header: 'Last paid',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (c) => c.stats?.lastPaymentAt ?? '',
      cell: (c) => (c.stats?.lastPaymentAt ? formatDate(c.stats.lastPaymentAt) : <span className="text-muted-foreground">—</span>),
    },
    {
      id: 'portal',
      header: 'Portal',
      hideBelow: 'lg',
      cell: (c) => (c.stats?.portalUsers ? <Badge variant="info">{c.stats.portalUsers} user{c.stats.portalUsers === 1 ? '' : 's'}</Badge> : <span className="text-muted-foreground">—</span>),
    },
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');

  const all = clients.data ?? [];
  const rows = all.filter((c) =>
    list.params.show === 'owing' ? (c.stats?.outstandingPaise ?? 0) > 0 : list.params.show === 'overdue' ? (c.stats?.overduePaise ?? 0) > 0 : list.params.show === 'active' ? (c.stats?.activeProjects ?? 0) > 0 : true,
  );
  const sorted = sortRows(rows, columns, list.sort);
  const outstanding = all.reduce((s, c) => s + (c.stats?.outstandingPaise ?? 0), 0);
  const overdue = all.reduce((s, c) => s + (c.stats?.overduePaise ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        description="Who you work for, what they owe, and who has portal access."
        action={
          <>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportColumnsCsv('clients', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New client
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Clients" loading={clients.isLoading} value={String(all.length)} hint={`${all.filter((c) => (c.stats?.activeProjects ?? 0) > 0).length} with active projects`} />
        <StatCard label="Outstanding" tone={outstanding ? 'warning' : 'default'} loading={clients.isLoading} value={formatPaise(outstanding)} href="/invoices?status=open" />
        <StatCard label="Overdue" tone={overdue ? 'danger' : 'default'} loading={clients.isLoading} value={formatPaise(overdue)} href="/invoices?status=OVERDUE" />
      </div>
      <FilterBar>
        <SearchFilter value={list.params.q} onChange={(q) => list.set({ q })} placeholder="Search name, GSTIN, contact" />
        <SelectFilter
          value={list.params.show}
          onChange={(show) => list.set({ show })}
          allLabel="All clients"
          options={[
            { value: 'active', label: 'With active projects' },
            { value: 'owing', label: 'Owing money' },
            { value: 'overdue', label: 'Overdue' },
          ]}
        />
      </FilterBar>
      <DataTable
        columns={visible}
        rows={sorted}
        rowKey={(c) => c._id}
        loading={clients.isLoading}
        error={clients.error}
        onRetry={() => clients.refetch()}
        sort={list.sort}
        onSortChange={list.setSort}
        rowHref={(c) => `/clients/${c._id}`}
        empty={
          <EmptyState
            icon={Building2}
            title={list.activeFilterCount ? 'No clients match' : 'No clients yet'}
            action={<Button size="sm" onClick={() => setCreateOpen(true)}>Add your first client</Button>}
          />
        }
      />
      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={(c) => router.push(`/clients/${c._id}`)} />
    </div>
  );
}
