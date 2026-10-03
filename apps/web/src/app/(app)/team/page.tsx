// Team — every staff member (paginated) as a people grid (default) or the table, filters, pending
// invites and the invite dialog. No money anywhere on this page.
'use client';

import { FileText, LayoutGrid, RotateCw, Rows3, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { Role, STAFF_ROLES, UserStatus, type ListUsersQuery } from '@agency/shared';

import { formatDate, formatDateTime } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { isOwnerOrAdmin } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { ViewToggle } from '@/components/data/view-toggle';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { Avatar, Hero, HeroFigure, HeroMark } from '@/components/viz';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';
import { InviteMemberDialog } from '@/features/team/invite-member-dialog';
import { PeopleGrid } from '@/features/team/people-grid';
import { isCurrentStaff, onboardingProgress } from '@/features/team/people';
import { ROLE_LABEL, type InviteRow, type UserRow } from '@/features/team/team.api';
import { useCancelInvite, usePendingInvites, useResendInvite, useStaffDirectory, useTeamPage } from '@/features/team/team.hooks';

const PAGE_SIZE = 25;
const SORTABLE = ['name', 'lastLoginAt', 'dateOfJoining'] as const;

export default function TeamPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canInvite = isOwnerOrAdmin(role);
  const list = useListState('team', { q: '', role: '', status: '', departmentId: '', sort: 'name:asc', view: 'grid' });
  const { params } = list;
  const view = params.view === 'table' ? 'table' : 'grid';
  const [inviteOpen, setInviteOpen] = useState(false);
  useNewParam(() => {
    if (canInvite) setInviteOpen(true);
  });

  const sortBy = SORTABLE.includes(list.sort?.by as (typeof SORTABLE)[number]) ? list.sort!.by : 'name';
  const query: ListUsersQuery = {
    page: list.page,
    pageSize: PAGE_SIZE,
    q: params.q || undefined,
    role: (params.role || undefined) as Role | undefined,
    status: (params.status || undefined) as UserStatus | undefined,
    departmentId: params.departmentId || undefined,
    sort: `${sortBy}:${list.sort?.dir ?? 'asc'}` as ListUsersQuery['sort'],
  };
  const members = useTeamPage(query);
  const departments = useDepartments();
  const designations = useDesignations();

  const deptName = useMemo(() => new Map((departments.data ?? []).map((d) => [d._id, d.name])), [departments.data]);
  const desigName = useMemo(() => new Map((designations.data ?? []).map((d) => [d._id, d.title])), [designations.data]);
  const deptLabel = (u: UserRow) =>
    u.departmentId ? (deptName.get(u.departmentId) ?? (departments.data ? 'Deleted department' : '…')) : undefined;
  const desigLabel = (u: UserRow) =>
    u.designationId ? (desigName.get(u.designationId) ?? (designations.data ? 'Deleted designation' : '…')) : undefined;

  const columns: Column<UserRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar id={u._id} name={u.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/team/${u._id}`} className="font-medium hover:underline">
              {u.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (u) => <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>,
    },
    {
      id: 'department',
      header: 'Department',
      hideBelow: 'md',
      cell: (u) => {
        const dept = deptLabel(u);
        const desig = desigLabel(u);
        if (!dept && !desig) return <span className="text-muted-foreground">—</span>;
        return (
          <div>
            <p>{dept ?? <span className="text-muted-foreground">No department</span>}</p>
            {desig && <p className="text-xs text-muted-foreground">{desig}</p>}
          </div>
        );
      },
    },
    { id: 'status', header: 'Status', cell: (u) => <StatusBadge status={u.status} /> },
    {
      id: 'dateOfJoining',
      header: 'Joined',
      sortable: true,
      hideBelow: 'lg',
      cell: (u) => (u.dateOfJoining ? formatDate(u.dateOfJoining) : <span className="text-muted-foreground">—</span>),
    },
    {
      id: 'lastLoginAt',
      header: 'Last sign-in',
      sortable: true,
      hideBelow: 'lg',
      cell: (u) =>
        u.lastLoginAt ? (
          <span className="whitespace-nowrap">{formatDateTime(u.lastLoginAt)}</span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
  ];

  // `view` lives in the list state so it's remembered, but it isn't a filter.
  const filterCount = list.activeFilterCount - (view === 'table' ? 1 : 0);
  const filtered = filterCount > 0;
  const resetFilters = () => list.set({ q: '', role: '', status: '', departmentId: '', sort: 'name:asc', view: params.view });

  const empty = filtered ? (
    <EmptyState
      title="No one matches these filters"
      action={
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      illustration="people"
      title="No team members yet"
      description="Invite people so they can sign in, track work and get paid."
      action={
        canInvite ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Invite your first teammate
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-6">
      <TeamHero
        canInvite={canInvite}
        actions={
          <>
            <RoleGate allow={[Role.OWNER]}>
              <Button variant="outline" size="sm" asChild>
                <Link href="/team/internship-letter">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Internship letter
                </Link>
              </Button>
            </RoleGate>
            {canInvite && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite member
              </Button>
            )}
          </>
        }
      />

      {canInvite && <PendingInvites />}

      <FilterBar>
        <SearchFilter value={params.q} onChange={(q) => list.set({ q })} placeholder="Search name or email" />
        <SelectFilter
          value={params.role}
          onChange={(r) => list.set({ role: r })}
          allLabel="All roles"
          options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        <SelectFilter
          value={params.status}
          onChange={(status) => list.set({ status })}
          allLabel="All statuses"
          options={Object.values(UserStatus).map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <SelectFilter
          value={params.departmentId}
          onChange={(departmentId) => list.set({ departmentId })}
          allLabel="All departments"
          options={(departments.data ?? []).map((d) => ({ value: d._id, label: d.name }))}
        />
        {view === 'grid' && (
          <SelectFilter
            value={params.sort === 'name:asc' ? '' : params.sort}
            onChange={(sort) => list.set({ sort: sort || 'name:asc' })}
            allLabel="Sort: name A–Z"
            label="Sort people"
            options={[
              { value: 'name:desc', label: 'Sort: name Z–A' },
              { value: 'dateOfJoining:asc', label: 'Sort: longest with us' },
              { value: 'dateOfJoining:desc', label: 'Sort: newest first' },
              { value: 'lastLoginAt:desc', label: 'Sort: recently signed in' },
            ]}
          />
        )}
        <ResetFilters count={filterCount} onReset={resetFilters} />
        <ViewToggle
          className="sm:ml-auto"
          value={view}
          onChange={(v) => list.set({ view: v, page: String(list.page) })}
          options={[
            { value: 'grid', label: 'Grid', icon: LayoutGrid },
            { value: 'table', label: 'Table', icon: Rows3 },
          ]}
        />
      </FilterBar>

      {view === 'grid' ? (
        <PeopleGrid
          people={members.data?.items}
          loading={members.isLoading}
          error={members.error}
          onRetry={() => members.refetch()}
          empty={empty}
          deptLabel={deptLabel}
          desigLabel={desigLabel}
        />
      ) : (
      <DataTable
        columns={columns}
        rows={members.data?.items}
        rowKey={(u) => u._id}
        loading={members.isLoading}
        error={members.error}
        onRetry={() => members.refetch()}
        sort={{ by: sortBy, dir: list.sort?.dir ?? 'asc' }}
        onSortChange={(s) => list.set({ sort: s ? `${s.by}:${s.dir}` : 'name:asc' })}
        rowHref={(u) => `/team/${u._id}`}
        rowClassName={(u) => (u.status === UserStatus.SUSPENDED || u.status === UserStatus.EXITED ? 'opacity-60' : undefined)}
        empty={empty}
      />
      )}
      {members.data && (
        <Pagination
          page={list.page}
          totalPages={members.data.meta.totalPages}
          total={members.data.meta.total}
          pageSize={PAGE_SIZE}
          onPage={list.setPage}
        />
      )}

      {canInvite && <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
    </div>
  );
}

/** Narrative hero from the whole directory (not the filtered page): headcount, departments, onboarding. */
function TeamHero({ canInvite, actions }: { canInvite: boolean; actions: ReactNode }) {
  const staff = useStaffDirectory();
  const invites = usePendingInvites(canInvite);
  const current = (staff.data ?? []).filter(isCurrentStaff);
  const departments = new Set(current.map((u) => u.departmentId).filter(Boolean)).size;
  const onboarding = current.filter((u) => {
    const p = onboardingProgress(u);
    return p && p.done < p.total;
  }).length;
  const waiting = invites.data?.length ?? 0;
  const ledeParts = [
    onboarding ? `${onboarding} ${onboarding === 1 ? 'person is' : 'people are'} still working through onboarding.` : 'Everyone with a checklist has finished onboarding.',
    canInvite && waiting ? `${waiting} invite${waiting === 1 ? '' : 's'} waiting to be accepted.` : '',
  ];
  return (
    <Hero
      pageTitle="Team"
      eyebrow="People"
      aside={actions}
      loading={staff.isLoading}
      lede={staff.isError ? undefined : ledeParts.filter(Boolean).join(' ')}
    >
      {staff.isError ? (
        <>Everyone on your team, their roles and departments.</>
      ) : current.length === 0 ? (
        <>No one on the team yet. Invite your first teammate.</>
      ) : (
        <>
          <HeroFigure>
            {current.length} {current.length === 1 ? 'person' : 'people'}
          </HeroFigure>{' '}
          on the team
          {departments > 0 && (
            <>
              {' '}across <HeroMark>{departments} department{departments === 1 ? '' : 's'}</HeroMark>
            </>
          )}
          .
        </>
      )}
    </Hero>
  );
}

function PendingInvites() {
  const invites = usePendingInvites();
  const resend = useResendInvite();
  const cancel = useCancelInvite();
  const confirm = useConfirm();
  const rows = invites.data ?? [];
  if (invites.isLoading || invites.isError || rows.length === 0) {
    return invites.isError ? (
      <p className="text-sm text-destructive">
        Couldn&apos;t load pending invites.{' '}
        <button type="button" className="underline" onClick={() => invites.refetch()}>
          Try again
        </button>
      </p>
    ) : null;
  }

  const onCancel = async (inv: InviteRow) => {
    const ok = await confirm({
      title: `Cancel the invite for ${inv.name}?`,
      description: `The link sent to ${inv.email} stops working. You can invite them again later.`,
      confirmText: 'Cancel invite',
      cancelText: 'Keep it',
      destructive: true,
    });
    if (ok) cancel.mutate(inv._id);
  };

  return (
    <section className="rounded-[var(--radius)] border border-brand/20 bg-brand-wash/60">
      <div className="flex items-center justify-between border-b border-brand/15 px-4 py-2.5">
        <p className="text-sm font-medium">
          Pending invites <span className="text-muted-foreground">({rows.length})</span>
        </p>
      </div>
      <ul className="divide-y divide-brand/10">
        {rows.map((inv) => (
          <li key={inv._id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <span className="hidden sm:block">
              <Avatar id={inv.email} name={inv.name} size="sm" className="opacity-70" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {inv.name} <span className="font-normal text-muted-foreground">· {inv.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[inv.role] ?? inv.role} · sent {formatDate(inv.lastSentAt)}
                {inv.sendCount > 1 ? ` (${inv.sendCount} times)` : ''} ·{' '}
                {inv.expired ? 'link expired' : `link works until ${formatDateTime(inv.expiresAt)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inv.expired && <Badge variant="warning">Expired</Badge>}
              <Button
                size="sm"
                variant="outline"
                disabled={resend.isPending && resend.variables === inv._id}
                onClick={() => resend.mutate(inv._id)}
              >
                <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                {resend.isPending && resend.variables === inv._id ? 'Sending…' : 'Resend'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void onCancel(inv)} aria-label={`Cancel invite for ${inv.name}`}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
