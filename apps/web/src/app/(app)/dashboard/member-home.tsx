// Team member home — "my day": my projects and what's due on them, my week, and my own earnings.
// Never shows project money. Every amount here is the viewer's own pay, so it goes through <Price own>.
//
// Tasks are behind FEATURES.tasks: when the flag is off nothing here calls the tasks API or links to
// /tasks. `useMyTasks` has no `enabled` option, so it is only called from <MemberHomeWithTasks>, which
// renders only when the flag is on.
'use client';

import { ArrowRight, Megaphone, Pin, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PAYOUT_CATEGORY_LABEL, PAYOUT_METHOD_LABEL, ProjectStatus, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { FEATURES } from '@/lib/features';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Bento,
  BigNumber,
  FillJar,
  Hero,
  HeroFigure,
  HeroMark,
  Legend,
  Price,
  PrivacyChip,
  ProjectChip,
  Tile,
  WeekStrip,
  type WeekDot,
} from '@/components/viz';
import { useAnnouncements } from '@/features/notifications/notifications.hooks';
import { useMyEarnings, type MyEarnings } from '@/features/payouts/payouts.hooks';
import { useAllProjects, type ProjectRow } from '@/features/projects/projects.hooks';
import { useMyTasks, type TaskRow } from '@/features/tasks/tasks.hooks';
import { dateKey, deliveryDates, isActiveProject, isOnProject, milestoneProgress, nextMilestone, relativeDay } from '@/features/team/delivery';
import { thisWeekRange } from '@/features/team/people';

import { greeting } from './greeting';

/** Task due dates are calendar dates (stored at midnight UTC) — read the date part as-is. */
const dayKey = (iso: string) => iso.slice(0, 10);
/** Payments are moments in time — bucket them by the viewer's local day. */
const localDay = (iso: string) => toLocalDateInput(iso);
const shortDay = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const MILESTONE_LEGEND = 'hsl(var(--p2))';
const DEADLINE_COLOR = 'hsl(var(--destructive))';
const PAID_COLOR = 'hsl(var(--success))';

type MyTasksQuery = ReturnType<typeof useMyTasks>;

/** Team member home — my day, my work, my own earnings. */
export function MemberHome() {
  // FEATURES is a constant, so this branch never changes between renders (hook order stays stable).
  return FEATURES.tasks ? <MemberHomeWithTasks /> : <MemberHomeView />;
}

/** Only rendered when FEATURES.tasks is on — the one place this page calls the tasks API. */
function MemberHomeWithTasks() {
  const tasks = useMyTasks();
  return <MemberHomeView tasks={tasks} />;
}

function MemberHomeView({ tasks }: { tasks?: MyTasksQuery }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];
  const earnings = useMyEarnings();
  const projects = useAllProjects();
  const announcements = useAnnouncements();
  const [selected, setSelected] = useState<string | undefined>();

  const today = todayLocal();
  const week = thisWeekRange();

  // My projects. The API already scopes the list to projects I'm on; this also drops ones I've left.
  const mine = useMemo(() => {
    const items = projects.data?.items ?? [];
    return user?.id ? items.filter((p) => isOnProject(p, user.id)) : items;
  }, [projects.data, user?.id]);
  const active = mine.filter(isActiveProject);
  const onHold = mine.filter((p) => p.status === ProjectStatus.ON_HOLD);
  const nextDue = deliveryDates(active, { from: today })[0];
  const lateMilestones = deliveryDates(active, { to: today }).filter((d) => d.kind === 'milestone' && d.date < today);
  const weekDates = deliveryDates(mine, week);

  // Tasks (only when the flag is on and the wrapper passed the query in).
  const open = (tasks?.data ?? []).filter((t) => t.status !== TaskStatus.DONE);
  const overdue = open.filter((t) => t.dueDate && dayKey(t.dueDate) < today);
  const dueToday = open.filter((t) => t.dueDate && dayKey(t.dueDate) === today);
  const todayCount = dueToday.length + overdue.length;
  const projectName = new Map((projects.data?.items ?? []).map((p) => [p._id, p.name]));
  const nameOf = (id: string) => projectName.get(id) ?? (projects.isLoading || projects.isError ? 'Project' : 'Project no longer available');

  const e = earnings.data;
  const pendingProjects = (e?.projects ?? []).filter((p) => p.pendingPaise > 0).sort((a, b) => b.pendingPaise - a.pendingPaise);
  const nextPay = pendingProjects[0];

  // Week dots: milestones (project colour), project deadlines, payments received, and tasks when on.
  const dots: WeekDot[] = [
    ...weekDates.map((d) => ({ date: d.date, color: d.kind === 'milestone' ? identityColor(d.project._id) : DEADLINE_COLOR, title: d.title })),
    ...(e?.payouts ?? []).map((p) => ({ date: localDay(p.paidAt), color: PAID_COLOR, title: 'Payment received' })),
    ...open.filter((t) => t.dueDate).map((t) => ({ date: dayKey(t.dueDate!), color: identityColor(t.projectId), title: t.title })),
  ];

  // Under the strip: the chosen day, or what's still coming up this week.
  const dayDates = selected ? weekDates.filter((d) => d.date === selected) : weekDates.filter((d) => d.date >= today).slice(0, 6);
  const paidOnSelected = selected ? (e?.payouts ?? []).filter((p) => localDay(p.paidAt) === selected) : [];

  // Task focus list (tasks flag only).
  const focus = selected
    ? open.filter((t) => t.dueDate && dayKey(t.dueDate) === selected)
    : [
        ...[...overdue].sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)),
        ...dueToday,
        ...open.filter((t) => !t.dueDate || dayKey(t.dueDate) > today).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')),
      ].slice(0, 7);

  const ledeParts = [
    lateMilestones.length > 1
      ? `${plural(lateMilestones.length, 'milestone')} on your projects are past their due dates.`
      : lateMilestones[0]
        ? `${lateMilestones[0].title} on ${lateMilestones[0].project.name} is past its due date.`
        : '',
    onHold.length ? `${plural(onHold.length, 'project')} on hold.` : '',
    tasks && open.length ? `${plural(open.length, 'open task')} in all.` : '',
    dots.length ? 'Tap a day below to see what falls on it.' : '',
  ];

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="Home"
        loading={projects.isLoading || !!tasks?.isLoading}
        eyebrow={`${firstName ? `${firstName}'s day` : 'Your day'} · ${new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}`}
        aside={<PrivacyChip>Shows only your own pay</PrivacyChip>}
        lede={ledeParts.filter(Boolean).join(' ') || undefined}
      >
        {greeting()}
        {firstName ? `, ${firstName}` : ''}.{' '}
        {projects.isError ? null : active.length === 0 ? (
          mine.length === 0 ? (
            <>You&rsquo;re not on any projects yet.</>
          ) : (
            <>None of your projects are active right now.</>
          )
        ) : (
          <>
            You&rsquo;re on <HeroFigure>{plural(active.length, 'active project')}</HeroFigure>
            {nextDue ? (
              <>
                {' '}
                — <HeroMark>{nextDue.kind === 'milestone' ? `${nextDue.title} on ${nextDue.project.name}` : nextDue.project.name}</HeroMark> is due{' '}
                {relativeDay(nextDue.date, today)}.
              </>
            ) : (
              <>, with no dates coming up.</>
            )}
          </>
        )}
        {tasks && !tasks.isError && todayCount > 0 && (
          <>
            {' '}
            <HeroFigure>{plural(todayCount, 'task')}</HeroFigure> for today{overdue.length > 0 ? `, ${overdue.length} overdue` : ''}.
          </>
        )}
        {nextPay && (
          <>
            {' '}
            <Price paise={nextPay.pendingPaise} own compact className="font-display" /> from {nextPay.projectId ? nextPay.projectName : 'other work'} is still to come.
          </>
        )}
      </Hero>

      <Bento>
        {/* This week */}
        <Tile
          span={12}
          title="This week"
          action={
            selected ? (
              <button type="button" onClick={() => setSelected(undefined)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Show all
              </button>
            ) : undefined
          }
        >
          {projects.isLoading || earnings.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                  <WeekStrip dots={dots} selected={selected} onSelect={(d) => setSelected((cur) => (cur === d ? undefined : d))} />
                </div>
              </div>
              <Legend
                items={[
                  { color: MILESTONE_LEGEND, label: FEATURES.tasks ? 'Milestone or task (project colour)' : 'Milestone (project colour)' },
                  { color: DEADLINE_COLOR, label: 'Project deadline' },
                  { color: PAID_COLOR, label: 'Payment received' },
                ]}
              />
              {projects.isError && (
                <p className="text-xs text-destructive">
                  Couldn&apos;t load your project dates.{' '}
                  <button type="button" className="underline" onClick={() => projects.refetch()}>
                    Try again
                  </button>
                </p>
              )}
              <div>
                <p className="mb-2 text-[13px] font-semibold">{selected ? (selected === today ? 'Today' : shortDay(selected)) : 'Coming up this week'}</p>
                {dayDates.length === 0 && paidOnSelected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {selected ? 'No milestones, deadlines or payments on this day.' : 'No milestones or deadlines for the rest of the week.'}
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {dayDates.map((d) => (
                      <li key={`${d.kind}-${d.project._id}-${d.milestone?._id ?? ''}`} className="flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.kind === 'milestone' ? identityColor(d.project._id) : DEADLINE_COLOR }} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/projects/${d.project._id}`} className="block truncate font-medium hover:underline">
                            {d.title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {d.kind === 'milestone' ? `Milestone · ${d.project.name}` : 'Project deadline'}
                            {selected ? '' : ` · ${d.date === today ? 'today' : shortDay(d.date)}`}
                          </p>
                        </div>
                      </li>
                    ))}
                    {paidOnSelected.map((p) => (
                      <li key={p._id} className="flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">Payment received{p.projectName ? ` · ${p.projectName}` : ''}</span>
                        <Price paise={p.amountPaise} currency={p.currency} own className="shrink-0 font-figures font-medium" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Tile>

        {/* My tasks — only with the tasks feature on (the query only exists then). */}
        {tasks && (
          <Tile
            span={7}
            title={selected ? (selected === today ? 'Tasks due today' : `Tasks due ${shortDay(selected)}`) : 'Focus'}
            action={
              <Link href="/tasks" className="text-xs font-medium text-brand hover:underline">
                All my tasks
              </Link>
            }
          >
            {tasks.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : tasks.isError ? (
              <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} className="py-6" />
            ) : focus.length === 0 ? (
              <EmptyState
                illustration="done"
                title={selected ? 'No tasks due that day' : "You're all clear"}
                description={selected ? undefined : 'No open tasks assigned to you.'}
                className="py-8"
              />
            ) : (
              <ul className="divide-y">
                {focus.map((t) => (
                  <FocusRow key={t._id} task={t} today={today} projectName={nameOf(t.projectId)} />
                ))}
              </ul>
            )}
          </Tile>
        )}
        {tasks && <NextPaymentTile earnings={e} loading={earnings.isLoading} error={earnings.error} onRetry={() => earnings.refetch()} />}

        {/* My projects */}
        <Tile
          span={7}
          title="My projects"
          action={
            mine.length > 0 ? (
              <Link href="/projects" className="text-xs font-medium text-brand hover:underline">
                All projects
              </Link>
            ) : undefined
          }
        >
          <MyProjects projects={mine} loading={projects.isLoading} error={projects.isError ? projects.error : null} onRetry={() => projects.refetch()} today={today} />
        </Tile>

        <Tile
          span={5}
          title="My earnings by project"
          action={
            <Link href="/earnings" className="text-xs font-medium text-brand hover:underline">
              Earnings
            </Link>
          }
        >
          <EarningsJars earnings={e} loading={earnings.isLoading} error={earnings.error} onRetry={() => earnings.refetch()} />
        </Tile>

        {!tasks && <NextPaymentTile earnings={e} loading={earnings.isLoading} error={earnings.error} onRetry={() => earnings.refetch()} />}

        <Tile
          span={tasks ? 12 : 7}
          title="Announcements"
          action={
            <Link href="/announcements" className="text-xs font-medium text-brand hover:underline">
              All
            </Link>
          }
        >
          {announcements.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : announcements.isError ? (
            <ErrorState error={announcements.error} onRetry={() => announcements.refetch()} className="py-6" />
          ) : (announcements.data ?? []).length === 0 ? (
            <EmptyState icon={Megaphone} title="Nothing new" description="Team news from the studio will show up here." className="py-6" />
          ) : (
            <ul className="divide-y">
              {announcements.data!.slice(0, 3).map((a) => (
                <li key={a._id}>
                  <Link href="/announcements" className="block py-2.5 first:pt-0 hover:opacity-80">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {a.pinned && <Pin className="h-3 w-3 shrink-0 text-brand" aria-label="Pinned" />}
                      <span className="truncate">{a.title}</span>
                    </p>
                    <p className="line-clamp-1 text-[13px] text-muted-foreground">{a.body}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.publishedAt ?? a.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        <Tile span={12} tone="ink">
          <ReceivedThisMonth earnings={e} loading={earnings.isLoading} />
        </Tile>
      </Bento>
    </div>
  );
}

/** Small date tag: "Overdue · 2 Oct", "Today", "Tomorrow", "Thu", "12 Dec". */
function DateTag({ k, today }: { k: string; today: string }) {
  const d = new Date(`${k}T00:00:00`);
  const days = Math.round((d.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  const short = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (days < 0) return <span className="font-medium text-destructive">Overdue · {short}</span>;
  if (days === 0) return <span className="font-medium text-warning">Today</span>;
  if (days === 1) return <span className="text-foreground">Tomorrow</span>;
  if (days < 7) return <span className="text-foreground">{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>;
  return <span className="text-foreground">{short}</span>;
}

/** Earliest thing still to happen on a project — sorts the list so the most pressing is first. */
const soonest = (p: ProjectRow): string => {
  const keys = [dateKey(nextMilestone(p)?.dueDate), dateKey(p.endDate)].filter((k): k is string => !!k).sort();
  return keys[0] ?? '9';
};

function MyProjects({
  projects,
  loading,
  error,
  onRetry,
  today,
}: {
  projects: ProjectRow[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  today: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;
  const current = projects
    .filter((p) => p.status !== ProjectStatus.COMPLETED)
    .sort((a, b) => Number(!isActiveProject(a)) - Number(!isActiveProject(b)) || soonest(a).localeCompare(soonest(b)));
  if (current.length === 0) {
    return (
      <EmptyState
        illustration="projects"
        title={projects.length === 0 ? "You're not on any projects yet" : 'All your projects are wrapped up'}
        description={
          projects.length === 0
            ? 'When someone adds you to a project, it shows up here with its next milestone and deadline.'
            : 'Finished projects stay on the projects page.'
        }
        className="py-8"
      />
    );
  }
  return (
    <ul className="divide-y">
      {current.slice(0, 5).map((p) => {
        const nm = nextMilestone(p);
        const nmKey = dateKey(nm?.dueDate);
        const end = dateKey(p.endDate);
        const { done, total } = milestoneProgress(p);
        return (
          <li key={p._id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2">
              <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} className="min-w-0 text-sm font-semibold" />
              <StatusBadge status={p.status} className="ml-auto shrink-0" />
            </div>
            <div className="mt-1.5 grid gap-x-4 gap-y-1 text-[13px] text-muted-foreground sm:grid-cols-2">
              <p className="min-w-0 truncate">
                Next:{' '}
                {nm ? (
                  <>
                    <span className="text-foreground">{nm.name}</span>
                    {nmKey && (
                      <>
                        {' · '}
                        <DateTag k={nmKey} today={today} />
                      </>
                    )}
                  </>
                ) : total > 0 ? (
                  'all milestones delivered'
                ) : (
                  'no milestones yet'
                )}
              </p>
              <p className="min-w-0 truncate">Deadline: {end ? <DateTag k={end} today={today} /> : 'no end date set'}</p>
            </div>
            {total > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={done} max={total} className="h-1" />
                <span className="shrink-0 font-figures text-[11px] text-muted-foreground">
                  {done}/{total} milestones
                </span>
              </div>
            )}
          </li>
        );
      })}
      {current.length > 5 && (
        <li className="pt-2.5 text-xs text-muted-foreground">
          And {current.length - 5} more on the{' '}
          <Link href="/projects" className="font-medium text-brand-ink hover:underline">
            projects page
          </Link>
          .
        </li>
      )}
    </ul>
  );
}

function NextPaymentTile({ earnings: e, loading, error, onRetry }: { earnings?: MyEarnings; loading: boolean; error: unknown; onRetry: () => void }) {
  const pendingProjects = (e?.projects ?? []).filter((p) => p.pendingPaise > 0).sort((a, b) => b.pendingPaise - a.pendingPaise);
  const nextPay = pendingProjects[0];
  return (
    <Tile span={5} tone="wash" title="Next expected payment">
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} className="py-4" />
      ) : !nextPay ? (
        <p className="text-sm text-muted-foreground">Nothing pending — you&rsquo;re paid up for all agreed work.</p>
      ) : (
        <div className="space-y-3">
          <BigNumber caption={<>from {nextPay.projectId ? nextPay.projectName : 'other work'} · still to come</>}>
            <Price paise={nextPay.pendingPaise} own className="font-display" />
          </BigNumber>
          {pendingProjects.length > 1 && (
            <p className="text-[13px] text-muted-foreground">
              <Price paise={e!.totals.pendingPaise} own /> pending in all, across {pendingProjects.length} projects.
            </p>
          )}
          <Link href="/earnings" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-ink hover:underline">
            See my earnings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Tile>
  );
}

function FocusRow({ task: t, today, projectName }: { task: TaskRow; today: string; projectName: string }) {
  const key = t.dueDate ? dayKey(t.dueDate) : undefined;
  const late = key !== undefined && key < today;
  const isToday = key === today;
  return (
    <li>
      <Link href={`/tasks/${t._id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
        <span className={cn('h-4 w-4 shrink-0 rounded-[5px] border-2', late ? 'border-destructive' : 'border-border')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{t.title}</span>
          <ProjectChip id={t.projectId} name={projectName} className="max-w-full text-xs text-muted-foreground" />
        </span>
        {late ? (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Overdue</span>
        ) : isToday ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">Today</span>
        ) : key ? (
          <span className="shrink-0 text-xs text-muted-foreground">{shortDay(key)}</span>
        ) : null}
      </Link>
    </li>
  );
}

function EarningsJars({ earnings: e, loading, error, onRetry }: { earnings?: MyEarnings; loading: boolean; error: unknown; onRetry: () => void }) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;
  const rows = (e?.projects ?? [])
    .filter((p) => p.projectId && (p.agreedPaise > 0 || p.paidPaise > 0))
    .sort((a, b) => b.pendingPaise - a.pendingPaise || b.agreedPaise - a.agreedPaise)
    .slice(0, 4);
  if (rows.length === 0) {
    return <EmptyState illustration="money" title="No earnings yet" description="When you're added to a project with an agreed fee, it fills up here." className="py-6" />;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Each jar fills as your agreed fee reaches you.</p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {rows.map((p) => {
          const done = p.agreedPaise > 0 && p.paidPaise >= p.agreedPaise;
          return (
            <li key={p.projectId} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <FillJar value={p.paidPaise} max={p.agreedPaise} size="lg" label={`${p.projectName}: ${p.agreedPaise > 0 ? Math.round((p.paidPaise / p.agreedPaise) * 100) : 100}% paid`} />
              <ProjectChip id={p.projectId!} name={p.projectName} href={`/projects/${p.projectId}`} className="max-w-full text-xs font-semibold" />
              <span className="text-[11px] text-muted-foreground">
                {done || p.agreedPaise === 0 ? (
                  <>
                    <Price paise={p.paidPaise} own compact /> paid
                  </>
                ) : (
                  <>
                    <Price paise={p.paidPaise} own compact /> of <Price paise={p.agreedPaise} own compact />
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReceivedThisMonth({ earnings: e, loading }: { earnings?: MyEarnings; loading: boolean }) {
  if (loading) return <Skeleton className="h-14 w-full bg-background/20" />;
  const last = [...(e?.payouts ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-[13px] font-semibold text-background/70">Received this month</h2>
        <div className="mt-1 font-display text-[2.4rem] font-bold leading-none text-brand">
          <Price paise={e?.totals.thisMonthPaise ?? 0} own className="font-display" />
        </div>
      </div>
      <p className="max-w-[44ch] text-sm text-background/75">
        {last ? (
          <>
            Last payment: <Price paise={last.amountPaise} currency={last.currency} own /> for {last.projectName ?? PAYOUT_CATEGORY_LABEL[last.category]} on{' '}
            {formatDate(last.paidAt, { day: 'numeric', month: 'short' })} · {PAYOUT_METHOD_LABEL[last.method] ?? 'Paid'}
            {last.reference ? ` (ref ${last.reference})` : ''}.
          </>
        ) : (
          'Your first payment will show up here as soon as it is logged.'
        )}
      </p>
      <Link href="/earnings" className="inline-flex items-center gap-1 text-[13px] font-medium text-background/90 hover:underline">
        My earnings <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
