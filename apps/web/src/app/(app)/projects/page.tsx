// Projects — a board of project cards by default, the table one click away.
// Owner: health rings (billed · collected · paid out) and burn verdicts. Everyone else: milestone
// progress, deadlines, team and only their own fee. Money never reaches a non-owner card.
'use client';

import { LayoutGrid, Plus, Rows3 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProjectStatus, Role } from '@agency/shared';

import { csvMoney } from '@/lib/csv';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { useAuthStore } from '@/store/auth.store';

import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { ExportButton, FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { useNewParam } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Hero, HeroFigure, HeroMark, Legend, Price, PrivacyChip, ProjectChip } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { OwnerProjectCard, ProjectCardSkeleton, StaffProjectCard } from '@/features/projects/components/project-card';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { TeamFaces } from '@/features/projects/components/team-faces';
import {
  agreedCost,
  attentionReasons,
  daysUntil,
  deadlineInfo,
  isLive,
  milestoneProgress,
  RING_COLORS,
  TONE_TEXT,
} from '@/features/projects/project-signals';
import { useAllProjects, useProjectBalances, useProjects, type ProjectRow } from '@/features/projects/projects.hooks';

const PAGE_SIZE = 24;

export default function ProjectsPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const role = me?.role;
  const isOwner = role === Role.OWNER;
  const canCreate = role === Role.OWNER || role === Role.ADMIN || role === Role.LEAD;
  const list = useListState('projects', { q: '', status: '', clientId: '', sort: 'created:desc', view: 'board' });
  const { params } = list;
  const view = params.view === 'table' ? 'table' : 'board';
  const projects = useProjects({
    page: list.page,
    pageSize: PAGE_SIZE,
    q: params.q || undefined,
    status: (params.status || undefined) as ProjectStatus | undefined,
    clientId: isOwner && params.clientId ? params.clientId : undefined,
  });
  const everything = useAllProjects();
  const clients = useClients(undefined, { enabled: isOwner });
  const clientName = new Map((clients.data ?? []).map((c) => [c._id, c.name]));
  const [createOpen, setCreateOpen] = useState(false);
  useNewParam(() => canCreate && setCreateOpen(true));

  // The view toggle lives in the URL too, but it isn't a filter.
  const filterCount = list.activeFilterCount - (params.view && params.view !== 'board' ? 1 : 0);
  const resetFilters = () => list.set({ q: '', status: '', clientId: '' });

  const margin = (p: ProjectRow) => (p.clientBudgetPaise ?? 0) - agreedCost(p);
  const anyOwnFee = (projects.data?.items ?? []).some((p) => (p.myEngagement?.agreedPaise ?? 0) > 0);

  const columns: Column<ProjectRow>[] = [
    {
      id: 'name',
      header: 'Project',
      sortable: true,
      sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="min-w-0">
          <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} className="font-medium" />
          <p className="pl-3.5 text-xs text-muted-foreground">
            <span className="font-figures">{p.code}</span>
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
        if (!p.startDate && !p.endDate) return <span className="text-muted-foreground">Not set</span>;
        const dl = deadlineInfo(p);
        return (
          <span className={dl.tone === 'bad' ? TONE_TEXT.bad : 'text-muted-foreground'}>
            {p.startDate ? formatDate(p.startDate) : '…'} → {p.endDate ? formatDate(p.endDate) : 'ongoing'}
          </span>
        );
      },
      csv: (p) => `${p.startDate?.slice(0, 10) ?? ''} → ${p.endDate?.slice(0, 10) ?? ''}`,
    },
    {
      id: 'progress',
      header: 'Milestones',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      sortValue: (p) => milestoneProgress(p).pct,
      cell: (p) => {
        const m = milestoneProgress(p);
        return m.total ? (
          <span className="font-figures">
            {m.done}/{m.total} <span className="text-muted-foreground">· {m.pct}%</span>
          </span>
        ) : (
          <span className="text-muted-foreground">None</span>
        );
      },
      csv: (p) => `${milestoneProgress(p).done}/${milestoneProgress(p).total}`,
    },
    {
      id: 'team',
      header: 'Team',
      hideBelow: 'sm',
      sortable: true,
      sortValue: (p) => p.members.length,
      cell: (p) => <TeamFaces members={p.members} size="xs" />,
      csv: (p) => p.members.length,
    },
    ...(isOwner
      ? ([
          {
            id: 'budget',
            header: 'Budget',
            align: 'right',
            sortable: true,
            sortValue: (p: ProjectRow) => p.clientBudgetPaise ?? 0,
            hideBelow: 'md',
            cell: (p: ProjectRow) =>
              p.clientBudgetPaise ? <Price paise={p.clientBudgetPaise} currency={p.currency ?? 'INR'} /> : <span className="text-muted-foreground">Not set</span>,
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
                  <Price paise={margin(p)} currency={p.currency ?? 'INR'} />
                  <span className="ml-1 font-figures text-xs text-muted-foreground">{Math.round((margin(p) / p.clientBudgetPaise) * 100)}%</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              ),
            csv: (p: ProjectRow) => csvMoney(margin(p)),
          },
        ] as Column<ProjectRow>[])
      : anyOwnFee
        ? ([
            {
              id: 'mine',
              header: 'My fee still to come',
              align: 'right',
              hideBelow: 'md',
              cell: (p: ProjectRow) =>
                p.myEngagement && p.myEngagement.agreedPaise > 0 ? (
                  p.myEngagement.pendingPaise > 0 ? (
                    <Price own paise={p.myEngagement.pendingPaise} currency={p.myEngagement.currency} className="text-warning" />
                  ) : (
                    <span className="text-success">Paid</span>
                  )
                ) : (
                  <span className="text-muted-foreground">No fee</span>
                ),
            },
          ] as Column<ProjectRow>[])
        : []),
  ];
  const visible = columns.filter((c) => c.className !== 'hidden');
  const rows = sortRows(projects.data?.items, columns, list.sort);
  // One request for every card's health figures (owner board only).
  const balances = useProjectBalances(
    rows.map((r) => r._id),
    { enabled: isOwner && view === 'board' },
  );
  const batchState = balances.isError ? 'error' : balances.isSuccess ? 'ready' : 'loading';

  const createButton = canCreate && (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <Plus className="mr-1.5 h-3.5 w-3.5" /> New project
    </Button>
  );
  const empty = (
    <EmptyState
      illustration="projects"
      title={filterCount ? 'No projects match these filters' : canCreate ? 'No projects yet' : "You're not on any projects yet"}
      description={filterCount ? undefined : canCreate ? 'Create a project to plan milestones, add the team and track progress.' : 'When someone adds you to a project, it shows up here.'}
      action={
        filterCount ? (
          <Button size="sm" variant="outline" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Create a project
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-6">
      <ProjectsHero items={everything.data?.items} loading={everything.isLoading} isOwner={isOwner} isAdmin={role === Role.ADMIN} myId={me?.id} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar className="flex-1">
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
          <ResetFilters count={filterCount} onReset={resetFilters} />
        </FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            value={view}
            onChange={(v) => list.set({ view: v, page: String(list.page) })}
            options={[
              { value: 'board', label: 'Board', icon: LayoutGrid },
              { value: 'table', label: 'Table', icon: Rows3 },
            ]}
          />
          <ExportButton disabled={!rows.length} onClick={() => exportColumnsCsv('projects', columns, rows)} />
          {createButton}
        </div>
      </div>

      {view === 'board' ? (
        <section className="space-y-3">
          {isOwner && rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Legend
                items={[
                  { color: RING_COLORS.billed, label: 'Billed of budget' },
                  { color: RING_COLORS.collected, label: 'Collected of billed' },
                  { color: RING_COLORS.paidOut, label: 'Paid out of agreed fees' },
                ]}
              />
              <PrivacyChip>Only you see these figures</PrivacyChip>
            </div>
          )}
          {projects.isLoading ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : projects.isError ? (
            <div className="rounded-[var(--radius)] border bg-card">
              <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[var(--radius)] border bg-card">{empty}</div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) =>
                isOwner ? (
                  <OwnerProjectCard
                    key={p._id}
                    project={p}
                    clientName={p.clientId ? clientName.get(p.clientId) : undefined}
                    balance={balances.data?.[p._id]}
                    batchState={batchState}
                  />
                ) : (
                  <StaffProjectCard key={p._id} project={p} />
                ),
              )}
            </div>
          )}
        </section>
      ) : (
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
          empty={empty}
        />
      )}
      {projects.data && (
        <Pagination page={list.page} totalPages={projects.data.meta.totalPages} total={projects.data.meta.total} pageSize={PAGE_SIZE} onPage={list.setPage} />
      )}
      {canCreate && (
        <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultClientId={params.clientId || undefined} onSaved={(p) => router.push(`/projects/${p._id}`)} />
      )}
    </div>
  );
}

/** One sentence about the whole portfolio, written for the viewer's role. */
function ProjectsHero({
  items,
  loading,
  isOwner,
  isAdmin,
  myId,
}: {
  items: ProjectRow[] | undefined;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  myId?: string;
}) {
  const all = items ?? [];
  const live = all.filter(isLive);
  const attention = live.filter((p) => attentionReasons(p, isOwner).length > 0);
  const upcoming = live
    .map((p) => ({ p, d: daysUntil(p.endDate) }))
    .filter((x): x is { p: ProjectRow; d: number } => x.d !== undefined && x.d >= 0)
    .sort((a, b) => a.d - b.d);
  const next = upcoming[0];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  let sentence: React.ReactNode;
  let lede: React.ReactNode;
  if (isOwner) {
    const budget = live.reduce((s, p) => s + (p.clientBudgetPaise ?? 0), 0);
    if (all.length === 0) {
      sentence = 'No projects yet. Your first one starts here.';
      lede = 'Each project gets health rings for billing, collection and payouts once it has a budget and a team.';
    } else if (live.length === 0) {
      sentence = <>Nothing in flight right now — {plural(all.length, 'project')} on the books.</>;
      lede = 'Completed and on-hold projects are listed below.';
    } else {
      sentence = (
        <>
          <HeroFigure>{plural(live.length, 'active project')}</HeroFigure>
          {attention.length ? (
            <>
              {' '}— <HeroMark>{attention.length} need{attention.length === 1 ? 's' : ''} attention</HeroMark>.
            </>
          ) : (
            ' — all on track.'
          )}
        </>
      );
      lede = (
        <>
          {budget > 0 ? (
            <>
              Budgets in play add up to <Price paise={budget} compact className="font-semibold text-foreground" />.{' '}
            </>
          ) : null}
          {attention.length
            ? `Look at ${attention
                .slice(0, 3)
                .map((p) => p.name)
                .join(', ')}${attention.length > 3 ? ' and more' : ''} first.`
            : next
              ? `Next deadline: ${next.p.name}, ${next.d === 0 ? 'today' : `in ${plural(next.d, 'day')}`}.`
              : 'No deadlines coming up.'}
        </>
      );
    }
  } else {
    const mine = all.filter((p) => p.myEngagement);
    const pending = mine.reduce((s, p) => s + (p.myEngagement?.pendingPaise ?? 0), 0);
    const currency = mine.find((p) => p.myEngagement)?.myEngagement?.currency ?? 'INR';
    const late = live.filter((p) => (daysUntil(p.endDate) ?? 0) < 0);
    const subject = isAdmin ? 'The studio has' : "You're on";
    if (all.length === 0) {
      sentence = isAdmin ? 'No projects yet.' : "You're not on any projects yet.";
      lede = isAdmin ? 'Create one to plan milestones and bring the team in.' : 'When a lead adds you to a project, it shows up here with its milestones and deadline.';
    } else if (live.length === 0) {
      sentence = <>Nothing active right now — {plural(all.length, 'project')} finished or paused.</>;
      lede = 'Open any project to see its updates and files.';
    } else {
      sentence = (
        <>
          {subject} <HeroFigure>{plural(live.length, 'active project')}</HeroFigure>
          {late.length ? (
            <>
              {' '}— <HeroMark>{late.length} past {late.length === 1 ? 'its' : 'their'} deadline</HeroMark>.
            </>
          ) : next ? (
            <>
              {' '}— next deadline <HeroMark>{next.d === 0 ? 'is today' : `in ${plural(next.d, 'day')}`}</HeroMark>.
            </>
          ) : (
            '.'
          )}
        </>
      );
      const ms = live.reduce(
        (t, p) => {
          const m = milestoneProgress(p);
          return { done: t.done + m.done, total: t.total + m.total };
        },
        { done: 0, total: 0 },
      );
      lede = (
        <>
          {next ? `${next.p.name} is due ${formatDate(next.p.endDate!)}. ` : ''}
          {ms.total ? `${ms.done} of ${ms.total} milestones reached across ${isAdmin ? 'active projects' : 'your projects'}.` : ''}
          {!isAdmin && pending > 0 && myId ? (
            <>
              {' '}
              <Price own paise={pending} currency={currency} compact className="font-semibold text-foreground" /> of your fees is still to come —{' '}
              <Link href="/earnings" className="text-brand-ink underline-offset-2 hover:underline">
                see earnings
              </Link>
              .
            </>
          ) : null}
        </>
      );
    }
  }

  return (
    <Hero pageTitle="Projects" eyebrow={isOwner ? 'Projects · portfolio' : isAdmin ? 'Projects · studio' : 'Projects · yours'} loading={loading} lede={lede}>
      {sentence}
    </Hero>
  );
}
