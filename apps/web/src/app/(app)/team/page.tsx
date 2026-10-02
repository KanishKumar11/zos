// Team — every staff member (paginated), filters, pending invites and the invite dialog.
'use client';

import { FileText, Mail, RotateCw, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Role, STAFF_ROLES, UserStatus, type ListUsersQuery } from '@agency/shared';

import { formatDate, formatDateTime } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { isOwnerOrAdmin } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, type Column } from '@/components/data/data-table';
import { FilterBar, ResetFilters, SearchFilter, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { useNewParam } from '@/components/layout/quick-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';
import { InviteMemberDialog } from '@/features/team/invite-member-dialog';
import { ROLE_LABEL, type InviteRow, type UserRow } from '@/features/team/team.api';
import { useCancelInvite, usePendingInvites, useResendInvite, useTeamPage } from '@/features/team/team.hooks';

const PAGE_SIZE = 25;
const SORTABLE = ['name', 'lastLoginAt', 'dateOfJoining'] as const;

export default function TeamPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canInvite = isOwnerOrAdmin(role);
  const list = useListState('team', { q: '', role: '', status: '', departmentId: '', sort: 'name:asc' });
  const { params } = list;
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

  const columns: Column<UserRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (u) => (
        <div className="min-w-0">
          <Link href={`/team/${u._id}`} className="font-medium hover:underline">
            {u.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
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
        const dept = u.departmentId ? (deptName.get(u.departmentId) ?? (departments.data ? 'Deleted department' : '…')) : undefined;
        const desig = u.designationId ? (desigName.get(u.designationId) ?? (designations.data ? 'Deleted designation' : '…')) : undefined;
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

  const filtered = list.activeFilterCount > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Everyone on your team, their roles and departments."
        action={
          <>
            <RoleGate allow={[Role.OWNER]}>
              <Link href="/team/internship-letter">
                <Button variant="outline" size="sm">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Internship letter
                </Button>
              </Link>
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
        <ResetFilters count={list.activeFilterCount} onReset={list.reset} />
      </FilterBar>

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
        empty={
          filtered ? (
            <EmptyState
              title="No one matches these filters"
              action={
                <Button variant="outline" size="sm" onClick={list.reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
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
          )
        }
      />
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
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-sm font-medium">
          Pending invites <span className="text-muted-foreground">({rows.length})</span>
        </p>
      </div>
      <ul className="divide-y">
        {rows.map((inv) => (
          <li key={inv._id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <Mail className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
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
