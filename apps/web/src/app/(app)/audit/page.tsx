// Audit log (OWNER + ADMIN) — who did what, when, as a day-grouped timeline (default) or the table,
// with a before/after view of each change. The API strips money fields for non-owners.
'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, LayoutList, Rows3 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { AUDIT_ACTION_LABEL, AuditAction, Role } from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { toLocalDateInput } from '@/lib/form';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { DateRangeFilter, FilterBar, ResetFilters, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ActivityTimeline, Avatar, Hero, HeroFigure, type TimelineItem } from '@/components/viz';
import { useStaffDirectory } from '@/features/team/team.hooks';

interface AuditRow {
  _id: string;
  actorId?: string;
  actorName?: string;
  entity: string;
  entityId?: string;
  entityName?: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  createdAt: string;
}

const PAGE_SIZE = 50;

const ENTITY_LABEL: Record<string, string> = {
  project: 'Project',
  client: 'Client',
  invoice: 'Invoice',
  payout: 'Payment',
  user: 'Team member',
  invite: 'Invite',
  payroll: 'Payroll run',
  payrollrun: 'Payroll run',
  expense: 'Expense',
  income: 'Other income',
  freelancer: 'Freelancer',
  contract: 'Contract',
  sow: 'SOW',
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  client: (id) => `/clients/${id}`,
  invoice: (id) => `/invoices/${id}`,
  payout: () => '/payments',
  user: (id) => `/team/${id}`,
  invite: () => '/team',
  payroll: (id) => `/payroll/runs/${id}`,
  payrollrun: (id) => `/payroll/runs/${id}`,
  expense: () => '/expenses',
  income: () => '/income',
  freelancer: (id) => `/freelancers/${id}`,
  contract: (id) => `/contracts/${id}`,
  sow: (id) => `/sows/${id}`,
};

const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const actionLabel = (a: AuditAction) => AUDIT_ACTION_LABEL[a] ?? humanize(a);
const entityKey = (e: string) => e.toLowerCase();
const entityLabel = (e: string) => ENTITY_LABEL[entityKey(e)] ?? humanize(e);

const summaryOf = (r: AuditRow): string | undefined => {
  const s = (r.after as { summary?: unknown } | undefined)?.summary;
  return typeof s === 'string' ? s : undefined;
};

export default function AuditPage() {
  return (
    <RoleGate allow={[Role.OWNER, Role.ADMIN]} fallback={<EmptyState title="Only the owner and admins can see the audit log" />}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const list = useListState('audit', { action: '', actorId: '', entity: '', range: '', from: '', to: '', view: 'timeline' });
  const { params } = list;
  const view = params.view === 'table' ? 'table' : 'timeline';
  const staff = useStaffDirectory();
  const [expanded, setExpanded] = useState<string>();

  const query = {
    page: list.page,
    limit: PAGE_SIZE,
    action: params.action || undefined,
    actorId: params.actorId || undefined,
    entity: params.entity || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const entries = useQuery({
    queryKey: ['audit', query],
    queryFn: () => unwrapPaginated<AuditRow>(api.get('/audit', { params: query })),
    placeholderData: (prev) => prev,
  });
  const entities = useQuery({
    queryKey: ['audit', 'entities'],
    queryFn: () => unwrap<string[]>(api.get('/audit/entities')),
    staleTime: 5 * 60_000,
  });

  const actionOptions = useMemo(
    () =>
      Object.values(AuditAction)
        .map((a) => ({ value: a, label: actionLabel(a) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );
  const entityOptions = useMemo(
    () => (entities.data ?? []).map((e) => ({ value: e, label: entityLabel(e) })),
    [entities.data],
  );

  const columns: Column<AuditRow>[] = [
    {
      id: 'when',
      header: 'When',
      className: 'align-top w-[170px]',
      cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</span>,
    },
    {
      id: 'who',
      header: 'Who',
      className: 'align-top',
      cell: (r) =>
        r.actorId ? (
          <Link href={`/team/${r.actorId}`} className="inline-flex items-center gap-2 whitespace-nowrap font-medium hover:underline">
            <Avatar id={r.actorId} name={r.actorName ?? 'Deleted user'} size="xs" />
            {r.actorName ?? 'Deleted user'}
          </Link>
        ) : (
          <span className="text-muted-foreground">System</span>
        ),
    },
    {
      id: 'what',
      header: 'What',
      className: 'align-top',
      cell: (r) => {
        const open = expanded === r._id;
        const summary = summaryOf(r);
        const hasDetail = hasDiff(r);
        return (
          <div className="min-w-0">
            <div className="flex items-start gap-1.5">
              {hasDetail ? (
                open ? (
                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{actionLabel(r.action)}</p>
                {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
              </div>
            </div>
            {open && hasDetail && <DiffTable before={r.before} after={r.after} />}
          </div>
        );
      },
    },
    {
      id: 'entity',
      header: 'Record',
      className: 'align-top',
      hideBelow: 'md',
      cell: (r) => {
        const key = entityKey(r.entity);
        const href = r.entityId && ENTITY_HREF[key] ? ENTITY_HREF[key](r.entityId) : undefined;
        const label = r.entityName ? `${entityLabel(r.entity)} · ${r.entityName}` : entityLabel(r.entity);
        return href ? (
          <Link href={href} className="whitespace-nowrap text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <span className="whitespace-nowrap text-muted-foreground">{label}</span>
        );
      },
    },
  ];

  // `view` is remembered with the filters but isn't one.
  const filterCount = list.activeFilterCount - (view === 'table' ? 1 : 0);
  const filtered = filterCount > 0;
  const resetFilters = () => list.set({ action: '', actorId: '', entity: '', range: '', from: '', to: '', view: params.view });
  const total = entries.data?.meta.total ?? 0;

  const empty = filtered ? (
    <EmptyState
      title="Nothing matches these filters"
      action={
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState illustration="files" title="No activity yet" description="Changes to money, people and payroll show up here." />
  );

  return (
    <div className="space-y-6">
      <Hero pageTitle="Audit log" eyebrow="Admin" loading={entries.isLoading} lede="Entries can’t be edited or deleted.">
        {entries.isError ? (
          <>Who changed what, and when.</>
        ) : total === 0 ? (
          filtered ? <>No changes match these filters.</> : <>Nothing has been changed yet.</>
        ) : (
          <>
            <HeroFigure>
              {total.toLocaleString('en-IN')} {total === 1 ? 'change' : 'changes'}
            </HeroFigure>{' '}
            {filtered ? 'match these filters.' : 'recorded so far.'}
          </>
        )}
      </Hero>

      <FilterBar>
        <SelectFilter value={params.action} onChange={(action) => list.set({ action })} allLabel="Any action" options={actionOptions} />
        <div className="w-full sm:w-56">
          <Combobox
            options={(staff.data ?? []).map((u) => ({ value: u._id, label: u.name, description: u.email }))}
            value={params.actorId || undefined}
            onChange={(v) => list.set({ actorId: v ?? '' })}
            allowClear
            loading={staff.isLoading}
            placeholder="Anyone"
            searchPlaceholder="Search people…"
          />
        </div>
        <SelectFilter value={params.entity} onChange={(entity) => list.set({ entity })} allLabel="Any record type" options={entityOptions} />
        <DateRangeFilter preset={params.range} from={params.from} to={params.to} onChange={(r) => list.set(r)} />
        <ResetFilters count={filterCount} onReset={resetFilters} />
        <ViewToggle
          className="sm:ml-auto"
          value={view}
          onChange={(v) => list.set({ view: v, page: String(list.page) })}
          options={[
            { value: 'timeline', label: 'Timeline', icon: LayoutList },
            { value: 'table', label: 'Table', icon: Rows3 },
          ]}
        />
      </FilterBar>

      {view === 'timeline' ? (
        <AuditTimeline
          rows={entries.data?.items}
          loading={entries.isLoading}
          error={entries.error}
          onRetry={() => entries.refetch()}
          empty={empty}
          expanded={expanded}
          onToggle={(id) => setExpanded((cur) => (cur === id ? undefined : id))}
        />
      ) : (
      <DataTable
        columns={columns}
        rows={entries.data?.items}
        rowKey={(r) => r._id}
        loading={entries.isLoading}
        error={entries.error}
        onRetry={() => entries.refetch()}
        onRowClick={(r) => hasDiff(r) && setExpanded((cur) => (cur === r._id ? undefined : r._id))}
        empty={empty}
      />
      )}
      {entries.data && (
        <Pagination
          page={list.page}
          totalPages={entries.data.meta.totalPages}
          total={entries.data.meta.total}
          pageSize={PAGE_SIZE}
          onPage={list.setPage}
        />
      )}
    </div>
  );
}

function dayLabel(key: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === toLocalDateInput(today)) return 'Today';
  if (key === toLocalDateInput(yesterday)) return 'Yesterday';
  const d = new Date(`${key}T00:00:00`);
  return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

/** Day-grouped story of changes: actor avatar, action, summary and a link to the record. */
function AuditTimeline({
  rows,
  loading,
  error,
  onRetry,
  empty,
  expanded,
  onToggle,
}: {
  rows: AuditRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: ReactNode;
  expanded?: string;
  onToggle: (id: string) => void;
}) {
  const days = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    for (const r of rows ?? []) {
      const key = toLocalDateInput(new Date(r.createdAt));
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-3 rounded-[var(--radius)] border bg-card p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (error && !rows) return <ErrorState error={error} onRetry={onRetry} className="rounded-[var(--radius)] border bg-card" />;
  if (!rows || rows.length === 0) return <div className="rounded-[var(--radius)] border bg-card">{empty}</div>;

  return (
    <div className="space-y-4">
      {days.map(([key, items]) => {
        const timeline: TimelineItem[] = items.map((r) => {
          const ek = entityKey(r.entity);
          const href = r.entityId && ENTITY_HREF[ek] ? ENTITY_HREF[ek](r.entityId) : undefined;
          const record = r.entityName ? `${entityLabel(r.entity)} · ${r.entityName}` : entityLabel(r.entity);
          const summary = summaryOf(r);
          const detail = hasDiff(r);
          const open = expanded === r._id;
          const actor = r.actorId ? (r.actorName ?? 'Deleted user') : 'System';
          return {
            key: r._id,
            date: r.createdAt,
            color: r.actorId ? identityColor(r.actorId) : 'hsl(var(--muted-foreground))',
            title: (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {r.actorId ? (
                  <Link href={`/team/${r.actorId}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Avatar id={r.actorId} name={actor} size="xs" />
                    {actor}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">System</span>
                )}
                <span className="font-normal text-muted-foreground">·</span>
                <span>{actionLabel(r.action)}</span>
              </span>
            ),
            meta: (
              <span className="flex flex-wrap items-center gap-x-2">
                <span>{new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                <span>·</span>
                {href ? (
                  <Link href={href} className="text-brand-ink hover:underline">
                    {record}
                  </Link>
                ) : (
                  <span>{record}</span>
                )}
              </span>
            ),
            body:
              summary || detail ? (
                <div>
                  {summary && <p className="text-muted-foreground">{summary}</p>}
                  {detail && (
                    <button
                      type="button"
                      onClick={() => onToggle(r._id)}
                      aria-expanded={open}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {open ? 'Hide changes' : 'Show changes'}
                    </button>
                  )}
                  {open && detail && <DiffTable before={r.before} after={r.after} />}
                </div>
              ) : undefined,
          };
        });
        return (
          <section key={key} className="animate-rise rounded-[var(--radius)] border bg-card p-4 sm:p-5">
            <h2 className="mb-4 flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-bold">{dayLabel(key)}</span>
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? 'change' : 'changes'}
              </span>
            </h2>
            <ActivityTimeline items={timeline} />
          </section>
        );
      })}
    </div>
  );
}

const plain = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v === undefined ? {} : { value: v };

function hasDiff(r: AuditRow): boolean {
  const keys = new Set([...Object.keys(plain(r.before)), ...Object.keys(plain(r.after))]);
  keys.delete('summary');
  return keys.size > 0;
}

const show = (v: unknown): string => {
  if (v === undefined) return '—';
  if (v === null || v === '') return 'empty';
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDateTime(v) : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

/** Key-by-key before / after table. Changed values are highlighted. */
function DiffTable({ before, after }: { before: unknown; after: unknown }) {
  const b = plain(before);
  const a = plain(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== 'summary');
  const showBefore = Object.keys(b).length > 0;
  return (
    <div className="mt-2 overflow-x-auto rounded-md border bg-muted/20" onClick={(e) => e.stopPropagation()}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Field</th>
            {showBefore && <th className="px-2 py-1.5 font-medium">Before</th>}
            <th className="px-2 py-1.5 font-medium">{showBefore ? 'After' : 'Value'}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {keys.map((k) => {
            const changed = JSON.stringify(b[k]) !== JSON.stringify(a[k]);
            return (
              <tr key={k} className={changed && showBefore ? 'bg-amber-500/5' : undefined}>
                <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{k}</td>
                {showBefore && <td className="max-w-[240px] break-words px-2 py-1">{show(b[k])}</td>}
                <td className="max-w-[240px] break-words px-2 py-1">{show(a[k])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
