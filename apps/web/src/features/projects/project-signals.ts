// Project signals — non-money and money read-outs derived from a project, shared by the projects
// board, the project page and the client page. Money helpers take the OWNER-only balance; staff
// helpers only use fields every role receives (dates, milestone states, team).
import { ProjectStatus } from '@agency/shared';

import { todayLocal } from '@/lib/form';

import { burnVerdict, type RingValue } from '@/components/viz';

import type { ProjectBalance, ProjectRow } from './projects.hooks';

const DAY = 86_400_000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00`);

export const isFinished = (p: Pick<ProjectRow, 'status'>) => p.status === ProjectStatus.COMPLETED;
/** In play: not completed and not on hold. */
export const isLive = (p: Pick<ProjectRow, 'status'>) => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ON_HOLD;

/** Whole days from today (local) to a date; negative when it has passed. */
export function daysUntil(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  return Math.round((dayOf(iso) - dayOf(todayLocal())) / DAY);
}

/** Share of the start→deadline window that has passed. Null without both dates. */
export function timeShare(p: Pick<ProjectRow, 'startDate' | 'endDate'>): { elapsed: number; day: number; days: number } | null {
  if (!p.startDate || !p.endDate) return null;
  const start = dayOf(p.startDate);
  const end = dayOf(p.endDate);
  if (!(end > start)) return null;
  const now = dayOf(todayLocal());
  const days = Math.max(1, Math.round((end - start) / DAY));
  const day = Math.min(days, Math.max(0, Math.round((now - start) / DAY)));
  return { elapsed: clamp01((now - start) / (end - start)), day, days };
}

export type Tone = 'good' | 'warn' | 'bad' | 'muted';

/** "Due in 5 days" / "3 days late" / "Completed". */
export function deadlineInfo(p: Pick<ProjectRow, 'status' | 'endDate'>): { label: string; tone: Tone; days?: number } {
  if (isFinished(p)) return { label: 'Completed', tone: 'good' };
  const d = daysUntil(p.endDate);
  if (d === undefined) return { label: 'No deadline set', tone: 'muted' };
  if (d < 0) return { label: `${-d} day${d === -1 ? '' : 's'} past deadline`, tone: 'bad', days: d };
  if (d === 0) return { label: 'Due today', tone: 'warn', days: d };
  if (d <= 7) return { label: `Due in ${d} day${d === 1 ? '' : 's'}`, tone: 'warn', days: d };
  return { label: `Due in ${d} days`, tone: 'muted', days: d };
}

/** Milestones reached (invoiced or collected) out of all — a progress signal everyone may see. */
export function milestoneProgress(p: Pick<ProjectRow, 'milestones'>): { done: number; total: number; pct: number } {
  const total = p.milestones?.length ?? 0;
  const done = (p.milestones ?? []).filter((m) => m.status !== 'PENDING').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function overdueMilestones(p: Pick<ProjectRow, 'milestones'>) {
  const today = todayLocal();
  return (p.milestones ?? []).filter((m) => m.status === 'PENDING' && m.dueDate && m.dueDate.slice(0, 10) < today);
}

/** Next milestone not reached yet. */
export function nextMilestone(p: Pick<ProjectRow, 'milestones'>) {
  return (p.milestones ?? []).find((m) => m.status === 'PENDING');
}

/** OWNER data: everything agreed with team and freelancers. */
export function agreedCost(p: ProjectRow): number {
  return p.members.reduce((s, m) => s + (m.amountPaise ?? 0), 0) + (p.freelancers ?? []).reduce((s, f) => s + (f.agreedPaise ?? 0), 0);
}

/** Why a project needs a look. Owner reasons may mention the budget; staff reasons never do. */
export function attentionReasons(p: ProjectRow, isOwner: boolean): string[] {
  if (!isLive(p)) return [];
  const out: string[] = [];
  const d = daysUntil(p.endDate);
  if (d !== undefined && d < 0) out.push('Past its deadline');
  const late = overdueMilestones(p);
  if (late.length) out.push(isOwner ? `${late.length} milestone${late.length === 1 ? '' : 's'} due and not billed` : `${late.length} milestone${late.length === 1 ? '' : 's'} past due`);
  if (isOwner && (p.clientBudgetPaise ?? 0) > 0 && agreedCost(p) > (p.clientBudgetPaise ?? 0)) out.push('Agreed fees exceed the budget');
  return out;
}

export const TONE_BADGE: Record<Tone, 'success' | 'warning' | 'danger' | 'muted'> = {
  good: 'success',
  warn: 'warning',
  bad: 'danger',
  muted: 'muted',
};
export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
  muted: 'text-muted-foreground',
};

export const RING_COLORS = {
  billed: 'hsl(var(--info))',
  collected: 'hsl(var(--success))',
  paidOut: 'hsl(var(--primary))',
} as const;

export interface ProjectHealth {
  rings: RingValue[];
  billedShare: number;
  collectedShare: number;
  paidOutShare: number;
  agreedPaise: number;
  /** Paid out ÷ budget (or ÷ agreed fees when there's no budget). Null when neither is set. */
  spent: number | null;
  time: ReturnType<typeof timeShare>;
  verdict: { label: string; tone: Exclude<Tone, 'muted'> | 'muted' };
}

/** OWNER only — reads the project balance. */
export function projectHealth(p: ProjectRow, b: ProjectBalance): ProjectHealth {
  const agreed = b.teamAgreedPaise + b.freelancerAgreedPaise;
  const billedShare = b.budgetPaise > 0 ? b.invoicedPaise / b.budgetPaise : 0;
  const collectedShare = b.invoicedPaise > 0 ? b.collectedPaise / b.invoicedPaise : 0;
  const paidOutShare = agreed > 0 ? b.disbursedPaise / agreed : b.disbursedPaise > 0 ? 1 : 0;
  const base = b.budgetPaise > 0 ? b.budgetPaise : agreed;
  const spent = base > 0 ? b.disbursedPaise / base : null;
  const time = timeShare(p);

  let verdict: ProjectHealth['verdict'];
  if (isFinished(p)) {
    verdict = b.invoicedPaise > 0 && b.collectedPaise >= b.invoicedPaise ? { label: 'Wrapped up and paid', tone: 'good' } : { label: 'Completed', tone: 'muted' };
  } else if (agreed > 0 && b.disbursedPaise > agreed) {
    verdict = { label: 'Paid over agreed fees', tone: 'bad' };
  } else if (spent !== null && (time || spent > 1)) {
    const v = burnVerdict(spent, time?.elapsed ?? 1);
    verdict = { label: v.label, tone: v.tone };
    if (v.tone === 'good' && time && b.budgetPaise > 0 && billedShare < time.elapsed - 0.2) verdict = { label: 'Behind on billing', tone: 'warn' };
    else if (v.tone === 'good' && b.disbursedPaise > b.collectedPaise && b.disbursedPaise > 0) verdict = { label: 'Paid out more than collected', tone: 'warn' };
  } else if (b.budgetPaise === 0 && agreed === 0) {
    verdict = { label: 'No budget or fees yet', tone: 'muted' };
  } else {
    verdict = { label: time ? 'On track' : 'Add dates to track burn', tone: time ? 'good' : 'muted' };
  }

  return {
    rings: [
      { value: billedShare, color: RING_COLORS.billed, label: 'Billed of budget' },
      { value: collectedShare, color: RING_COLORS.collected, label: 'Collected of billed' },
      { value: paidOutShare, color: RING_COLORS.paidOut, label: 'Paid out of agreed fees' },
    ],
    billedShare,
    collectedShare,
    paidOutShare,
    agreedPaise: agreed,
    spent,
    time,
    verdict,
  };
}

export const pct = (share: number) => `${Math.round(share * 100)}%`;
