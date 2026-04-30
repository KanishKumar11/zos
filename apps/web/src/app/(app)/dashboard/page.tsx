// Dashboard landing — role-aware widgets.
'use client';

import { Role } from '@agency/shared';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import {
  useMemberDashboard,
  useOwnerDashboard,
} from '@/features/dashboard/dashboard.hooks';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const owner = useOwnerDashboard(role === Role.OWNER);
  const member = useMemberDashboard();
  const isOwner = role === Role.OWNER;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-muted-foreground">Welcome back.</p>
      </div>

      {isOwner && owner.data && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Agency overview</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat title="Active projects" value={owner.data.activeProjects.toString()} />
            <Stat title="Active SOWs" value={owner.data.activeSows.toString()} />
            <Stat
              title="Outstanding"
              value={formatPaise(owner.data.invoices.outstanding, 'INR')}
              description={`Overdue ${formatPaise(owner.data.invoices.overdue, 'INR')}`}
            />
            <Stat
              title="Collected"
              value={formatPaise(owner.data.invoices.collected, 'INR')}
              description={
                owner.data.lastPayrollRun
                  ? `Last payroll · ${owner.data.lastPayrollRun.month}`
                  : 'No payroll runs yet'
              }
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">My snapshot</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Stat title="Open tasks" value={(member.data?.openTasks ?? 0).toString()} />
          <Stat title="Pending leaves" value={(member.data?.pendingLeaves ?? 0).toString()} />
          <Stat
            title="Last payslip"
            value={
              member.data?.lastPayslip
                ? formatPaise(member.data.lastPayslip.netPaise, 'INR')
                : '—'
            }
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
