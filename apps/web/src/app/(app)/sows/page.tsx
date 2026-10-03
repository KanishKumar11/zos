// Statements of work — scope and payment milestones agreed with clients (OWNER).
'use client';

import { Download, LayoutGrid, Plus, Rows3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { csvMoney } from '@/lib/csv';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, exportColumnsCsv, sortRows, type Column } from '@/components/data/data-table';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Hero, HeroFigure, HeroMark, Price, PrivacyChip, ProjectChip, useCanSeePrices } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { totalsByCurrency } from '@/features/contracts/contract-utils';
import { ClientChip, PriceTotals } from '@/features/contracts/price-totals';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { SowFormDialog } from '@/features/sow/sow-form-dialog';
import { SOW_STATUS_LABEL, sowStatus, useSows, type SowRow, type SowStatus } from '@/features/sow/sow.hooks';
import { milestoneProgress, SowMilestoneBar } from '@/features/sow/sow-visuals';

export default function SowsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowsInner />
    </RoleGate>
  );
}

const STATUS_TONE: Record<SowStatus, 'muted' | 'info' | 'success'> = { DRAFT: 'muted', SENT: 'info', SIGNED: 'success' };
const STATUS_DOT: Record<SowStatus, string> = {
  DRAFT: 'hsl(var(--muted-foreground) / 0.55)',
  SENT: 'hsl(var(--info))',
  SIGNED: 'hsl(var(--success))',
};
const LANE_HINT: Record<SowStatus, string> = { DRAFT: 'Not sent yet', SENT: 'Waiting on a signature', SIGNED: 'Agreed' };
const STATUSES: SowStatus[] = ['DRAFT', 'SENT', 'SIGNED'];
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

type NewDefaults = { clientId?: string; title?: string; totalValuePaise?: number; currency?: string };

function SowsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const canSee = useCanSeePrices();
  const list = useListState('sows', { q: '', clientId: '', status: '', view: 'board', sort: 'created:desc' });
  const { params } = list;
  const view = params.view === 'table' ? 'table' : 'board';
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

  const projectCell = (s: SowRow) =>
    !s.projectId ? (
      <span className="text-muted-foreground">No project yet</span>
    ) : projectName.has(s.projectId) ? (
      <ProjectChip id={s.projectId} name={projectName.get(s.projectId)!} href={`/projects/${s.projectId}`} />
    ) : (
      <span className="italic text-muted-foreground">{projects.isLoading ? '…' : 'Deleted project'}</span>
    );

  const columns: Column<SowRow>[] = [
    {
      id: 'title',
      header: 'SOW',
      sortable: true,
      sortValue: (s) => s.title.toLowerCase(),
      cell: (s) => (
        <div className="min-w-0 space-y-1">
          <Link href={`/sows/${s._id}`} className="font-medium hover:underline">
            {s.title}
          </Link>
          {s.milestones.length ? (
            <div className="flex items-center gap-2">
              <SowMilestoneBar milestones={s.milestones} currency={s.currency} className="w-24" />
              <span className="text-xs text-muted-foreground">
                {milestoneProgress(s.milestones).reached}/{s.milestones.length} milestones
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No milestones</p>
          )}
        </div>
      ),
      csv: (s) => s.title,
    },
    {
      id: 'client',
      header: 'Client',
      sortable: true,
      sortValue: (s) => nameOfClient(s.clientId).toLowerCase(),
      cell: (s) => <ClientChip clientId={s.clientId} name={clientName.get(s.clientId)} loading={clients.isLoading} href={`/clients/${s.clientId}`} />,
      csv: (s) => nameOfClient(s.clientId),
    },
    {
      id: 'project',
      header: 'Project',
      hideBelow: 'md',
      cell: projectCell,
      csv: (s) => (s.projectId ? (projectName.get(s.projectId) ?? 'Deleted project') : ''),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.totalValuePaise,
      cell: (s) => <Price paise={s.totalValuePaise} currency={s.currency} className="font-medium" />,
      csv: (s) => (canSee ? csvMoney(s.totalValuePaise) : ''),
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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_TONE[st]}>{st === 'SIGNED' ? 'Signed' : st === 'SENT' ? 'Sent · unsigned' : 'Draft · unsigned'}</Badge>
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
  const needProject = signed.filter((s) => !s.projectId).length;
  const totals = (xs: SowRow[]) => totalsByCurrency(xs, (s) => s.totalValuePaise, (s) => s.currency);
  const clientLabel = params.clientId ? nameOfClient(params.clientId) : undefined;
  // `view` is a preference, not a filter.
  const filterCount = [params.q, params.clientId, params.status].filter(Boolean).length;
  const clearFilters = () => list.set({ q: '', clientId: '', status: '' });

  const openCreate = () => {
    setDefaults({ clientId: params.clientId || undefined });
    setCreateOpen(true);
  };

  const emptyState = (
    <EmptyState
      illustration={filterCount ? 'inbox' : 'files'}
      title={filterCount ? 'No SOWs match these filters' : 'No statements of work yet'}
      description={filterCount ? undefined : 'Write down the scope and payment milestones, then turn it into a project in one click.'}
      action={
        filterCount ? (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button size="sm" variant="brand" onClick={openCreate}>
            Create a SOW
          </Button>
        )
      }
    />
  );

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="Statements of work"
        eyebrow={clientLabel ? `Statements of work · ${clientLabel}` : 'Statements of work'}
        loading={sows.isLoading}
        aside={
          <>
            {all.length > 0 && <PrivacyChip>Only you see these figures</PrivacyChip>}
            <Button variant="outline" size="sm" disabled={!rows.length || !canSee} onClick={() => exportColumnsCsv('sows', columns, sorted)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New SOW
            </Button>
          </>
        }
        lede={
          sows.error ? undefined : all.length === 0 ? (
            'Scope and payment milestones agreed with clients — turn a signed SOW into a project in one click.'
          ) : (
            <>
              {drafts.length > 0 ? `${drafts.length} ${plural(drafts.length, 'draft hasn’t', 'drafts haven’t')} been sent yet. ` : 'Every draft has been sent. '}
              {needProject > 0
                ? `${needProject} signed ${plural(needProject, 'SOW is', 'SOWs are')} still waiting for a project.`
                : signed.length > 0
                  ? 'Every signed SOW has its project.'
                  : ''}
            </>
          )
        }
      >
        {sows.error ? (
          'Couldn’t load your statements of work.'
        ) : all.length === 0 ? (
          clientLabel ? `No statements of work with ${clientLabel} yet.` : 'No statements of work yet.'
        ) : signed.length === 0 && sent.length === 0 ? (
          <>
            <HeroMark>
              {drafts.length} {plural(drafts.length, 'draft', 'drafts')}
            </HeroMark>{' '}
            worth <PriceTotals totals={totals(drafts)} compact /> — nothing sent for signature yet.
          </>
        ) : (
          <>
            <HeroFigure>
              <PriceTotals totals={totals(signed)} compact />
            </HeroFigure>{' '}
            signed across {signed.length} {plural(signed.length, 'SOW', 'SOWs')}
            {sent.length > 0 ? (
              <>
                {' '}
                — <HeroMark>
                  <PriceTotals totals={totals(sent)} compact />
                </HeroMark>{' '}
                waiting on a signature.
              </>
            ) : (
              '. Nothing is waiting on a signature.'
            )}
          </>
        )}
      </Hero>

      <FilterBar>
        <SearchFilter value={params.q} onChange={(v) => list.set({ q: v })} placeholder="Search title or client" />
        <Combobox
          className="w-full min-w-[180px] sm:w-56"
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
          options={STATUSES.map((s) => ({ value: s, label: SOW_STATUS_LABEL[s] }))}
        />
        <ResetFilters count={filterCount} onReset={clearFilters} />
        <ViewToggle
          className="ml-auto"
          value={view}
          onChange={(v) => list.set({ view: v, page: params.page })}
          options={[
            { value: 'board', label: 'Board', icon: LayoutGrid },
            { value: 'table', label: 'Table', icon: Rows3 },
          ]}
        />
      </FilterBar>

      {view === 'table' ? (
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
          empty={emptyState}
        />
      ) : sows.isLoading ? (
        <div className="grid gap-3.5 md:grid-cols-3">
          {STATUSES.map((s) => (
            <Skeleton key={s} className="h-64 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : sows.error ? (
        <ErrorState error={sows.error} onRetry={() => sows.refetch()} className="rounded-[var(--radius)] border bg-card" />
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card">{emptyState}</div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-3">
          {STATUSES.filter((st) => !params.status || params.status === st).map((st) => {
            const items = sorted.filter((s) => sowStatus(s) === st);
            return (
              <section key={st} aria-label={SOW_STATUS_LABEL[st]} className={cn('flex min-w-0 flex-col rounded-[var(--radius)] border bg-muted/30', params.status && 'md:col-span-3')}>
                <header className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[st] }} />
                  <h2 className="text-sm font-semibold">{SOW_STATUS_LABEL[st]}</h2>
                  <span className="rounded-full bg-card px-1.5 font-figures text-[11px] text-muted-foreground">{items.length}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{items.length ? <PriceTotals totals={totals(items)} compact /> : LANE_HINT[st]}</span>
                </header>
                <div className={cn('flex-1 space-y-2 p-2 pt-0', params.status && 'md:grid md:grid-cols-2 md:gap-2 md:space-y-0 xl:grid-cols-3')}>
                  {items.length === 0 && <p className="rounded-md border border-dashed px-2 py-5 text-center text-xs text-muted-foreground">Nothing here</p>}
                  {items.map((s) => (
                    <SowCard key={s._id} sow={s} clientName={clientName.get(s.clientId)} clientsLoading={clients.isLoading} project={projectCell(s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <SowFormDialog open={createOpen} onOpenChange={setCreateOpen} defaults={defaults} onSaved={(s) => router.push(`/sows/${s._id}`)} />
    </div>
  );
}

function SowCard({ sow: s, clientName, clientsLoading, project }: { sow: SowRow; clientName?: string; clientsLoading: boolean; project: ReactNode }) {
  const st = sowStatus(s);
  const progress = milestoneProgress(s.milestones);
  return (
    <article className="group relative rounded-lg border bg-card p-3 text-xs shadow-sm transition-colors hover:border-foreground/25">
      <Link href={`/sows/${s._id}`} className="block text-[13px] font-semibold leading-snug after:absolute after:inset-0 group-hover:underline">
        {s.title}
      </Link>
      <div className="mt-1">
        <ClientChip clientId={s.clientId} name={clientName} loading={clientsLoading} />
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <Price paise={s.totalValuePaise} currency={s.currency} compact className="font-display text-base font-bold" />
        <Badge variant={STATUS_TONE[st]}>{st === 'SIGNED' ? 'Signed' : 'Unsigned'}</Badge>
      </div>
      {s.milestones.length > 0 ? (
        <div className="mt-2.5 space-y-1">
          <SowMilestoneBar milestones={s.milestones} currency={s.currency} />
          <p className="text-muted-foreground">
            {progress.reached} of {s.milestones.length} {plural(s.milestones.length, 'milestone', 'milestones')} billed
          </p>
        </div>
      ) : (
        <p className="mt-2.5 text-muted-foreground">No milestones yet</p>
      )}
      <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-muted-foreground">
        <span className="min-w-0 truncate">{project}</span>
        <span>{s.signedAt ? `Signed ${formatDate(s.signedAt)}` : s.sentAt ? `Sent ${formatDate(s.sentAt)}` : `Created ${formatDate(s.createdAt)}`}</span>
      </div>
    </article>
  );
}
