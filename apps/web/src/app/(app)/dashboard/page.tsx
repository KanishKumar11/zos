// Dashboard landing — role-aware widgets.
'use client';

import {
  Briefcase,
  FileText,
  TrendingUp,
  CheckSquare,
  Clock,
  CreditCard,
  IndianRupee,
} from 'lucide-react';
import { Role } from '@agency/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import {
  useMemberDashboard,
  useOwnerDashboard,
} from '@/features/dashboard/dashboard.hooks';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isOwner = role === Role.OWNER;
  const owner = useOwnerDashboard(isOwner);
  const member = useMemberDashboard();

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace.
        </p>
      </div>

      {/* Owner — agency overview */}
      {isOwner && (
        <section className="space-y-4">
          <SectionHeader title="Agency overview" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {owner.isLoading ? (
              <StatSkeletons count={4} />
            ) : owner.data ? (
              <>
                <Stat
                  title="Active projects"
                  value={owner.data.activeProjects.toString()}
                  icon={Briefcase}
                />
                <Stat
                  title="Active SOWs"
                  value={owner.data.activeSows.toString()}
                  icon={FileText}
                />
                <Stat
                  title="Outstanding"
                  value={formatPaise(owner.data.invoices.outstanding, 'INR')}
                  description={`Overdue ${formatPaise(owner.data.invoices.overdue, 'INR')}`}
                  icon={TrendingUp}
                  iconClassName="text-warning"
                />
                <Stat
                  title="Collected"
                  value={formatPaise(owner.data.invoices.collected, 'INR')}
                  description={
                    owner.data.lastPayrollRun
                      ? `Last payroll · ${owner.data.lastPayrollRun.month}`
                      : 'No payroll runs yet'
                  }
                  icon={IndianRupee}
                  iconClassName="text-success"
                />
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* All roles — personal snapshot */}
      <section className="space-y-4">
        <SectionHeader title="My snapshot" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {member.isLoading ? (
            <StatSkeletons count={3} />
          ) : (
            <>
              <Stat
                title="Open tasks"
                value={(member.data?.openTasks ?? 0).toString()}
                icon={CheckSquare}
              />
              <Stat
                title="Pending leaves"
                value={(member.data?.pendingLeaves ?? 0).toString()}
                icon={Clock}
              />
              <Stat
                title="Last payslip"
                value={
                  member.data?.lastPayslip
                    ? formatPaise(member.data.lastPayslip.netPaise, 'INR')
                    : '—'
                }
                icon={CreditCard}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Stat({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  iconClassName?: string;
}) {
  return (
    <Card className="group transition-shadow hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-2.5 text-[26px] font-semibold leading-none tabular-nums tracking-tight">
              {value}
            </p>
            {description && (
              <p className="mt-2 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={`shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary ${iconClassName ?? ''}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
