// Project page — the hero sentence and the Overview tab, in two honest variants.
//  OWNER: health rings, budget burn vs time, milestones with amounts, people snapshot.
//  Everyone else: where the project is (milestones without amounts), deadline, team, latest
//  updates and — only if they're on it — their own earnings jar.
'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ProjectMemberRole, Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { type Crumb } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Avatar,
  Bento,
  BurnBar,
  Hero,
  HeroFigure,
  HeroMark,
  HealthRing,
  journeyFromMilestones,
  Legend,
  MilestoneJourney,
  Price,
  Tile,
  type JourneyStep,
} from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { RecentUpdates } from '@/features/collab/project-collab';

import {
  deadlineInfo,
  isFinished,
  milestoneProgress,
  nextMilestone,
  pct,
  projectHealth,
  RING_COLORS,
  TONE_BADGE,
  TONE_TEXT,
} from '../project-signals';
import { useProjectBalance, type ProjectRow } from '../projects.hooks';
import { MyProjectEarnings } from './my-project-earnings';
import { PeoplePayments } from './people-payments';
import { ownerJourneySteps } from './project-money';
import { TeamFaces } from './team-faces';

type OpenTab = (tab: string) => void;
const shortDate = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

interface HeroShellProps {
  project: ProjectRow;
  crumbs: Crumb[];
  eyebrow: ReactNode;
  aside: ReactNode;
}

// ── Heroes ───────────────────────────────────────────────────────────────────────

export function OwnerProjectHero({ project: p, crumbs, eyebrow, aside }: HeroShellProps) {
  const balance = useProjectBalance(p._id);
  const b = balance.data;
  const cur = p.currency ?? 'INR';
  let sentence: ReactNode = p.name;
  let lede: ReactNode = p.description || undefined;

  if (b) {
    const h = projectHealth(p, b);
    const leftToPay = Math.max(0, h.agreedPaise - b.disbursedPaise);
    const toCollect = Math.max(0, b.invoicedPaise - b.collectedPaise);
    if (isFinished(p)) {
      sentence = (
        <>
          Completed — <HeroFigure><Price paise={b.collectedPaise} currency={cur} compact /></HeroFigure> collected
          {b.invoicedPaise > 0 && (
            <>
              {' '}of <Price paise={b.invoicedPaise} currency={cur} compact /> billed
            </>
          )}
          .
        </>
      );
      lede =
        leftToPay > 0 ? (
          <>
            <Price paise={leftToPay} currency={cur} /> is still owed to the team on this project.
          </>
        ) : (
          'Everyone on the team has been paid what was agreed.'
        );
    } else if (b.budgetPaise === 0 && h.agreedPaise === 0) {
      sentence = 'No budget or team fees yet.';
      lede = 'Add a budget in Edit and agreed fees under People & payments to see how this project is doing.';
    } else {
      const t = h.time;
      const timePart = !t
        ? 'No dates set'
        : t.elapsed >= 1
          ? 'Past the deadline'
          : t.elapsed < 0.03
            ? 'Just getting started'
            : t.elapsed >= 0.45 && t.elapsed <= 0.55
              ? 'Halfway through the time'
              : `${pct(t.elapsed)} through the time`;
      sentence = (
        <>
          {timePart}
          {h.spent !== null && (
            <>
              , <HeroFigure>{pct(h.spent)}</HeroFigure> of the {b.budgetPaise > 0 ? 'budget' : 'agreed fees'} paid out
            </>
          )}
          . {h.verdict.tone === 'bad' || h.verdict.tone === 'warn' ? <HeroMark>{h.verdict.label}</HeroMark> : h.verdict.label}
          {leftToPay > 0 ? (
            <>
              , with <Price paise={leftToPay} currency={cur} compact /> left to pay the team
            </>
          ) : toCollect > 0 ? (
            <>
              , with <Price paise={toCollect} currency={cur} compact /> still to collect
            </>
          ) : null}
          .
        </>
      );
      lede = (
        <>
          {b.budgetPaise > 0 ? (
            <>
              Billed <Price paise={b.invoicedPaise} currency={cur} /> of a <Price paise={b.budgetPaise} currency={cur} /> budget, collected{' '}
              <Price paise={b.collectedPaise} currency={cur} />.
            </>
          ) : (
            'No client budget set — burn is measured against agreed fees.'
          )}
        </>
      );
    }
  }

  return (
    <Hero pageTitle={p.name} crumbs={crumbs} eyebrow={eyebrow} aside={aside} loading={balance.isLoading} lede={lede}>
      {sentence}
    </Hero>
  );
}

export function StaffProjectHero({ project: p, crumbs, eyebrow, aside }: HeroShellProps) {
  const next = nextMilestone(p);
  const progress = milestoneProgress(p);
  const dl = deadlineInfo(p);
  const mine = p.myEngagement;
  let sentence: ReactNode;
  if (isFinished(p)) sentence = 'This project is complete. Nice work.';
  else if (dl.days !== undefined && dl.days < 0)
    sentence = (
      <>
        {p.name} is <HeroMark>{plural(-dl.days, 'day')} past its deadline</HeroMark>.
      </>
    );
  else if (next)
    sentence = (
      <>
        <HeroFigure>{next.name}</HeroFigure> is next
        {p.endDate && dl.days !== undefined ? (
          <>
            {' '}— the deadline is {shortDate(p.endDate)}, {dl.days === 0 ? 'today' : `${plural(dl.days, 'day')} away`}.
          </>
        ) : (
          '.'
        )}
      </>
    );
  else if (p.endDate && dl.days !== undefined)
    sentence = (
      <>
        Due <HeroFigure>{shortDate(p.endDate)}</HeroFigure> — {dl.days === 0 ? 'that’s today' : `${plural(dl.days, 'day')} to go`}.
      </>
    );
  else sentence = <>{p.name} is under way. No deadline set yet.</>;

  const lede = (
    <>
      {progress.total > 0 ? `${progress.done} of ${plural(progress.total, 'milestone')} reached. ` : ''}
      {mine && mine.agreedPaise > 0 ? (
        mine.pendingPaise > 0 ? (
          <>
            <Price own paise={mine.pendingPaise} currency={mine.currency} compact className="font-semibold text-foreground" /> of your{' '}
            <Price own paise={mine.agreedPaise} currency={mine.currency} compact /> fee is still to come.
          </>
        ) : (
          'Your fee here is fully paid.'
        )
      ) : (
        p.description || ''
      )}
    </>
  );

  return (
    <Hero pageTitle={p.name} crumbs={crumbs} eyebrow={eyebrow} aside={aside} lede={lede}>
      {sentence}
    </Hero>
  );
}

// ── Overview: owner ──────────────────────────────────────────────────────────────

export function OwnerProjectOverview({ project: p, onOpenTab }: { project: ProjectRow; onOpenTab: OpenTab }) {
  const balance = useProjectBalance(p._id);
  const b = balance.data;
  const h = b ? projectHealth(p, b) : null;
  const cur = p.currency ?? 'INR';

  return (
    <div className="space-y-3.5">
      <Bento>
        <Tile span={4} bodyClassName="grid justify-items-center gap-3" title="Health">
          {h ? (
            <>
              <HealthRing
                rings={h.rings}
                size={176}
                center={
                  <div>
                    <div className="font-display text-3xl font-bold leading-none">{h.spent !== null ? pct(h.spent) : pct(h.billedShare)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{h.spent !== null ? 'budget used' : 'billed'}</div>
                  </div>
                }
              />
              <Legend
                className="justify-center"
                items={[
                  { color: RING_COLORS.billed, label: `Billed ${pct(h.billedShare)}` },
                  { color: RING_COLORS.collected, label: `Collected ${pct(h.collectedShare)}` },
                  { color: RING_COLORS.paidOut, label: `Paid out ${pct(h.paidOutShare)}` },
                ]}
              />
            </>
          ) : balance.isError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Couldn&apos;t load the figures for this project.</p>
          ) : (
            <Skeleton className="h-[176px] w-[176px] rounded-full" />
          )}
        </Tile>

        <Tile span={8} title="Budget burn vs time" action={h && <Badge variant={TONE_BADGE[h.verdict.tone]}>{h.verdict.label}</Badge>}>
          {!h || !b ? (
            <Skeleton className="h-16 w-full" />
          ) : h.time && h.spent !== null ? (
            <>
              <BurnBar spent={h.spent} elapsed={h.time.elapsed} />
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {b.budgetPaise > 0 ? 'Budget' : 'Agreed fees'} <Price paise={b.budgetPaise > 0 ? b.budgetPaise : h.agreedPaise} currency={cur} className="text-foreground" />
                </span>
                <span>
                  Today · day {h.time.day} of {h.time.days}
                </span>
                <span>{pct(h.spent)} paid out</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {!h.time ? 'Add a start date and deadline in Edit to compare spending with time.' : 'Set a budget or agreed fees to measure burn.'}
            </p>
          )}

          <h3 className="mb-2 mt-6 text-[13px] font-semibold text-muted-foreground">Milestones</h3>
          {p.milestones.length > 0 ? (
            <MilestoneJourney steps={ownerJourneySteps(p)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
              No billing milestones yet.
              <Button size="sm" variant="outline" onClick={() => onOpenTab('billing')}>
                Plan milestones
              </Button>
            </div>
          )}
        </Tile>

        <PeoplePayments project={p} compact onManage={() => onOpenTab('people')} />

        <BriefTile project={p} />
        <FactsTile project={p} isOwner />
      </Bento>
    </div>
  );
}

// ── Overview: staff ──────────────────────────────────────────────────────────────

function staffJourneySteps(p: ProjectRow): JourneyStep[] {
  return journeyFromMilestones(p.milestones ?? []).map(({ item: m, state }) => ({
    key: m._id,
    title: m.name,
    state,
    caption: state === 'done' ? 'Reached' : m.dueDate ? `${state === 'now' ? 'Due' : 'From'} ${shortDate(m.dueDate)}` : state === 'now' ? 'In progress' : 'Later',
  }));
}

export function StaffProjectOverview({ project: p, onOpenTab }: { project: ProjectRow; onOpenTab: OpenTab }) {
  const progress = milestoneProgress(p);
  const dl = deadlineInfo(p);
  const mine = p.myEngagement;
  const hasEarnings = !!mine && (mine.agreedPaise > 0 || mine.paidPaise > 0);
  return (
    <Bento>
      <Tile span={hasEarnings ? 8 : 12} title="Where the project is" action={<span className={cn('text-xs font-medium', TONE_TEXT[dl.tone])}>{dl.label}</span>}>
        {progress.total > 0 ? (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-display text-2xl font-bold">{progress.pct}%</span>
              <span className="text-xs text-muted-foreground">
                {progress.done} of {plural(progress.total, 'milestone')} reached
              </span>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Milestones reached">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress.pct}%`, background: identityColor(p._id) }} />
            </div>
            <MilestoneJourney steps={staffJourneySteps(p)} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No milestones planned yet. The project lead will add them as the plan takes shape.</p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {p.startDate ? formatDate(p.startDate) : 'Start not set'} → {p.endDate ? formatDate(p.endDate) : 'no deadline'}
        </p>
      </Tile>
      {hasEarnings && mine && <MyProjectEarnings engagement={mine} span={4} />}

      <BriefTile project={p} />
      <TeamTile project={p} onOpenTab={onOpenTab} />

      <Tile span={12} title="Latest updates">
        <RecentUpdates projectId={p._id} onOpenAll={() => onOpenTab('updates')} />
      </Tile>
    </Bento>
  );
}

// ── Shared tiles ─────────────────────────────────────────────────────────────────

function BriefTile({ project: p }: { project: ProjectRow }) {
  return (
    <Tile span={7} title="Brief">
      {p.brief ? <p className="whitespace-pre-line text-sm leading-relaxed">{p.brief}</p> : <p className="text-sm text-muted-foreground">No brief yet.</p>}
    </Tile>
  );
}

function FactsTile({ project: p, isOwner }: { project: ProjectRow; isOwner: boolean }) {
  const clients = useClients(undefined, { enabled: isOwner && !!p.clientId });
  const client = isOwner && p.clientId ? clients.data?.find((c) => c._id === p.clientId) : undefined;
  const lead = p.members.find((m) => m.role === ProjectMemberRole.LEAD);
  return (
    <Tile span={5} title="Details">
      <div className="space-y-3 text-sm">
        {isOwner && (
          <Fact label="Client">
            {p.clientId ? (
              <Link href={`/clients/${p.clientId}`} className="font-medium hover:underline">
                {client?.name ?? (clients.isLoading ? 'Loading…' : 'Deleted client')}
              </Link>
            ) : (
              <span className="text-muted-foreground">Internal project</span>
            )}
          </Fact>
        )}
        <Fact label="Dates">
          {p.startDate || p.endDate ? (
            <span>
              {p.startDate ? formatDate(p.startDate) : 'Not set'} → {p.endDate ? formatDate(p.endDate) : 'Ongoing'}
            </span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </Fact>
        <Fact label="Lead">
          {lead ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar id={lead.userId} name={lead.name} size="xs" /> {lead.name ?? 'Team member'}
            </span>
          ) : (
            <span className="text-muted-foreground">No lead</span>
          )}
        </Fact>
        <Fact label="Team">
          <span className="inline-flex items-center gap-2">
            <TeamFaces members={p.members} size="xs" max={5} />
            <span>
              {plural(p.members.length, 'person', 'people')}
              {isOwner && p.freelancers?.length ? ` + ${plural(p.freelancers.length, 'freelancer')}` : ''}
            </span>
          </span>
        </Fact>
        {isOwner && p.clientId && (
          <Fact label="Client portal">{p.portalVisible === false ? <span className="text-muted-foreground">Hidden</span> : 'Visible to client'}</Fact>
        )}
      </div>
    </Tile>
  );
}

function TeamTile({ project: p, onOpenTab }: { project: ProjectRow; onOpenTab: OpenTab }) {
  const me = useAuthStore((s) => s.user);
  const canBrowse = me?.role === Role.OWNER || me?.role === Role.ADMIN || me?.role === Role.LEAD;
  const shown = p.members.slice(0, 6);
  return (
    <Tile
      span={5}
      title={`Team · ${p.members.length}`}
      action={
        <Button variant="ghost" size="sm" onClick={() => onOpenTab('team')}>
          {canBrowse ? 'Manage' : 'See all'}
        </Button>
      }
    >
      {p.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one on this project yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((m) => {
            const name = m.name ?? (m.userId === me?.id ? me?.name : undefined) ?? 'Team member';
            return (
              <li key={m.userId} className="flex items-center gap-2.5 text-sm">
                <Avatar id={m.userId} name={name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {name}
                  {m.userId === me?.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{m.role.charAt(0) + m.role.slice(1).toLowerCase()}</span>
              </li>
            );
          })}
          {p.members.length > shown.length && <li className="text-xs text-muted-foreground">+{p.members.length - shown.length} more</li>}
        </ul>
      )}
    </Tile>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
