// Statements of work — scope and payment milestones agreed with clients (OWNER).
'use client';

import { Download, FileSignature, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/states';
import { useClients } from '@/features/clients/clients.hooks';
import { formatTotals, totalsByCurrency } from '@/features/contracts/contract-utils';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { SowFormDialog } from '@/features/sow/sow-form-dialog';
import { SOW_STATUS_LABEL, sowStatus, useSows, type SowRow, type SowStatus } from '@/features/sow/sow.hooks';

export default function SowsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowsInner />
    </RoleGate>
  );
}

const STATUS_TONE: Record<SowStatus, 'muted' | 'info' | 'success'> = { DRAFT: 'muted', SENT: 'info', SIGNED: 'success' };

type NewDefaults = { clientId?: string; title?: string; totalValuePaise?: number; currency?: string };

function SowsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const list = useListState('sows', { q: '', clientId: '', status: '', sort: 'created:desc' });
  const { params } = list;
  const sows = useSows({ clientId: params.clientId || undefined });
  const clients = useClients();
  const projects = useAllProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [defaults, setDefaults] = useState<NewDefaults>();

  // ?new=1 opens the create dialog; a won deal also passes clientId / title / value / currency.
  const newFlag = search.get('new');
  useEffect(() => {
    if (newFlag !== '1') return;
    const value = Number(search.get('value'));
    setDefaults({
      clientId: search.get('clientId') || undefined,
      title: search.get('title') || undefined,
      totalValuePaise: Number.isFinite(value) && value > 0 ? value : undefined,
      currency: search.get('currency') || undefined,
    });
    setCreateOpen(true);
    const next = new URLSearchParams(search.toString());
    for (const k of ['new', 'title', 'value', 'currency']) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFlag]);

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c._id, c.name])), [clients.data]);
  const projectName = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p.name])), [projects.data]);
  const nameOfClient = (id: string) => clientName.get(id) ?? (clients.isLoading ? '…' : 'Deleted client');

  const columns: Column<SowRow>[] = [
    {
      id: 'title',
      header: 'SOW',
      sortable: true,
      sortValue: (s) => s.title.toLowerCase(),
      cell: (s) => (
        <div className="min-w-0">
          <Link href={`/sows/${s._id}`} className="font-medium hover:underline">
            {s.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {s.milestones.length ? `${s.milestones.length} milestone${s.milestones.length === 1 ? '' : 's'}` : 'No milestones'}
          </p>
        </div>
      ),
      csv: (s) => s.title,
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (s) => nameOfClient(s.clientId).toLowerCase(),
      cell: (s) =>
        clientName.has(s.clientId) ? (
          <Link href={`/clients/${s.clientId}`} className="hover:underline">
            {nameOfClient(s.clientId)}
          </Link>
        ) : (
          <span className="text-muted-foreground">{nameOfClient(s.clientId)}</span>
        ),
      csv: (s) => nameOfClient(s.clientId),
    },
    {
      id: 'project',
      header: 'Project',
      hideBelow: 'md',
      cell: (s) =>
        !s.projectId ? (
          <span className="text-muted-foreground">—</span>
        ) : projectName.has(s.projectId) ? (
          <Link href={`/projects/${s.projectId}`} className="hover:underline">
            {projectName.get(s.projectId)}
          </Link>
        ) : (
          <span className="text-muted-foreground">{projects.isLoading ? '…' : 'Deleted project'}</span>
        ),
      csv: (s) => (s.projectId ? (projectName.get(s.projectId) ?? '') : ''),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.totalValuePaise,
      cell: (s) => formatPaise(s.totalValuePaise, s.currency),
      csv: (s) => csvMoney(s.totalValuePaise),
    },
    { id: 'currency', header: 'Currency', cell: () => null, className: 'hidden', csv: (s) => s.currency },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (s) => sowStatus(s),
      cell: (s) => {
        const st = sowStatus(s);
        const when = s.signedAt ?? s.sentAt;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_TONE[st]}>{SOW_STATUS_LABEL[st]}</Badge>
            {when && <span className="text-xs text-muted-foreground">{formatDate(when)}</span>}
          </div>
        );
      },
      csv: (s) => SOW_STATUS_LABEL[sowStatus(s)],
    },
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (s) => s.createdAt,
      cell: (s) => <span className="text-muted-foreground">{formatDate(s.createdAt)}</span>,
      csv: (s) => s.createdAt.slice(0, 10),
    },
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');

  const all = sows.data ?? [];
  const q = params.q.trim().toLowerCase();
  const rows = all.filter((s) => {
    if (params.status && sowStatus(s) !== params.status) return false;
    if (q && !`${s.title} ${s.description} ${nameOfClient(s.clientId)}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = sortRows(rows, columns, list.sort);

  const signed = all.filter((s) => sowStatus(s) === 'SIGNED');
  const sent = all.filter((s) => sowStatus(s) === 'SENT');
  const drafts = all.filter((s) => sowStatus(s) === 'DRAFT');
  const value = (xs: SowRow[]) => formatTotals(totalsByCurrency(xs, (s) => s.totalValuePaise, (s) => s.currency), formatPaise);
  const filterHref = (status: string) => `/sows?status=${status}${params.clientId ? `&clientId=${params.clientId}` : ''}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Statements of work"
        description="Scope and payment milestones agreed with clients."
        action={
          <>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportColumnsCsv('sows', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDefaults({ clientId: params.clientId || undefined });
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New SOW
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Signed" loading={sows.isLoading} tone={signed.length ? 'success' : 'default'} value={value(signed)} hint={`${signed.length} SOW${signed.length === 1 ? '' : 's'}`} href={filterHref('SIGNED')} />
        <StatCard label="Awaiting signature" loading={sows.isLoading} tone={sent.length ? 'warning' : 'default'} value={value(sent)} hint={`${sent.length} sent`} href={filterHref('SENT')} />
        <StatCard label="Drafts" loading={sows.isLoading} value={value(drafts)} hint={`${drafts.length} not sent yet`} href={filterHref('DRAFT')} />
      </div>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(v) => list.set({ q: v })} placeholder="Search title or client" />
        <Combobox
          className="w-auto min-w-[180px] sm:w-56"
          options={(clients.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
          value={params.clientId || undefined}
          onChange={(v) => list.set({ clientId: v ?? '' })}
          placeholder="All clients"
          searchPlaceholder="Search clients"
          allowClear
        />
        <SelectFilter
          value={params.status}
          onChange={(v) => list.set({ status: v })}
          allLabel="Any status"
          options={(Object.keys(SOW_STATUS_LABEL) as SowStatus[]).map((s) => ({ value: s, label: SOW_STATUS_LABEL[s] }))}
        />
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>

      <DataTable
        columns={visible}
        rows={sorted}
        rowKey={(s) => s._id}
        loading={sows.isLoading}
        error={sows.error}
        onRetry={() => sows.refetch()}
        sort={list.sort}
        onSortChange={list.setSort}
        rowHref={(s) => `/sows/${s._id}`}
        empty={
          <EmptyState
            icon={FileSignature}
            title={list.activeFilterCount ? 'No SOWs match these filters' : 'No statements of work yet'}
            description={list.activeFilterCount ? undefined : 'Write down the scope and payment milestones, then turn it into a project in one click.'}
            action={
              list.activeFilterCount ? (
                <Button size="sm" variant="outline" onClick={list.reset}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create a SOW
                </Button>
              )
            }
          />
        }
      />

      <SowFormDialog open={createOpen} onOpenChange={setCreateOpen} defaults={defaults} onSaved={(s) => router.push(`/sows/${s._id}`)} />
    </div>
  );
}
