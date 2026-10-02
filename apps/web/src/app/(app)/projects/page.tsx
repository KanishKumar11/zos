// Projects — everyone sees the projects they're on; the owner also sees budget and margin.
'use client';

import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProjectStatus, Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useAuthStore } from '@/store/auth.store';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { ExportButton, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { useClients } from '@/features/clients/clients.hooks';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { useProjects, type ProjectRow } from '@/features/projects/projects.hooks';

const PAGE_SIZE = 25;

export default function ProjectsPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const canCreate = role === Role.OWNER || role === Role.ADMIN || role === Role.LEAD;
  const list = useListState('projects', { q: '', status: '', clientId: '', sort: 'created:desc' });
  const { params } = list;
  const projects = useProjects({
    page: list.page,
    pageSize: PAGE_SIZE,
    q: params.q || undefined,
    status: (params.status || undefined) as ProjectStatus | undefined,
    clientId: isOwner && params.clientId ? params.clientId : undefined,
  });
  const clients = useClients(undefined);
  const clientName = new Map((clients.data ?? []).map((c) => [c._id, c.name]));
  const [createOpen, setCreateOpen] = useState(false);
  useNewParam(() => canCreate && setCreateOpen(true));

  const agreedCost = (p: ProjectRow) =>
    p.members.reduce((s, m) => s + (m.amountPaise ?? 0), 0) + (p.freelancers ?? []).reduce((s, f) => s + (f.agreedPaise ?? 0), 0);
  const margin = (p: ProjectRow) => (p.clientBudgetPaise ?? 0) - agreedCost(p);

  const columns: Column<ProjectRow>[] = [
    {
      id: 'name',
      header: 'Project',
      sortable: true,
      sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/projects/${p._id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{p.code}</span>
            {isOwner && (p.clientId ? ` · ${clientName.get(p.clientId) ?? 'Deleted client'}` : ' · Internal')}
          </p>
        </div>
      ),
      csv: (p) => p.name,
    },
    { id: 'code', header: 'Code', cell: () => null, className: 'hidden', csv: (p) => p.code },
    { id: 'status', header: 'Status', sortable: true, sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} />, csv: (p) => statusLabel(p.status) },
    {
      id: 'dates',
      header: 'Timeline',
      hideBelow: 'md',
      sortable: true,
      sortValue: (p) => p.endDate ?? '',
      cell: (p) => {
        if (!p.startDate && !p.endDate) return <span className="text-muted-foreground">—</span>;
        const late = p.endDate && p.status !== ProjectStatus.COMPLETED && new Date(p.endDate) < new Date();
        return (
          <span className={late ? 'text-destructive' : 'text-muted-foreground'}>
            {p.startDate ? formatDate(p.startDate) : '…'} → {p.endDate ? formatDate(p.endDate) : 'ongoing'}
          </span>
        );
      },
      csv: (p) => `${p.startDate?.slice(0, 10) ?? ''} → ${p.endDate?.slice(0, 10) ?? ''}`,
    },
    { id: 'team', header: 'Team', align: 'right', hideBelow: 'sm', sortable: true, sortValue: (p) => p.members.length, cell: (p) => p.members.length, csv: (p) => p.members.length },
    ...(isOwner
      ? ([
          {
            id: 'budget',
            header: 'Budget',
            align: 'right',
            sortable: true,
            sortValue: (p: ProjectRow) => p.clientBudgetPaise ?? 0,
            hideBelow: 'md',
            cell: (p: ProjectRow) => (p.clientBudgetPaise ? formatPaise(p.clientBudgetPaise, p.currency ?? 'INR') : <span className="text-muted-foreground">—</span>),
            csv: (p: ProjectRow) => csvMoney(p.clientBudgetPaise ?? 0),
          },
          {
            id: 'margin',
            header: 'Planned margin',
            align: 'right',
            sortable: true,
            sortValue: (p: ProjectRow) => margin(p),
            hideBelow: 'lg',
            cell: (p: ProjectRow) =>
              p.clientBudgetPaise ? (
                <span className={margin(p) < 0 ? 'font-medium text-destructive' : ''}>
                  {formatPaise(margin(p), p.currency ?? 'INR')}
                  <span className="ml-1 text-xs text-muted-foreground">{Math.round((margin(p) / p.clientBudgetPaise) * 100)}%</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
            csv: (p: ProjectRow) => csvMoney(margin(p)),
          },
        ] as Column<ProjectRow>[])
      : ([
          {
            id: 'mine',
            header: 'My pending',
            align: 'right',
            hideBelow: 'md',
            cell: (p: ProjectRow) =>
              p.myEngagement && p.myEngagement.agreedPaise > 0 ? (
                <span className={p.myEngagement.pendingPaise > 0 ? 'text-amber-700 dark:text-amber-500' : 'text-muted-foreground'}>
                  {formatPaise(p.myEngagement.pendingPaise, p.myEngagement.currency)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ] as Column<ProjectRow>[])),
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');
  const rows = sortRows(projects.data?.items, columns, list.sort);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description={isOwner ? 'Every project with its status, team and margin.' : "Projects you're working on."}
        action={
          <>
            <ExportButton disabled={!rows.length} onClick={() => exportColumnsCsv('projects', columns, rows)} />
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New project
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search name or code" />
        <SelectFilter
          value={params.status}
          onChange={(status) => list.set({ status })}
          allLabel="Any status"
          options={Object.values(ProjectStatus).map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        {isOwner && (
          <div className="w-full sm:w-56">
            <Combobox
              options={(clients.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
              value={params.clientId || undefined}
              allowClear
              placeholder="Any client"
              onChange={(v) => list.set({ clientId: v ?? '' })}
            />
          </div>
        )}
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>
      <DataTable
        columns={visible}
        rows={rows}
        rowKey={(p) => p._id}
        loading={projects.isLoading}
        error={projects.error}
        onRetry={() => projects.refetch()}
        sort={list.sort}
        onSortChange={list.setSort}
        rowHref={(p) => `/projects/${p._id}`}
        empty={
          <EmptyState
            icon={FolderKanban}
            title={list.activeFilterCount ? 'No projects match these filters' : canCreate ? 'No projects yet' : "You're not on any projects yet"}
            action={
              list.activeFilterCount ? (
                <Button size="sm" variant="outline" onClick={list.reset}>Clear filters</Button>
              ) : canCreate ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>Create a project</Button>
              ) : undefined
            }
          />
        }
      />
      {projects.data && (
        <Pagination page={list.page} totalPages={projects.data.meta.totalPages} total={projects.data.meta.total} pageSize={PAGE_SIZE} onPage={list.setPage} />
      )}
      {canCreate && <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultClientId={params.clientId || undefined} onSaved={(p) => router.push(`/projects/${p._id}`)} />}
    </div>
  );
}
