// Team member — a profile sidebar (who they are, how to reach them, onboarding) beside their work:
// projects, and for the OWNER only (gates unchanged) their pay: what's owed, earnings, payments,
// payslips and shared costs. Admins manage access, documents and onboarding; nobody else sees money.
'use client';

import { LogOut, Pencil, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Role, UserStatus } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { FEATURES } from '@/lib/features';
import { formatDate } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Bento, BigNumber, Price, PrivacyChip, Tile, useCanSeePrices } from '@/components/viz';
import { useMemberStats } from '@/features/dashboard/dashboard.hooks';
import { useExpenses } from '@/features/expenses/expenses.hooks';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';
import { MemberPayslips } from '@/features/payroll/member-payslips';
import { PersonPayments } from '@/features/payouts/person-payments';
import { usePayeeBalances } from '@/features/payouts/payouts.hooks';
import { MemberAdminActions } from '@/features/team/member-admin-actions';
import { MemberDocuments } from '@/features/team/member-documents';
import { MemberEmploymentSheet } from '@/features/team/member-employment-sheet';
import { MemberOnboarding } from '@/features/team/member-onboarding';
import { MemberProfileCard, MemberProjects, MemberTasks } from '@/features/team/member-profile';
import { OffboardDialog } from '@/features/team/offboard-dialog';
import { useAdminUpdateUser, useStaffDirectory, useTeamMember } from '@/features/team/team.hooks';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user);
  const member = useTeamMember(id);
  const isOwner = me?.role === Role.OWNER;
  const canManage = me?.role === Role.OWNER || me?.role === Role.ADMIN;
  const [editOpen, setEditOpen] = useState(false);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const confirm = useConfirm();
  const rejoin = useAdminUpdateUser({ successMessage: 'Welcome back — they can sign in again' });

  const departments = useDepartments();
  const designations = useDesignations();
  const staff = useStaffDirectory({ enabled: !!member.data?.reportingManagerId });
  const balances = usePayeeBalances('MEMBER', id, { enabled: isOwner });

  const lookups = useMemo(
    () => ({
      dept: new Map((departments.data ?? []).map((d) => [d._id, d.name])),
      desig: new Map((designations.data ?? []).map((d) => [d._id, d.title])),
      people: new Map((staff.data ?? []).map((p) => [p._id, p.name])),
    }),
    [departments.data, designations.data, staff.data],
  );

  if (member.isLoading) return <PageSkeleton />;
  if (!member.data) {
    const status = member.error instanceof ApiRequestError ? member.error.status : 0;
    return status === 404 || status === 403 ? (
      <EmptyState
        illustration="people"
        title={status === 403 ? "You can't open this person's profile" : 'This person no longer exists'}
        description="They may have been deleted, or the link is wrong."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/team">Back to team</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState title="Couldn't open this person" error={member.error} onRetry={() => member.refetch()} />
    );
  }

  const u = member.data;
  const isSelf = me?.id === u._id;
  const exited = u.status === UserStatus.EXITED;
  const deptLabel = u.departmentId ? (lookups.dept.get(u.departmentId) ?? (departments.data ? 'Deleted department' : '…')) : undefined;
  const desigLabel = u.designationId ? (lookups.desig.get(u.designationId) ?? (designations.data ? 'Deleted designation' : '…')) : undefined;
  const managerLabel = u.reportingManagerId ? (lookups.people.get(u.reportingManagerId) ?? (staff.data ? 'Former team member' : '…')) : undefined;

  const pay = (projectId?: string, amountPaise?: number) => openLogPayment({ payeeType: 'MEMBER', userId: u._id, projectId, amountPaise });

  const actions = (
    <>
      {isOwner && (
        <Button size="sm" variant="brand" onClick={() => pay()}>
          Log payment
        </Button>
      )}
      {canManage && (
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
      )}
      {isOwner && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/team/${u._id}/compensation`}>Compensation</Link>
        </Button>
      )}
      {canManage && !isSelf && u.role !== Role.OWNER && !exited && u.status !== UserStatus.INVITED && (
        <Button size="sm" variant="outline" onClick={() => setOffboardOpen(true)}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> {u.role === Role.INTERN ? 'Complete internship' : 'Offboard'}
        </Button>
      )}
      {canManage && exited && (
        <Button
          size="sm"
          variant="outline"
          disabled={rejoin.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: `Bring ${u.name} back?`,
              description: 'They become active again and can sign in. Their exit date is cleared.',
              confirmText: 'Bring back',
            });
            if (ok) rejoin.mutate({ id: u._id, body: { status: UserStatus.ACTIVE, dateOfExit: null, exitReason: null } });
          }}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rejoined
        </Button>
      )}
    </>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <MemberProfileCard
        user={u}
        dept={deptLabel}
        desig={desigLabel}
        manager={u.reportingManagerId && managerLabel ? { id: u.reportingManagerId, name: managerLabel } : undefined}
        actions={actions}
        canSeeBirthday={canManage || isSelf}
      />

      <div className="min-w-0 space-y-6">
        {isOwner && <OwnerPaySummary userId={u._id} name={u.name} onPay={() => pay()} />}

        <Bento>
          <MemberProjects userId={u._id} viewerRole={me?.role} balances={isOwner ? balances.data : undefined} onPay={isOwner ? pay : undefined} />
          {FEATURES.tasks && <MemberTasks userId={u._id} viewerRole={me?.role} />}
        </Bento>

        {isOwner && (
          <>
            <PersonPayments userId={id} />
            <MemberPayslips userId={id} />
            <SharedCosts userId={id} />
          </>
        )}

        {canManage && <MemberAdminActions user={u} viewerId={me?.id} viewerRole={me?.role} />}
        {(canManage || isSelf) && <MemberDocuments user={u} canManage={canManage} />}
        {(canManage || isSelf) && (
          <div id="onboarding" className="scroll-mt-20">
            <MemberOnboarding user={u} canManage={canManage} isSelf={isSelf} />
          </div>
        )}
      </div>

      {canManage && <MemberEmploymentSheet user={u} open={editOpen} onOpenChange={setEditOpen} />}
      {canManage && offboardOpen && <OffboardDialog user={u} viewerRole={me?.role} open={offboardOpen} onOpenChange={setOffboardOpen} />}
    </div>
  );
}

/** OWNER only: what's owed, what's been paid lately, and the 12-month earnings bars. */
function OwnerPaySummary({ userId, name, onPay }: { userId: string; name: string; onPay: () => void }) {
  const stats = useMemberStats(userId, true);
  const balances = usePayeeBalances('MEMBER', userId);
  const canSee = useCanSeePrices();
  const owed = (balances.data ?? []).reduce((s, b) => s + b.pendingPaise, 0);
  const paidAll = (balances.data ?? []).reduce((s, b) => s + b.paidPaise, 0);
  const months = stats.data?.earnings ?? [];
  const last12 = months.reduce((s, e) => s + e.netPaise, 0);
  const data = months.map((e) => ({ month: MONTHS[Number(e.month.slice(5, 7)) - 1] ?? e.month, Net: Math.round(e.netPaise / 100) }));

  return (
    <Bento>
      <Tile span={4} tone="ink" title="Still owed">
        {balances.isLoading ? (
          <Skeleton className="h-10 w-28 bg-background/20" />
        ) : (
          <BigNumber caption={owed > 0 ? 'Across their projects' : `Nothing owed to ${name.split(' ')[0]}`}>
            <Price paise={owed} />
          </BigNumber>
        )}
        {owed > 0 && (
          <button type="button" onClick={onPay} className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-brand/90">
            Pay now
          </button>
        )}
      </Tile>
      <Tile span={8} title="Earnings, last 12 months" action={<PrivacyChip>Only you see these figures</PrivacyChip>}>
        <div className="mb-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Last 12 months </span>
            <Price paise={last12} className="font-semibold" />
          </span>
          <span>
            <span className="text-muted-foreground">Paid on projects, all time </span>
            <Price paise={paidAll} className="font-semibold" />
          </span>
        </div>
        {stats.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : months.every((m) => m.netPaise === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No payments in the last 12 months.</p>
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={14}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  content={<ChartTooltip formatValue={(v) => (canSee ? `₹${v.toLocaleString('en-IN')}` : '')} />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                />
                <Bar dataKey="Net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Tile>
    </Bento>
  );
}

/** OWNER only: shared costs (e.g. tool subscriptions) recovered from this person's pay. */
function SharedCosts({ userId }: { userId: string }) {
  const contributions = useExpenses({ contributorId: userId, limit: 50 }, true);
  const items = (contributions.data?.items ?? [])
    .map((e) => ({ e, mine: e.contributions.find((c) => c.userId === userId) }))
    .filter((x) => !!x.mine);
  if (!contributions.isLoading && !contributions.isError && items.length === 0) return null;
  return (
    <Bento>
      <Tile span={12} title="Shared costs recovered from their pay">
        {contributions.isLoading ? (
          <Skeleton className="h-16" />
        ) : contributions.isError ? (
          <ErrorState error={contributions.error} onRetry={() => contributions.refetch()} className="py-4" />
        ) : (
          <ul className="divide-y">
            {items.map(({ e, mine }) => (
              <li key={e._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.date)}
                    {mine!.note && ` · ${mine!.note}`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-destructive">
                  −<Price paise={mine!.amountPaise} currency={e.currency} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </Bento>
  );
}
