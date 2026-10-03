// Admin / lead home — people and delivery. Contains no project money at all; the only amounts are
// the viewer's own earnings, rendered through <Price own>.
//
// Endpoints used (all allowed for ADMIN and LEAD): GET /users (directory), GET /attendance/team,
// GET /tasks, GET /projects (LEADs only get projects they're on; milestone amounts are stripped),
// GET /tasks?mine, GET /me/earnings, and GET /auth/invites for ADMINs only.
'use client';

import { ArrowRight, CalendarClock, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { AttendanceStatus, ProjectStatus, Role, UserStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { FEATURES } from '@/lib/features';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { statusLabel } from '@/components/ui/status-badge';
import {
  Avatar,
  AvatarStack,
  Bento,
  BigNumber,
  CountUp,
  FillJar,
  HealthRing,
  Hero,
  HeroFigure,
  HeroMark,
  Legend,
  Price,
  PrivacyChip,
  ProjectChip,
  SegmentBar,
  SpotIllustration,
  Tile,
  WeekStrip,
  type WeekDot,
} from '@/components/viz';
import { useTeamAttendance, type AttendanceEntryRow } from '@/features/attendance/attendance.hooks';
import { useMyEarnings } from '@/features/payouts/payouts.hooks';
import { useAllProjects, type ProjectRow } from '@/features/projects/projects.hooks';
import { useMyTasks, type TaskRow } from '@/features/tasks/tasks.hooks';
import { dueKey, dueLabel, isCurrentStaff, isOpenTask, onboardingProgress, thisWeekRange, useTeamTasks } from '@/features/team/people';
import { ROLE_LABEL, type UserRow } from '@/features/team/team.api';
import { usePendingInvites, useStaffDirectory } from '@/features/team/team.hooks';

import { greeting } from './greeting';

/** Attendance has no feature flag today; this keeps the page honest if one is added later. */
const ATTENDANCE_ON = (FEATURES as Record<string, boolean>).attendance !== false;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'hsl(var(--muted-foreground) / 0.55)',
  [ProjectStatus.ACTIVE]: 'hsl(var(--success))',
  [ProjectStatus.IN_PROGRESS]: 'hsl(var(--info))',
  [ProjectStatus.REVIEW]: 'hsl(var(--warning))',
  [ProjectStatus.ON_HOLD]: 'hsl(var(--destructive))',
  [ProjectStatus.COMPLETED]: 'hsl(var(--foreground) / 0.3)',
};
const STATUS_ORDER = [
  ProjectStatus.PLANNING,
  ProjectStatus.ACTIVE,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.REVIEW,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
];

const isIn = (e?: AttendanceEntryRow) =>
  !!e && (e.status === AttendanceStatus.PRESENT || e.status === AttendanceStatus.HALF_DAY || !!e.checkInAt);
const isAway = (u: UserRow, e?: AttendanceEntryRow) =>
  (!!e && (e.status === AttendanceStatus.LEAVE || e.status === AttendanceStatus.HOLIDAY)) || (!e && u.status === UserStatus.ON_LEAVE);

export function TeamPulse() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isAdmin = role === Role.ADMIN || role === Role.OWNER;
  const firstName = user?.name?.split(' ')[0];
  const today = todayLocal();
  const week = thisWeekRange();
  const [selectedDay, setSelectedDay] = useState(today);

  const staff = useStaffDirectory();
  const attendance = useTeamAttendance(today, undefined, { enabled: ATTENDANCE_ON });
  const projects = useAllProjects();
  const teamTasks = useTeamTasks();
  const invites = usePendingInvites(isAdmin);

  const people = useMemo(() => (staff.data ?? []).filter(isCurrentStaff), [staff.data]);
  const names = useMemo(() => new Map((staff.data ?? []).map((u) => [u._id, u.name])), [staff.data]);
  const projectMap = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p])), [projects.data]);

  // Who's in today.
  const presence = useMemo(() => {
    const byUser = new Map((attendance.data ?? []).map((e) => [e.userId, e]));
    const inToday: UserRow[] = [];
    const away: UserRow[] = [];
    const absent: UserRow[] = [];
    const notYet: UserRow[] = [];
    for (const u of people) {
      const e = byUser.get(u._id);
      if (isIn(e)) inToday.push(u);
      else if (isAway(u, e)) away.push(u);
      else if (e?.status === AttendanceStatus.ABSENT) absent.push(u);
      else notYet.push(u);
    }
    return { byUser, inToday, away, absent, notYet };
  }, [attendance.data, people]);

  // Tasks across the team. A LEAD only sees tasks on projects they're on (ADMINs see every project).
  const tasks = useMemo(() => {
    const all = teamTasks.data ?? [];
    const visible = isAdmin ? all : projects.data ? all.filter((t) => projectMap.has(t.projectId)) : [];
    const open = visible.filter(isOpenTask);
    const byDue = (a: TaskRow, b: TaskRow) => (dueKey(a) ?? '9').localeCompare(dueKey(b) ?? '9');
    const overdue = open.filter((t) => (dueKey(t) ?? '9') < today).sort(byDue);
    const dueThisWeek = open.filter((t) => {
      const k = dueKey(t);
      return !!k && k >= today && k <= week.to;
    }).sort(byDue);
    const inWeek = open.filter((t) => {
      const k = dueKey(t);
      return !!k && k >= week.from && k <= week.to;
    });
    return { open, overdue, dueThisWeek, inWeek };
  }, [teamTasks.data, isAdmin, projects.data, projectMap, today, week.from, week.to]);

  // Deadlines this week: task due dates, pending milestones and project end dates (no amounts).
  const deadlines = useMemo(() => {
    const items: { date: string; kind: 'task' | 'milestone' | 'project'; title: string; project?: ProjectRow; href: string; who?: string }[] = [];
    for (const t of tasks.inWeek) {
      items.push({
        date: dueKey(t)!,
        kind: 'task',
        title: t.title,
        project: projectMap.get(t.projectId),
        href: `/tasks/${t._id}`,
        who: t.assigneeId ? names.get(t.assigneeId) : undefined,
      });
    }
    for (const p of projects.data?.items ?? []) {
      for (const m of p.milestones ?? []) {
        const k = m.dueDate?.slice(0, 10);
        if (k && m.status === 'PENDING' && k >= week.from && k <= week.to) {
          items.push({ date: k, kind: 'milestone', title: m.name, project: p, href: `/projects/${p._id}` });
        }
      }
      const end = p.endDate?.slice(0, 10);
      if (end && p.status !== ProjectStatus.COMPLETED && end >= week.from && end <= week.to) {
        items.push({ date: end, kind: 'project', title: `${p.name} is due`, project: p, href: `/projects/${p._id}` });
      }
    }
    return items;
  }, [tasks.inWeek, projects.data, projectMap, names, week.from, week.to]);

  const dots: WeekDot[] = deadlines.map((d) => ({
    date: d.date,
    color: d.kind === 'task' ? identityColor(d.project?._id ?? d.title) : d.kind === 'milestone' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
    title: d.title,
  }));
  const dayItems = deadlines.filter((d) => d.date === selectedDay);

  const pendingInvites = invites.data ?? [];
  const heroLoading = staff.isLoading || teamTasks.isLoading || (!isAdmin && projects.isLoading) || (ATTENDANCE_ON && attendance.isLoading);

  const inCount = presence.inToday.length;
  const dueCount = tasks.dueThisWeek.length;
  const sentence: ReactNode = (
    <>
      {ATTENDANCE_ON && !attendance.isError && people.length > 0 ? (
        inCount > 0 ? (
          <>
            <HeroFigure>
              {inCount} of {people.length}
            </HeroFigure>{' '}
            {people.length === 1 ? 'person is' : 'people are'} in today
          </>
        ) : (
          <>Nobody has checked in yet today</>
        )
      ) : (
        <>
          <HeroFigure>{plural(people.length, 'person', 'people')}</HeroFigure> on the team
        </>
      )}
      {teamTasks.isError ? '.' : '; '}
      {teamTasks.isError ? null : dueCount > 0 ? (
        <>
          <HeroMark>{plural(dueCount, 'task')}</HeroMark> {dueCount === 1 ? 'is' : 'are'} due across the team this week.
        </>
      ) : (
        <>nothing is due across the team this week.</>
      )}
    </>
  );
  const ledeParts = [
    teamTasks.isError ? '' : tasks.overdue.length ? `${plural(tasks.overdue.length, 'task')} ${tasks.overdue.length === 1 ? 'is' : 'are'} overdue and could use a nudge.` : 'Nothing is overdue. Nice.',
    isAdmin && pendingInvites.length ? `${plural(pendingInvites.length, 'invite')} still waiting to be accepted.` : '',
  ];

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="Dashboard"
        eyebrow={`${greeting()}${firstName ? `, ${firstName}` : ''} · ${new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}`}
        aside={<PrivacyChip>Only your own pay is shown here</PrivacyChip>}
        loading={heroLoading}
        lede={ledeParts.filter(Boolean).join(' ')}
      >
        {sentence}
      </Hero>

      <Bento>
        {/* Who's in today */}
        {ATTENDANCE_ON ? (
          <Tile
            span={5}
            title="Who's in today"
            action={
              <Link href="/attendance" className="text-xs font-medium text-brand-ink hover:underline">
                Attendance
              </Link>
            }
          >
            {attendance.isLoading || staff.isLoading ? (
              <TileSkeleton rows={3} />
            ) : attendance.isError ? (
              <ErrorState error={attendance.error} onRetry={() => attendance.refetch()} className="py-4" />
            ) : people.length === 0 ? (
              <EmptyTile kind="people" text="No one on the team yet." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <HealthRing
                    size={84}
                    rings={[{ value: people.length ? inCount / people.length : 0, color: 'hsl(var(--success))', label: 'In today' }]}
                    center={
                      <span className="font-display text-lg font-bold leading-none">
                        {inCount}
                        <span className="text-xs font-medium text-muted-foreground">/{people.length}</span>
                      </span>
                    }
                  />
                  <Legend
                    className="flex-col !gap-1.5"
                    items={[
                      { color: 'hsl(var(--success))', label: `${inCount} in` },
                      { color: 'hsl(var(--info))', label: `${presence.away.length} away or on leave` },
                      ...(presence.absent.length ? [{ color: 'hsl(var(--destructive))', label: `${presence.absent.length} marked absent` }] : []),
                      { color: 'hsl(var(--muted))', label: `${presence.notYet.length} not checked in` },
                    ]}
                  />
                </div>
                <PresenceRow label="In" people={presence.inToday} entries={presence.byUser} showTime />
                <PresenceRow label="Away" people={presence.away} />
                <PresenceRow label="Not in yet" people={[...presence.absent, ...presence.notYet]} faded />
              </div>
            )}
          </Tile>
        ) : (
          <Tile span={5} title="The team">
            {staff.isLoading ? (
              <TileSkeleton rows={2} />
            ) : staff.isError ? (
              <ErrorState error={staff.error} onRetry={() => staff.refetch()} className="py-4" />
            ) : (
              <div className="space-y-3">
                <BigNumber caption="people who can sign in">
                  <CountUp value={people.length} />
                </BigNumber>
                <AvatarStack people={people.map((u) => ({ id: u._id, name: u.name }))} max={10} />
              </div>
            )}
          </Tile>
        )}

        {/* Due across the team */}
        <Tile
          span={7}
          title="Due across the team"
          action={
            tasks.overdue.length > 0 ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{tasks.overdue.length} overdue</span>
            ) : undefined
          }
        >
          {teamTasks.isLoading ? (
            <TileSkeleton rows={5} />
          ) : teamTasks.isError ? (
            <ErrorState error={teamTasks.error} onRetry={() => teamTasks.refetch()} className="py-4" />
          ) : tasks.overdue.length + tasks.dueThisWeek.length === 0 ? (
            <EmptyTile kind="done" text={tasks.open.length ? 'Nothing is overdue or due this week.' : 'No open tasks across the team.'} />
          ) : (
            <ul className="-mx-2">
              {[...tasks.overdue, ...tasks.dueThisWeek].slice(0, 8).map((t) => (
                <TaskLine key={t._id} task={t} today={today} project={projectMap.get(t.projectId)} assignee={t.assigneeId ? { id: t.assigneeId, name: names.get(t.assigneeId) } : undefined} />
              ))}
              {tasks.overdue.length + tasks.dueThisWeek.length > 8 && (
                <li className="px-2 pt-2 text-xs text-muted-foreground">
                  And {tasks.overdue.length + tasks.dueThisWeek.length - 8} more — open a project board to see them all.
                </li>
              )}
            </ul>
          )}
        </Tile>

        {/* This week */}
        <Tile
          span={12}
          title="Deadlines this week"
          action={
            <Legend
              items={[
                { color: 'hsl(var(--p2))', label: 'Task (project colour)' },
                { color: 'hsl(var(--primary))', label: 'Milestone' },
                { color: 'hsl(var(--destructive))', label: 'Project deadline' },
              ]}
            />
          }
        >
          {teamTasks.isLoading || projects.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                  <WeekStrip dots={dots} selected={selectedDay} onSelect={setSelectedDay} />
                </div>
              </div>
              {projects.isError && (
                <p className="text-xs text-destructive">
                  Couldn&apos;t load project deadlines.{' '}
                  <button type="button" className="underline" onClick={() => projects.refetch()}>
                    Try again
                  </button>
                </p>
              )}
              <div>
                <p className="mb-2 text-[13px] font-semibold">
                  {selectedDay === today ? 'Today' : formatDate(new Date(`${selectedDay}T00:00:00`), { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {dayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing due on this day.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {dayItems.map((d, i) => (
                      <li key={`${d.href}-${i}`} className="flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: d.kind === 'task' ? identityColor(d.project?._id ?? d.title) : d.kind === 'milestone' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}
                        />
                        <div className="min-w-0 flex-1">
                          <Link href={d.href} className="block truncate font-medium hover:underline">
                            {d.title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {d.kind === 'task' ? 'Task' : d.kind === 'milestone' ? 'Milestone' : 'Project deadline'}
                            {d.project && d.kind !== 'project' ? ` · ${d.project.name}` : ''}
                            {d.who ? ` · ${d.who}` : d.kind === 'task' ? ' · Unassigned' : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Tile>

        {/* Project status counts — counts only, never money */}
        <ProjectStatusTile span={isAdmin ? 4 : 6} projects={projects} isAdmin={isAdmin} />

        {/* Pending invites — ADMIN only (the API allows OWNER/ADMIN) */}
        {isAdmin && (
          <Tile
            span={4}
            title="Pending invites"
            action={
              <Link href="/team?new=1" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </Link>
            }
          >
            {invites.isLoading ? (
              <TileSkeleton rows={3} />
            ) : invites.isError ? (
              <ErrorState error={invites.error} onRetry={() => invites.refetch()} className="py-4" />
            ) : pendingInvites.length === 0 ? (
              <EmptyTile kind="inbox" text="No invites waiting." />
            ) : (
              <div className="space-y-3">
                <BigNumber caption={`${pendingInvites.filter((i) => i.expired).length} with an expired link`}>
                  <CountUp value={pendingInvites.length} />
                </BigNumber>
                <ul className="space-y-2">
                  {pendingInvites.slice(0, 4).map((inv) => (
                    <li key={inv._id} className="flex items-center gap-2.5 text-sm">
                      <Avatar id={inv.email} name={inv.name} size="sm" className="opacity-70" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{inv.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ROLE_LABEL[inv.role] ?? inv.role} · {inv.expired ? 'link expired' : `sent ${formatDate(inv.lastSentAt)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/team" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
                  Resend or cancel on the team page <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </Tile>
        )}

        {/* Onboarding in progress */}
        <Tile span={isAdmin ? 4 : 6} title="Onboarding">
          {staff.isLoading ? (
            <TileSkeleton rows={3} />
          ) : staff.isError ? (
            <ErrorState error={staff.error} onRetry={() => staff.refetch()} className="py-4" />
          ) : (
            <OnboardingList people={people} />
          )}
        </Tile>

        {/* My own work and pay */}
        <MyFocusTile today={today} />
        <MyEarningsTile />
      </Bento>
    </div>
  );
}

function TileSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function EmptyTile({ kind, text, action }: { kind: 'people' | 'done' | 'inbox' | 'projects' | 'money'; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <SpotIllustration kind={kind} className="h-16 w-24" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

function PresenceRow({
  label,
  people,
  entries,
  showTime,
  faded,
}: {
  label: string;
  people: UserRow[];
  entries?: Map<string, AttendanceEntryRow>;
  showTime?: boolean;
  faded?: boolean;
}) {
  if (people.length === 0) return null;
  const first = showTime ? people.map((u) => entries?.get(u._id)?.checkInAt).filter(Boolean).sort()[0] : undefined;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn('min-w-0', faded && 'opacity-50 grayscale')}>
        <AvatarStack people={people.map((u) => ({ id: u._id, name: u.name }))} max={7} />
      </span>
      {first && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          first in {new Date(first).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

function DuePill({ k, today }: { k: string; today: string }) {
  const d = dueLabel(k, today);
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        d.tone === 'bad' && 'bg-destructive/10 text-destructive',
        d.tone === 'warn' && 'bg-warning/15 text-warning',
        d.tone === 'muted' && 'text-muted-foreground',
      )}
    >
      {d.label}
    </span>
  );
}

function TaskLine({
  task,
  today,
  project,
  assignee,
  hideAssignee,
}: {
  task: TaskRow;
  today: string;
  project?: ProjectRow;
  assignee?: { id: string; name?: string };
  hideAssignee?: boolean;
}) {
  const k = dueKey(task);
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
      {!hideAssignee &&
        (assignee ? (
          <Avatar id={assignee.id} name={assignee.name ?? 'Former team member'} size="sm" />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed text-[10px] text-muted-foreground" title="Unassigned">
            ?
          </span>
        ))}
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task._id}`} className="block truncate text-sm font-medium hover:underline">
          {task.title}
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {project ? <ProjectChip id={project._id} name={project.name} href={`/projects/${project._id}`} /> : <span>Project you&apos;re not on</span>}
          {!hideAssignee && <span className="truncate">· {assignee ? (assignee.name ?? 'Former team member') : 'Unassigned'}</span>}
        </div>
      </div>
      {k && <DuePill k={k} today={today} />}
    </li>
  );
}

function ProjectStatusTile({ span, projects, isAdmin }: { span: 4 | 6; projects: ReturnType<typeof useAllProjects>; isAdmin: boolean }) {
  const router = useRouter();
  const items = projects.data?.items ?? [];
  const counts = STATUS_ORDER.map((s) => ({ status: s, n: items.filter((p) => p.status === s).length }));
  const live = items.filter((p) => p.status !== ProjectStatus.COMPLETED).length;
  return (
    <Tile
      span={span}
      title="Projects by status"
      action={
        <Link href="/projects" className="text-xs font-medium text-brand-ink hover:underline">
          All projects
        </Link>
      }
    >
      {projects.isLoading ? (
        <TileSkeleton rows={3} />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} className="py-4" />
      ) : items.length === 0 ? (
        <EmptyTile kind="projects" text={isAdmin ? 'No projects yet.' : "You're not on any projects yet."} />
      ) : (
        <div className="space-y-4">
          <BigNumber caption={isAdmin ? 'live projects across the agency' : "live projects you're on"}>
            <CountUp value={live} />
          </BigNumber>
          <SegmentBar
            height="h-3"
            showLabels={false}
            segments={counts.map((c) => ({
              value: c.n,
              color: STATUS_COLOR[c.status],
              label: statusLabel(c.status),
              display: String(c.n),
              onClick: () => router.push(`/projects?status=${c.status}`),
            }))}
          />
          <Legend
            items={counts.filter((c) => c.n > 0).map((c) => ({ color: STATUS_COLOR[c.status], label: `${statusLabel(c.status)} ${c.n}` }))}
          />
        </div>
      )}
    </Tile>
  );
}

function OnboardingList({ people }: { people: UserRow[] }) {
  const inProgress = people
    .map((u) => ({ u, p: onboardingProgress(u) }))
    .filter((x): x is { u: UserRow; p: NonNullable<ReturnType<typeof onboardingProgress>> } => !!x.p && x.p.done < x.p.total)
    .sort((a, b) => a.p.pct - b.p.pct);
  if (inProgress.length === 0) return <EmptyTile kind="done" text="Everyone with a checklist has finished it." />;
  return (
    <ul className="space-y-2.5">
      {inProgress.slice(0, 5).map(({ u, p }) => (
        <li key={u._id}>
          <Link href={`/team/${u._id}`} className="flex items-center gap-3 rounded-lg hover:bg-muted/40">
            <HealthRing size={38} rings={[{ value: p.pct, color: identityColor(u._id), label: 'Onboarding' }]} center={<Avatar id={u._id} name={u.name} size="xs" />} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.done} of {p.total} steps done
              </p>
            </div>
          </Link>
        </li>
      ))}
      {inProgress.length > 5 && <li className="text-xs text-muted-foreground">And {inProgress.length - 5} more.</li>}
    </ul>
  );
}

function MyFocusTile({ today }: { today: string }) {
  const mine = useMyTasks();
  const projects = useAllProjects();
  const projectMap = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p])), [projects.data]);
  const open = (mine.data ?? []).filter(isOpenTask).sort((a, b) => (dueKey(a) ?? '9').localeCompare(dueKey(b) ?? '9'));
  return (
    <Tile
      span={7}
      title="My focus"
      action={
        <Link href="/tasks" className="text-xs font-medium text-brand-ink hover:underline">
          All my tasks
        </Link>
      }
    >
      {mine.isLoading ? (
        <TileSkeleton rows={4} />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} className="py-4" />
      ) : open.length === 0 ? (
        <EmptyTile kind="done" text="You're all clear — nothing assigned to you." />
      ) : (
        <ul className="-mx-2">
          {open.slice(0, 6).map((t) => (
            <TaskLine key={t._id} task={t} today={today} project={projectMap.get(t.projectId)} hideAssignee />
          ))}
          {open.length > 6 && (
            <li className="flex items-center gap-1.5 px-2 pt-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> {open.length - 6} more on your list.
            </li>
          )}
        </ul>
      )}
    </Tile>
  );
}

/** The viewer's own earnings — the only amounts on this page, all through <Price own>. */
function MyEarningsTile() {
  const earnings = useMyEarnings();
  const e = earnings.data;
  const projects = (e?.projects ?? []).filter((p) => p.projectId && p.agreedPaise > 0).slice(0, 3);
  return (
    <Tile
      span={5}
      tone="ink"
      title="My earnings"
      action={
        <Link href="/earnings" className="text-xs font-medium text-background/70 hover:text-background hover:underline">
          Details
        </Link>
      }
    >
      {earnings.isLoading ? (
        <Skeleton className="h-24 w-full bg-background/10" />
      ) : earnings.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-background/80">Couldn&apos;t load your earnings.</p>
          <button type="button" className="text-xs underline" onClick={() => earnings.refetch()}>
            Try again
          </button>
        </div>
      ) : !e ? null : (
        <div className="space-y-4">
          <BigNumber caption="received this month">
            <span className="text-brand">
              <Price own paise={e.totals.thisMonthPaise} />
            </span>
          </BigNumber>
          {e.totals.pendingPaise > 0 ? (
            <p className="text-sm text-background/75">
              <Price own paise={e.totals.pendingPaise} /> still to come across your projects.
            </p>
          ) : (
            <p className="text-sm text-background/75">Nothing pending — you&apos;re paid up.</p>
          )}
          {projects.length > 0 && (
            <ul className="space-y-2.5 border-t border-background/15 pt-3">
              {projects.map((p) => (
                <li key={p.projectId} className="flex items-center gap-3 text-sm">
                  <FillJar size="sm" value={p.paidPaise} max={p.agreedPaise} className="border-background/30 bg-transparent" label={`${Math.round((p.paidPaise / p.agreedPaise) * 100)}% of your fee paid`} />
                  <Link href={`/projects/${p.projectId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {p.projectName}
                  </Link>
                  <span className="shrink-0 text-xs text-background/70">
                    <Price own compact paise={p.paidPaise} /> of <Price own compact paise={p.agreedPaise} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tile>
  );
}
