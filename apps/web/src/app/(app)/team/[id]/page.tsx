// Team member detail — profile header, details, projects & work, access & role, documents, onboarding
// and (OWNER only, gates unchanged) earnings, projects & payments, payslips and shared-cost contributions.
'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Role } from '@agency/shared';

import { ApiRequestError } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Bento, Price, Tile, useCanSeePrices } from '@/components/viz';
import { useMemberStats } from '@/features/dashboard/dashboard.hooks';
import { useExpenses } from '@/features/expenses/expenses.hooks';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';
import { MemberPayslips } from '@/features/payroll/member-payslips';
import { useUserPayslips } from '@/features/payroll/payroll.hooks';
import { PersonPayments } from '@/features/payouts/person-payments';
import { usePayeeBalances } from '@/features/payouts/payouts.hooks';
import { MemberAdminActions } from '@/features/team/member-admin-actions';
import { MemberDocuments } from '@/features/team/member-documents';
import { MemberEmploymentSheet } from '@/features/team/member-employment-sheet';
import { MemberOnboarding } from '@/features/team/member-onboarding';
import { MemberProfileHeader, MemberWork } from '@/features/team/member-profile';
import { useStaffDirectory, useTeamMember } from '@/features/team/team.hooks';

export default function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user);
  const member = useTeamMember(id);
  const isOwnerViewer = me?.role === Role.OWNER;
  const canManage = me?.role === Role.OWNER || me?.role === Role.ADMIN;
  const [editOpen, setEditOpen] = useState(false);

  const departments = useDepartments();
  const designations = useDesignations();
  const staff = useStaffDirectory({ enabled: !!member.data?.reportingManagerId });
  const stats = useMemberStats(id, isOwnerViewer);
  const payslips = useUserPayslips(id, isOwnerViewer);
  const contributions = useExpenses({ contributorId: id, limit: 50 }, isOwnerViewer);
  const personBalances = usePayeeBalances('MEMBER', id, { enabled: isOwnerViewer });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const canSeePrices = useCanSeePrices();

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
    const notFound = member.error instanceof ApiRequestError && (member.error.status === 404 || member.error.status === 403);
    return notFound ? (
      <EmptyState
        title={member.error instanceof ApiRequestError && member.error.status === 403 ? "You can't open this person's profile" : 'This person no longer exists'}
        description="They may have been deleted, or the link is wrong."
        action={
          <Link href="/team">
            <Button variant="outline" size="sm">Back to team</Button>
          </Link>
        }
      />
    ) : (
      <ErrorState title="Couldn't open this person" error={member.error} onRetry={() => member.refetch()} />
    );
  }
  const u = member.data;
  const isSelf = me?.id === u._id;

  const deptLabel = u.departmentId ? (lookups.dept.get(u.departmentId) ?? (departments.data ? 'Deleted department' : '…')) : undefined;
  const desigLabel = u.designationId ? (lookups.desig.get(u.designationId) ?? (designations.data ? 'Deleted designation' : '…')) : undefined;
  const managerLabel = u.reportingManagerId
    ? (lookups.people.get(u.reportingManagerId) ?? (staff.data ? 'Former team member' : '…'))
    : undefined;

  return (
    <div className="space-y-6">
      <MemberProfileHeader
        user={u}
        dept={deptLabel}
        desig={desigLabel}
        manager={u.reportingManagerId && managerLabel ? { id: u.reportingManagerId, name: managerLabel } : undefined}
        actions={
          <>
            {me?.role === Role.OWNER && (
              <>
                <Button size="sm" variant="brand" onClick={() => openLogPayment({ payeeType: 'MEMBER', userId: u._id })}>
                  Log payment
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/team/${u._id}/compensation`}>Compensation</Link>
                </Button>
              </>
            )}
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit details
              </Button>
            )}
          </>
        }
      />

      <Bento>
        <Tile span={12} title="Details">
          <div className="grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
            <Field label="Department" value={deptLabel} />
            <Field label="Designation" value={desigLabel} />
            <Field
              label="Reports to"
              value={
                u.reportingManagerId && managerLabel ? (
                  <Link href={`/team/${u.reportingManagerId}`} className="hover:underline">
                    {managerLabel}
                  </Link>
                ) : undefined
              }
            />
            <Field label="Phone" value={u.phone} />
            <Field label="Joined" value={u.dateOfJoining ? formatDate(u.dateOfJoining) : undefined} />
            {u.dateOfBirth !== undefined && (
              <Field label="Birthday" value={u.dateOfBirth ? formatDate(u.dateOfBirth, { day: 'numeric', month: 'short' }) : undefined} />
            )}
            <Field label="Last sign-in" value={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'} />
          </div>
        </Tile>
        <MemberWork userId={u._id} viewerRole={me?.role} />
      </Bento>

      {canManage && <MemberAdminActions user={u} viewerId={me?.id} viewerRole={me?.role} />}

      {/* Earnings & Projects — OWNER only */}
      {me?.role === Role.OWNER && (
        <>
          {(() => {
            const lastSlip = payslips.data?.[0];
            const pendingAcrossProjects = (personBalances.data ?? []).reduce((sum, b) => sum + b.pendingPaise, 0);
            const totalContributed = (contributions.data?.items ?? []).reduce((sum, e) => {
              const mine = e.contributions.find((c) => c.userId === id);
              return sum + (mine?.amountPaise ?? 0);
            }, 0);
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Last payslip (net)"
                  loading={payslips.isLoading}
                  value={lastSlip ? <Price paise={lastSlip.netPaise} currency={lastSlip.currency} /> : '—'}
                />
                <StatCard
                  label="Pending project payouts"
                  loading={personBalances.isLoading}
                  tone={pendingAcrossProjects > 0 ? 'warning' : 'default'}
                  value={<Price paise={pendingAcrossProjects} />}
                />
                <StatCard label="Shared costs recovered" loading={contributions.isLoading} value={<Price paise={totalContributed} />} />
              </div>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle>Monthly earnings, last 12 months</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(stats.data?.earnings ?? []).map((e) => ({
                        month: e.month.slice(5),
                        Net: Math.round(e.netPaise / 100),
                        Gross: Math.round(e.grossPaise / 100),
                      }))}
                      margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                      barSize={14}
                      barGap={2}
                    >
                      <CartesianGrid stroke="hsl(var(--border))" horizontal vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48}
                        tickFormatter={(v: number) => (canSeePrices ? `₹${(v / 1000).toFixed(0)}k` : '')} />
                      <Tooltip
                        content={<ChartTooltip formatValue={(v) => (canSeePrices ? `₹${v.toLocaleString('en-IN')}` : '')} />}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'hsl(var(--muted-foreground))' }} iconType="circle" iconSize={8} />
                      <Bar dataKey="Gross" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Net" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!stats.isLoading && stats.data && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm md:grid-cols-3">
                  {(() => {
                    const withData = stats.data.earnings.filter((e) => e.netPaise > 0);
                    const total = withData.reduce((s, e) => s + e.netPaise, 0);
                    const avg = withData.length ? Math.round(total / withData.length) : 0;
                    const last = stats.data.earnings.at(-1);
                    return (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Last month net</p>
                          <p className="mt-1 font-semibold">{last?.netPaise ? <Price paise={last.netPaise} /> : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">12-month average</p>
                          <p className="mt-1 font-semibold">{avg ? <Price paise={avg} /> : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">12-month total</p>
                          <p className="mt-1 font-semibold">{total ? <Price paise={total} /> : '—'}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <PersonPayments userId={id} />
        </>
      )}

      {me?.role === Role.OWNER && <MemberPayslips userId={id} />}

      {me?.role === Role.OWNER && (
        <Card>
          <CardHeader>
            <CardTitle>Shared cost contributions</CardTitle>
          </CardHeader>
          <CardContent>
            {contributions.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : contributions.isError ? (
              <ErrorState error={contributions.error} onRetry={() => contributions.refetch()} className="py-6" />
            ) : (contributions.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shared costs (e.g. tool subscriptions) recovered from this person&apos;s pay.
              </p>
            ) : (
              <div className="divide-y">
                {(contributions.data?.items ?? []).map((e) => {
                  const mine = e.contributions.find((c) => c.userId === id);
                  if (!mine) return null;
                  return (
                    <div key={e._id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(e.date)}
                          {mine.note && ` · ${mine.note}`}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-destructive">−<Price paise={mine.amountPaise} currency={e.currency} /></span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(canManage || isSelf) && <MemberDocuments user={u} canManage={canManage} />}
      {(canManage || isSelf) && <MemberOnboarding user={u} canManage={canManage} isSelf={isSelf} />}

      {canManage && <MemberEmploymentSheet user={u} open={editOpen} onOpenChange={setEditOpen} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1">{value || <span className="text-muted-foreground">Not set</span>}</p>
    </div>
  );
}
