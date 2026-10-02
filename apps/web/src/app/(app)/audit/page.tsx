// Audit log (OWNER + ADMIN) — who did what, when, with a before/after view of each change.
'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AUDIT_ACTION_LABEL, AuditAction, Role } from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { DateRangeFilter, FilterBar, ResetFilters, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
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
  const list = useListState('audit', { action: '', actorId: '', entity: '', range: '', from: '', to: '' });
  const { params } = list;
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
          <Link href={`/team/${r.actorId}`} className="whitespace-nowrap font-medium hover:underline">
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

  const filtered = list.activeFilterCount > 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Who changed what, and when. Entries can’t be edited or deleted." />

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
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={entries.data?.items}
        rowKey={(r) => r._id}
        loading={entries.isLoading}
        error={entries.error}
        onRetry={() => entries.refetch()}
        onRowClick={(r) => hasDiff(r) && setExpanded((cur) => (cur === r._id ? undefined : r._id))}
        empty={
          filtered ? (
            <EmptyState
              title="Nothing matches these filters"
              action={
                <Button variant="outline" size="sm" onClick={list.reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={ScrollText} title="No activity yet" description="Changes to money, people and payroll show up here." />
          )
        }
      />
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
