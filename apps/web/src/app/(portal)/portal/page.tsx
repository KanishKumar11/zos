// Portal overview — the client's at-a-glance page.
'use client';

import { ArrowRight, FolderKanban } from 'lucide-react';
import Link from 'next/link';

import { formatDate, formatDateTime, formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { usePortalMe, usePortalProjects, usePortalSummary } from '@/features/portal/portal.hooks';

export default function PortalOverview() {
  const me = usePortalMe();
  const summary = usePortalSummary();
  const projects = usePortalProjects();

  if (summary.isLoading || me.isLoading) return <PageSkeleton />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  const s = summary.data!;
  const firstName = me.data?.user.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader title={firstName ? `Hi ${firstName}` : 'Welcome'} description={`Here's where things stand with ${me.data?.client.name ?? 'your projects'}.`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(s.activeProjects)} href="/portal/projects" />
        <StatCard
          label="Amount due"
          tone={s.outstandingPaise > 0 ? 'warning' : 'default'}
          value={formatPaise(s.outstandingPaise)}
          href="/portal/invoices?show=open"
          hint={s.nextDue ? `Next: ${s.nextDue.number} due ${formatDate(s.nextDue.dueDate)}` : 'Nothing due'}
        />
        <StatCard
          label="Overdue"
          tone={s.overduePaise > 0 ? 'danger' : 'default'}
          value={formatPaise(s.overduePaise)}
          hint={s.overdueCount ? `${s.overdueCount} invoice${s.overdueCount === 1 ? '' : 's'}` : 'All on time'}
          href="/portal/invoices?show=open"
        />
        <StatCard label="Paid this financial year" tone="success" value={formatPaise(s.paidThisFyPaise)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Your projects</CardTitle>
            <Link href="/portal/projects" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {(projects.data ?? []).length === 0 ? (
              <EmptyState icon={FolderKanban} title="No projects yet" />
            ) : (
              <ul className="divide-y">
                {projects.data!.slice(0, 6).map((p) => (
                  <li key={p._id}>
                    <Link href={`/portal/projects/${p._id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.nextMilestone
                            ? `Next: ${p.nextMilestone.name}${p.nextMilestone.dueDate ? ` · ${formatDate(p.nextMilestone.dueDate)}` : ''}`
                            : p.milestoneCount
                              ? 'All milestones reached'
                              : p.description || 'In progress'}
                        </p>
                      </div>
                      {p.milestoneCount > 0 && (
                        <div className="hidden w-28 sm:block">
                          <ProgressBar value={p.milestonesDone} max={p.milestoneCount} />
                          <p className="mt-1 text-right text-[11px] text-muted-foreground">
                            {p.milestonesDone}/{p.milestoneCount} milestones
                          </p>
                        </div>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Latest updates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s.recentUpdates.length === 0 ? (
              <EmptyState title="No updates yet" className="py-8" />
            ) : (
              <ul className="divide-y">
                {s.recentUpdates.map((u) => (
                  <li key={u._id}>
                    <Link href={`/portal/projects/${u.projectId}`} className="block px-5 py-3 hover:bg-muted/30">
                      <p className="text-sm font-medium">{u.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.projectName} · {formatDateTime(u.createdAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{u.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
