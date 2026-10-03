// Member profile pieces — the big profile header and the "projects & work" view. No money here:
// project membership and tasks only (member fees are OWNER-only and never read).
'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import { Role } from '@agency/shared';

import { formatDate } from '@/lib/formatters';
import { todayLocal } from '@/lib/form';
import { identityColor } from '@/lib/identity';

import { usePageTitle } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, HealthRing, Legend, ProjectChip, SegmentBar, SpotIllustration, Tile } from '@/components/viz';
import { useAllProjects } from '@/features/projects/projects.hooks';

import { dueKey, dueLabel, isOpenTask, onboardingProgress, tenureLabel, useAssigneeTasks } from './people';
import { ROLE_LABEL, type UserRow } from './team.api';

const PROJECT_ROLE_LABEL: Record<string, string> = { LEAD: 'Lead', CONTRIBUTOR: 'Contributor', REVIEWER: 'Reviewer' };

export function MemberProfileHeader({
  user: u,
  dept,
  desig,
  manager,
  actions,
}: {
  user: UserRow;
  dept?: string;
  desig?: string;
  manager?: { id: string; name: string };
  actions?: ReactNode;
}) {
  usePageTitle(u.name, [{ label: 'Team', href: '/team' }]);
  const tenure = tenureLabel(u.dateOfJoining);
  const progress = onboardingProgress(u);
  return (
    <header className="animate-rise overflow-hidden rounded-[var(--radius)] border bg-card">
      <div className="h-20 sm:h-24" style={{ background: `linear-gradient(120deg, ${identityColor(u._id, 0.9)}, ${identityColor(u._id, 0.35)})` }} aria-hidden />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            <Avatar id={u._id} name={u.name} className="h-24 w-24 text-3xl ring-4 ring-card sm:h-28 sm:w-28" />
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">{u.name}</h1>
                <StatusBadge status={u.status} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[desig, dept].filter(Boolean).join(' · ') || ROLE_LABEL[u.role]}
              </p>
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Fact label="Role">
            <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
          </Fact>
          <Fact label="With us">{tenure ? `${tenure}${u.dateOfJoining ? ` · since ${formatDate(u.dateOfJoining)}` : ''}` : <span className="text-muted-foreground">No joining date</span>}</Fact>
          {manager && (
            <Fact label="Reports to">
              <Link href={`/team/${manager.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                <Avatar id={manager.id} name={manager.name} size="xs" /> {manager.name}
              </Link>
            </Fact>
          )}
          <Fact label="Email">
            <a href={`mailto:${u.email}`} className="hover:underline">
              {u.email}
            </a>
          </Fact>
          {progress && (
            <Fact label="Onboarding">
              <span className="inline-flex items-center gap-2">
                <HealthRing size={22} rings={[{ value: progress.pct, color: progress.done === progress.total ? 'hsl(var(--success))' : identityColor(u._id), label: 'Onboarding' }]} />
                {progress.done === progress.total ? 'Done' : `${progress.done} of ${progress.total} steps`}
              </span>
            </Fact>
          )}
        </div>
      </div>
    </header>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 truncate">{children}</div>
    </div>
  );
}

/**
 * Projects this person is on, and the tasks assigned to them. A LEAD only gets projects they're on
 * from the API, so for them this shows shared projects, and only tasks on those projects.
 */
export function MemberWork({ userId, viewerRole }: { userId: string; viewerRole?: Role }) {
  const projects = useAllProjects();
  const tasks = useAssigneeTasks(userId);
  const today = todayLocal();
  const seesAllProjects = viewerRole === Role.OWNER || viewerRole === Role.ADMIN;

  const projectMap = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p])), [projects.data]);
  const theirProjects = useMemo(
    () =>
      (projects.data?.items ?? [])
        .map((p) => ({ p, m: p.members.find((m) => m.userId === userId) }))
        .filter((x) => !!x.m)
        .sort((a, b) => (a.p.status === 'COMPLETED' ? 1 : 0) - (b.p.status === 'COMPLETED' ? 1 : 0)),
    [projects.data, userId],
  );
  const work = useMemo(() => {
    const all = tasks.data ?? [];
    const visible = seesAllProjects ? all : projects.data ? all.filter((t) => projectMap.has(t.projectId)) : [];
    const open = visible.filter(isOpenTask).sort((a, b) => (dueKey(a) ?? '9').localeCompare(dueKey(b) ?? '9'));
    const overdue = open.filter((t) => (dueKey(t) ?? '9') < today).length;
    const done = visible.length - open.length;
    return { open, overdue, done, total: visible.length };
  }, [tasks.data, seesAllProjects, projects.data, projectMap, today]);

  return (
    <>
      <Tile span={5} title={seesAllProjects ? 'Projects' : 'Projects you share'}>
        {projects.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => projects.refetch()} className="py-4" />
        ) : theirProjects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <SpotIllustration kind="projects" className="h-16 w-24" />
            <p className="text-sm text-muted-foreground">{seesAllProjects ? 'Not on any projects yet.' : "You don't share any projects."}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {theirProjects.map(({ p, m }) => (
              <li key={p._id} className="flex items-center gap-3 py-2 text-sm">
                <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} className="min-w-0 flex-1 font-medium" />
                <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_ROLE_LABEL[m!.role] ?? m!.role}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <Tile span={7} title="Work in hand" action={!seesAllProjects ? <span className="text-xs text-muted-foreground">On projects you&apos;re on</span> : undefined}>
        {tasks.isLoading || projects.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} className="py-4" />
        ) : work.total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <SpotIllustration kind="done" className="h-16 w-24" />
            <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <SegmentBar
              height="h-2.5"
              showLabels={false}
              segments={[
                { value: work.overdue, color: 'hsl(var(--destructive))', label: 'Overdue' },
                { value: work.open.length - work.overdue, color: identityColor(userId), label: 'Open' },
                { value: work.done, color: 'hsl(var(--success))', label: 'Done' },
              ]}
            />
            <Legend
              items={[
                { color: 'hsl(var(--destructive))', label: `${work.overdue} overdue` },
                { color: identityColor(userId), label: `${work.open.length - work.overdue} open` },
                { color: 'hsl(var(--success))', label: `${work.done} done` },
              ]}
            />
            {work.open.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything assigned is done.</p>
            ) : (
              <ul className="-mx-2">
                {work.open.slice(0, 6).map((t) => {
                  const k = dueKey(t);
                  const d = k ? dueLabel(k, today) : undefined;
                  const p = projectMap.get(t.projectId);
                  return (
                    <li key={t._id} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <Link href={`/tasks/${t._id}`} className="block truncate text-sm font-medium hover:underline">
                          {t.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {p ? <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} /> : 'Deleted project'}
                        </div>
                      </div>
                      {d && (
                        <span
                          className={
                            d.tone === 'bad'
                              ? 'shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive'
                              : d.tone === 'warn'
                                ? 'shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning'
                                : 'shrink-0 text-[11px] text-muted-foreground'
                          }
                        >
                          {d.label}
                        </span>
                      )}
                    </li>
                  );
                })}
                {work.open.length > 6 && <li className="px-2 pt-1 text-xs text-muted-foreground">And {work.open.length - 6} more open.</li>}
              </ul>
            )}
          </div>
        )}
      </Tile>
    </>
  );
}
