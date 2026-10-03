// Clients (OWNER) — a wall of client cards: what each owes, how many projects, and how the
// relationship has grown (lifetime billed). The table, filters and CSV are one click away.
// Staff can't reach this page (middleware + API are owner-only); if they land here anyway they get
// a plain explanation and no request is made.
'use client';

import { Building2, LayoutGrid, Plus, Rows3, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useListState } from '@/lib/list-state';
import { useAuthStore } from '@/store/auth.store';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { ExportButton, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { usePageTitle } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Avatar, Hero, HeroFigure, HeroMark, Price, PrivacyChip, Sparkline } from '@/components/viz';
import { byClient, lifetimeSeries } from '@/features/clients/client-signals';
import { ClientFormDialog } from '@/features/clients/client-form-dialog';
import { useClientsWithStats, type ClientRow } from '@/features/clients/clients.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';

export default function ClientsPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role && role !== Role.OWNER) return <OwnerOnly />;
  return <OwnerClients />;
}

function OwnerOnly() {
  usePageTitle('Clients');
  return (
    <div className="rounded-[var(--radius)] border bg-card">
      <EmptyState
        illustration="people"
        title="Clients are managed by the owner"
        description="Client details, invoices and balances are only visible to the studio owner. Your projects have everything you need for the work."
        action={
          <Button size="sm" asChild>
            <Link href="/projects">Go to my projects</Link>
          </Button>
        }
      />
    </div>
  );
}

function OwnerClients() {
  const router = useRouter();
  const list = useListState('clients', { q: '', show: '', sort: 'name:asc', view: 'cards' });
  const view = list.params.view === 'table' ? 'table' : 'cards';
  const clients = useClientsWithStats(list.params.q || undefined);
  // The hero describes every client, whatever the search box says.
  const everyone = useClientsWithStats(undefined);
  const invoices = useInvoices({});
  const invoicesByClient = useMemo(() => byClient(invoices.data), [invoices.data]);
  const [createOpen, setCreateOpen] = useState(false);
  useNewParam(() => setCreateOpen(true));

  const filterCount = (list.params.q ? 1 : 0) + (list.params.show ? 1 : 0);
  const resetFilters = () => list.set({ q: '', show: '' });

  const columns: Column<ClientRow>[] = [
    {
      id: 'name',
      header: 'Client',
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar id={c._id} name={c.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/clients/${c._id}`} className="font-medium hover:underline">
              {c.name}
            </Link>
            <p className="text-xs text-muted-foreground">{[c.contacts[0]?.name, c.billingEmail || c.contacts[0]?.email].filter(Boolean).join(' · ') || 'No contact yet'}</p>
          </div>
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
        <span className="font-figures">
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
      cell: (c) => <Price paise={c.stats?.invoicedPaise ?? 0} />,
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
        if (!s?.outstandingPaise) return <span className="text-muted-foreground">Settled</span>;
        return (
          <span className={s.overduePaise ? 'font-medium text-destructive' : 'font-medium'}>
            <Price paise={s.outstandingPaise} />
            {s.overduePaise > 0 && (
              <span className="block text-[11px] font-normal">
                <Price paise={s.overduePaise} /> overdue
              </span>
            )}
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
      cell: (c) => (c.stats?.lastPaymentAt ? formatDate(c.stats.lastPaymentAt) : <span className="text-muted-foreground">Never</span>),
    },
    {
      id: 'portal',
      header: 'Portal',
      hideBelow: 'lg',
      cell: (c) =>
        c.stats?.portalUsers ? (
          <Badge variant="info">
            {c.stats.portalUsers} user{c.stats.portalUsers === 1 ? '' : 's'}
          </Badge>
        ) : (
          <span className="text-muted-foreground">No access</span>
        ),
    },
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');

  const rows = (clients.data ?? []).filter((c) =>
    list.params.show === 'owing'
      ? (c.stats?.outstandingPaise ?? 0) > 0
      : list.params.show === 'overdue'
        ? (c.stats?.overduePaise ?? 0) > 0
        : list.params.show === 'active'
          ? (c.stats?.activeProjects ?? 0) > 0
          : true,
  );
  const sorted = sortRows(rows, columns, list.sort);
  const all = everyone.data ?? [];
  const outstanding = all.reduce((s, c) => s + (c.stats?.outstandingPaise ?? 0), 0);
  const overdue = all.reduce((s, c) => s + (c.stats?.overduePaise ?? 0), 0);
  const owing = all.filter((c) => (c.stats?.outstandingPaise ?? 0) > 0).length;
  const overdueClients = all.filter((c) => (c.stats?.overduePaise ?? 0) > 0).length;
  const active = all.filter((c) => (c.stats?.activeProjects ?? 0) > 0).length;

  const empty = (
    <EmptyState
      illustration="people"
      title={filterCount ? 'No clients match' : 'No clients yet'}
      description={filterCount ? undefined : 'Add a client to start projects and invoices for them.'}
      action={
        filterCount ? (
          <Button size="sm" variant="outline" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add your first client
          </Button>
        )
      }
    />
  );

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Clients"
        eyebrow="Clients"
        aside={<PrivacyChip>Only you see these figures</PrivacyChip>}
        loading={everyone.isLoading}
        lede={
          all.length === 0
            ? 'Add the companies you work for — then invite their people to the client portal.'
            : `${active} with active projects. ${overdueClients ? `${overdueClients} ${overdueClients === 1 ? 'is' : 'are'} past due — start there.` : 'Nobody is past due.'}`
        }
      >
        {all.length === 0 ? (
          'No clients yet. Your first one is a click away.'
        ) : outstanding === 0 ? (
          <>
            <HeroFigure>
              {all.length} client{all.length === 1 ? '' : 's'}
            </HeroFigure>{' '}
            and nobody owes you anything. Nice.
          </>
        ) : (
          <>
            {owing} of {all.length} client{all.length === 1 ? '' : 's'} owe you{' '}
            <HeroFigure>
              <Price paise={outstanding} compact />
            </HeroFigure>
            {overdue > 0 ? (
              <>
                {' '}— <HeroMark>
                  <Price paise={overdue} compact /> of it overdue
                </HeroMark>
                .
              </>
            ) : (
              ', none of it overdue.'
            )}
          </>
        )}
      </Hero>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar className="flex-1">
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
          <ResetFilters count={filterCount} onReset={resetFilters} />
        </FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            value={view}
            onChange={(v) => list.set({ view: v })}
            options={[
              { value: 'cards', label: 'Cards', icon: LayoutGrid },
              { value: 'table', label: 'Table', icon: Rows3 },
            ]}
          />
          <ExportButton disabled={!rows.length} onClick={() => exportColumnsCsv('clients', columns, sorted)} />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New client
          </Button>
        </div>
      </div>

      {view === 'cards' ? (
        clients.isLoading ? (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-[var(--radius)]" />
            ))}
          </div>
        ) : clients.isError ? (
          <div className="rounded-[var(--radius)] border bg-card">
            <ErrorState error={clients.error} onRetry={() => clients.refetch()} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-[var(--radius)] border bg-card">{empty}</div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((c) => (
              <ClientCard key={c._id} client={c} series={invoices.data ? lifetimeSeries(invoicesByClient.get(c._id) ?? []) : undefined} />
            ))}
          </div>
        )
      ) : (
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
          empty={empty}
        />
      )}
      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={(c) => router.push(`/clients/${c._id}`)} />
    </div>
  );
}

function ClientCard({ client: c, series }: { client: ClientRow; series: number[] | null | undefined }) {
  const s = c.stats;
  const contact = c.contacts[0]?.name || c.billingEmail || c.contacts[0]?.email;
  return (
    <Link
      href={`/clients/${c._id}`}
      className="group block min-w-0 animate-rise rounded-[var(--radius)] border bg-card p-4 outline-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <Avatar id={c._id} name={c.name} size="lg" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">{contact || 'No contact yet'}</p>
        </div>
        {s?.overduePaise ? <Badge variant="danger">Overdue</Badge> : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          {s?.outstandingPaise ? (
            <p className={s.overduePaise ? 'font-display text-2xl font-bold text-destructive' : 'font-display text-2xl font-bold'}>
              <Price paise={s.outstandingPaise} compact />
            </p>
          ) : (
            <p className="font-display text-2xl font-bold text-success">Settled</p>
          )}
          {s?.overduePaise ? (
            <p className="text-[11px] text-destructive">
              <Price paise={s.overduePaise} compact /> overdue
            </p>
          ) : null}
        </div>
        <div className="w-28 shrink-0 text-right">
          {series ? (
            <>
              <Sparkline values={series} color={identityColor(c._id)} height={36} />
              <p className="text-[11px] text-muted-foreground">
                <Price paise={s?.invoicedPaise ?? series[series.length - 1]} compact /> lifetime
              </p>
            </>
          ) : s?.invoicedPaise ? (
            <p className="text-[11px] text-muted-foreground">
              <Price paise={s.invoicedPaise} compact /> billed so far
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Nothing billed yet</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          <span className="font-figures text-foreground">{s?.activeProjects ?? 0}</span> active / {s?.totalProjects ?? 0} projects
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {s?.portalUsers ? `${s.portalUsers} on portal` : 'No portal access'}
        </span>
        {s?.lastPaymentAt && <span>Paid {formatDate(s.lastPaymentAt, { day: 'numeric', month: 'short' })}</span>}
      </div>
    </Link>
  );
}
