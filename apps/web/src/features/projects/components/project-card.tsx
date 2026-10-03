// Project cards for the projects board. Two honest variants:
//  - OwnerProjectCard: health rings (billed · collected · paid out), burn verdict, budget.
//  - StaffProjectCard: milestone progress, deadline, team, and only the viewer's own fee.
'use client';

import { AlertTriangle, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { identityColor } from '@/lib/identity';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { FillJar, HealthRing, Price, ProjectChip } from '@/components/viz';

import {
  attentionReasons,
  deadlineInfo,
  milestoneProgress,
  nextMilestone,
  pct,
  projectHealth,
  TONE_BADGE,
  TONE_TEXT,
} from '../project-signals';
import { useProjectBalance, type ProjectBalance, type ProjectRow } from '../projects.hooks';
import { TeamFaces } from './team-faces';

function CardShell({ project, children }: { project: ProjectRow; children: ReactNode }) {
  return (
    <Link
      href={`/projects/${project._id}`}
      className="group relative block min-w-0 animate-rise overflow-hidden rounded-[var(--radius)] border bg-card p-4 outline-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: identityColor(project._id) }} aria-hidden />
      {children}
    </Link>
  );
}

function Deadline({ project }: { project: ProjectRow }) {
  const dl = deadlineInfo(project);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', TONE_TEXT[dl.tone], dl.tone === 'bad' && 'font-medium')}>
      <CalendarClock className="h-3.5 w-3.5" /> {dl.label}
    </span>
  );
}

export function OwnerProjectCard({
  project: p,
  clientName,
  balance: batched,
  batchState,
}: {
  project: ProjectRow;
  clientName?: string;
  /** From the page's batched `useProjectBalances`; the card only fetches on its own without it. */
  balance?: ProjectBalance;
  batchState?: 'loading' | 'error' | 'ready';
}) {
  const own = useProjectBalance(p._id, { enabled: batchState === undefined || (batchState === 'ready' && !batched) });
  const data = batched ?? own.data;
  const balance = { data, isError: batchState === 'error' || (!data && own.isError) };
  const health = balance.data ? projectHealth(p, balance.data) : null;
  const reasons = attentionReasons(p, true);
  return (
    <CardShell project={p}>
      <div className="flex items-start gap-3.5 pt-1">
        {health ? (
          <HealthRing rings={health.rings} size={74} />
        ) : balance.isError ? (
          <span className="grid h-[74px] w-[74px] shrink-0 place-items-center rounded-full border border-dashed text-center text-[10px] text-muted-foreground">
            No figures
          </span>
        ) : (
          <Skeleton className="h-[74px] w-[74px] shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <ProjectChip id={p._id} name={p.name} className="max-w-full text-[15px] font-semibold" />
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-figures">{p.code}</span> · {p.clientId ? (clientName ?? 'Deleted client') : 'Internal'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {health ? <Badge variant={TONE_BADGE[health.verdict.tone]}>{health.verdict.label}</Badge> : <Skeleton className="h-5 w-24" />}
            {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
          </div>
          {health && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {health.time ? `Time ${pct(health.time.elapsed)}` : 'No dates'} · billed {pct(health.billedShare)} · paid out {pct(health.paidOutShare)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t pt-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {p.clientBudgetPaise ? (
              <>
                Budget <Price paise={p.clientBudgetPaise} currency={p.currency ?? 'INR'} compact className="font-semibold text-foreground" />
              </>
            ) : (
              'No budget set'
            )}
          </p>
          <Deadline project={p} />
        </div>
        <TeamFaces members={p.members} />
      </div>
      {reasons.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {reasons.join(' · ')}
        </p>
      )}
    </CardShell>
  );
}

export function StaffProjectCard({ project: p }: { project: ProjectRow }) {
  const progress = milestoneProgress(p);
  const next = nextMilestone(p);
  const reasons = attentionReasons(p, false);
  const mine = p.myEngagement;
  return (
    <CardShell project={p}>
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <ProjectChip id={p._id} name={p.name} className="max-w-full text-[15px] font-semibold" />
          <p className="mt-0.5 font-figures text-xs text-muted-foreground">{p.code}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="mt-3.5">
        {progress.total > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{next ? `Next: ${next.name}` : 'All milestones reached'}</span>
              <span className="font-figures font-semibold">{progress.pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Milestones reached">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress.pct}%`, background: identityColor(p._id) }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {progress.done} of {progress.total} milestone{progress.total === 1 ? '' : 's'} reached
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No milestones planned yet.</p>
        )}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t pt-3">
        <Deadline project={p} />
        <TeamFaces members={p.members} />
      </div>

      {mine && mine.agreedPaise > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-brand-wash px-3 py-2">
          <FillJar value={mine.paidPaise} max={mine.agreedPaise} size="sm" label={`${Math.round((mine.paidPaise / mine.agreedPaise) * 100)}% of your fee received`} />
          <div className="min-w-0 text-xs">
            <p>
              Your fee <Price own paise={mine.agreedPaise} currency={mine.currency} compact className="font-semibold" />
            </p>
            <p className="text-muted-foreground">
              {mine.pendingPaise > 0 ? (
                <>
                  <Price own paise={mine.pendingPaise} currency={mine.currency} compact /> still to come
                </>
              ) : (
                'Fully paid'
              )}
            </p>
          </div>
        </div>
      )}

      {reasons.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {reasons.join(' · ')}
        </p>
      )}
    </CardShell>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border bg-card p-4">
      <div className="flex gap-3.5">
        <Skeleton className="h-[74px] w-[74px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <Skeleton className="mt-4 h-8 w-full" />
    </div>
  );
}
