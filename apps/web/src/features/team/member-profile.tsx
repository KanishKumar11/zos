// Member profile pieces: the sticky profile sidebar, the projects list (with each project's pay for
// the OWNER only) and, when the Tasks feature is on, the "work in hand" list.
'use client';

import { CalendarDays, Cake, Clock, Copy, LogOut, Mail, Phone, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Role, UserStatus } from '@agency/shared';

import { formatDate, formatDateTime } from '@/lib/formatters';
import { todayLocal } from '@/lib/form';
import { identityColor } from '@/lib/identity';

import { usePageTitle } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar, FillJar, HealthRing, Legend, Price, ProjectChip, SegmentBar, SpotIllustration, Tile } from '@/components/viz';
import type { BalanceRow } from '@/features/payouts/payouts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

import { dueKey, dueLabel, isOpenTask, onboardingProgress, tenureLabel, useAssigneeTasks } from './people';
import { EXIT_REASON_LABEL, ROLE_LABEL, type UserRow } from './team.api';

const PROJECT_ROLE_LABEL: Record<string, string> = { LEAD: 'Lead', CONTRIBUTOR: 'Contributor', REVIEWER: 'Reviewer' };

/** Left-hand profile card: who they are, how to reach them, where they stand. */
export function MemberProfileCard({
  user: u,
  dept,
  desig,
  manager,
  actions,
  canSeeBirthday,
}: {
  user: UserRow;
  dept?: string;
  desig?: string;
  manager?: { id: string; name: string };
  actions?: ReactNode;
  canSeeBirthday?: boolean;
}) {
  usePageTitle(u.name, [{ label: 'Team', href: '/team' }]);
  const exited = u.status === UserStatus.EXITED;
  const tenure = tenureLabel(u.dateOfJoining, exited && u.dateOfExit ? new Date(u.dateOfExit) : undefined);
  const progress = onboardingProgress(u);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(u.email);
      toast.success('Email copied');
    } catch {
      toast.error("Couldn't copy — select it instead");
    }
  };

  return (
    <aside className="animate-rise overflow-hidden rounded-[var(--radius)] border bg-card lg:sticky lg:top-20">
      <div
        className="h-24"
        style={{ background: `linear-gradient(135deg, ${identityColor(u._id, exited ? 0.35 : 0.95)}, ${identityColor(u._id, 0.25)})` }}
        aria-hidden
      />
      <div className="-mt-12 px-5 pb-5">
        <Avatar id={u._id} name={u.name} className={`h-24 w-24 text-3xl ring-4 ring-card ${exited ? 'grayscale' : ''}`} />
        <div className="mt-3 space-y-1">
          <h1 className="font-display text-[1.75rem] font-bold leading-tight">{u.name}</h1>
          <p className="text-sm text-muted-foreground">{[desig, dept].filter(Boolean).join(' · ') || ROLE_LABEL[u.role]}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={u.status} />
            <Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge>
          </div>
        </div>

        {exited && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
            <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {u.exitReason ? EXIT_REASON_LABEL[u.exitReason] : 'Left'}
              {u.dateOfExit ? ` · last day ${formatDate(u.dateOfExit)}` : ''}
            </span>
          </div>
        )}

        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}

        <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
          <Fact icon={Mail} label="Email">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{u.email}</span>
              <button type="button" onClick={() => void copyEmail()} aria-label="Copy email" className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </span>
          </Fact>
          <Fact icon={Phone} label="Phone">
            {u.phone || <span className="text-muted-foreground">Not set</span>}
          </Fact>
          <Fact icon={CalendarDays} label={exited ? 'Was with us' : 'With us'}>
            {tenure ? (
              <>
                {tenure}
                {u.dateOfJoining && <span className="text-muted-foreground"> · since {formatDate(u.dateOfJoining)}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">No joining date</span>
            )}
          </Fact>
          {manager && (
            <Fact icon={UserRound} label="Reports to">
              <Link href={`/team/${manager.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                <Avatar id={manager.id} name={manager.name} size="xs" /> {manager.name}
              </Link>
            </Fact>
          )}
          {canSeeBirthday && u.dateOfBirth && (
            <Fact icon={Cake} label="Birthday">
              {formatDate(u.dateOfBirth, { day: 'numeric', month: 'long' })}
            </Fact>
          )}
          <Fact icon={Clock} label="Last sign-in">
            {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-muted-foreground">Never</span>}
          </Fact>
        </dl>

        {progress && (
          <a href="#onboarding" className="mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:border-foreground/25">
            <HealthRing
              size={36}
              rings={[{ value: progress.pct, color: progress.done === progress.total ? 'hsl(var(--success))' : identityColor(u._id), label: 'Onboarding' }]}
            />
            <span className="text-sm">
              <span className="block font-medium">Onboarding</span>
              <span className="text-xs text-muted-foreground">
                {progress.done === progress.total ? 'All steps done' : `${progress.done} of ${progress.total} steps done`}
              </span>
            </span>
          </a>
        )}

        {(u.skills?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {u.skills!.map((s) => (
              <span key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 min-w-0">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Projects this person is on. The OWNER also sees each project's agreed fee, what's been paid and a
 * Pay button (from `balances`); everyone else sees role and status only. A LEAD only gets projects
 * they're on from the API, so for them this is "projects you share".
 */
export function MemberProjects({
  userId,
  viewerRole,
  balances,
  onPay,
}: {
  userId: string;
  viewerRole?: Role;
  /** OWNER only — per-project pay rows from usePayeeBalances. */
  balances?: BalanceRow[];
  onPay?: (projectId: string | undefined, pendingPaise: number) => void;
}) {
  const projects = useAllProjects();
  const seesAll = viewerRole === Role.OWNER || viewerRole === Role.ADMIN;
  const owner = viewerRole === Role.OWNER;

  const rows = useMemo(() => {
    const byProject = new Map((balances ?? []).filter((b) => b.projectId).map((b) => [b.projectId!, b]));
    const list = (projects.data?.items ?? [])
      .map((p) => ({ p, m: p.members.find((m) => m.userId === userId), b: byProject.get(p._id) }))
      .filter((x) => !!x.m);
    const rank = (x: (typeof list)[number]) => (x.m?.leftAt ? 2 : x.p.status === 'COMPLETED' ? 1 : 0);
    return list.sort((a, b) => rank(a) - rank(b) || (b.b?.pendingPaise ?? 0) - (a.b?.pendingPaise ?? 0));
  }, [projects.data, balances, userId]);
  const general = (balances ?? []).find((b) => !b.projectId);
  const active = rows.filter((r) => !r.m?.leftAt && r.p.status !== 'COMPLETED').length;

  return (
    <Tile
      span={12}
      title={seesAll ? 'Projects' : 'Projects you share'}
      action={rows.length > 0 ? <span className="text-xs text-muted-foreground">{active} active · {rows.length} in all</span> : undefined}
    >
      {projects.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} className="py-4" />
      ) : rows.length === 0 && !general ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <SpotIllustration kind="projects" className="h-16 w-24" />
          <p className="text-sm text-muted-foreground">{seesAll ? 'Not on any projects yet.' : "You don't share any projects."}</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map(({ p, m, b }) => {
            const finished = !!m?.leftAt || p.status === 'COMPLETED';
            return (
              <li key={p._id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${finished ? 'bg-muted/30' : ''}`}>
                <div className="min-w-0 flex-1">
                  <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} className="max-w-full text-sm font-semibold" />
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{PROJECT_ROLE_LABEL[m!.role] ?? m!.role}</span>
                    <span aria-hidden>·</span>
                    {m?.leftAt ? <span>Left {formatDate(m.leftAt)}</span> : <StatusBadge status={p.status} />}
                    {owner && b && b.agreedPaise > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          <Price paise={b.paidPaise} compact /> of <Price paise={b.agreedPaise} compact />
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {owner && b && (
                  <>
                    <FillJar value={b.paidPaise} max={b.agreedPaise} size="sm" />
                    {b.pendingPaise > 0 && onPay && (
                      <button
                        type="button"
                        onClick={() => onPay(p._id, b.pendingPaise)}
                        className="shrink-0 rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-background hover:bg-foreground/85"
                      >
                        Pay <Price paise={b.pendingPaise} compact />
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
          {owner && general && general.paidPaise > 0 && (
            <li className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Other payments</p>
                <p className="text-xs text-muted-foreground">Stipends, bonuses and advances not tied to a project</p>
              </div>
              <Price paise={general.paidPaise} className="text-sm font-semibold" />
            </li>
          )}
        </ul>
      )}
    </Tile>
  );
}

/** Tasks assigned to this person (only rendered when the Tasks feature is on). */
export function MemberTasks({ userId, viewerRole }: { userId: string; viewerRole?: Role }) {
  const projects = useAllProjects();
  const tasks = useAssigneeTasks(userId);
  const today = todayLocal();
  const seesAllProjects = viewerRole === Role.OWNER || viewerRole === Role.ADMIN;
  const projectMap = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p])), [projects.data]);
  const work = useMemo(() => {
    const all = tasks.data ?? [];
    const visible = seesAllProjects ? all : projects.data ? all.filter((t) => projectMap.has(t.projectId)) : [];
    const open = visible.filter(isOpenTask).sort((a, b) => (dueKey(a) ?? '9').localeCompare(dueKey(b) ?? '9'));
    const overdue = open.filter((t) => (dueKey(t) ?? '9') < today).length;
    return { open, overdue, done: visible.length - open.length, total: visible.length };
  }, [tasks.data, seesAllProjects, projects.data, projectMap, today]);

  return (
    <Tile span={12} title="Work in hand">
      {tasks.isLoading || projects.isLoading ? (
        <Skeleton className="h-24" />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} className="py-4" />
      ) : work.total === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No tasks assigned yet.</p>
      ) : (
        <div className="space-y-3">
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
                    <div className="text-xs text-muted-foreground">{p ? <ProjectChip id={p._id} name={p.name} /> : 'Deleted project'}</div>
                  </div>
                  {d && <span className="shrink-0 text-[11px] text-muted-foreground">{d.label}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Tile>
  );
}
