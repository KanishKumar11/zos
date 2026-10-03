// Delivery helpers shared by the role homes: project deadlines, milestone progress and who is on
// what. Dates, names and counts only — never money (milestone amounts are not read here).
import { ProjectStatus } from '@agency/shared';

import type { MilestoneRow, ProjectRow } from '@/features/projects/projects.hooks';

/** Projects someone is actually working on right now (not finished, not paused). */
export const isActiveProject = (p: Pick<ProjectRow, 'status'>): boolean =>
  p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ON_HOLD;

/** Milestone and project dates are calendar dates (stored at midnight UTC) — read the date part as-is. */
export const dateKey = (iso?: string | null): string | undefined => (iso ? iso.slice(0, 10) : undefined);

export interface DeliveryDate {
  date: string; // yyyy-mm-dd
  kind: 'milestone' | 'project';
  /** Milestone name, or "<project> is due" for a project end date. */
  title: string;
  project: ProjectRow;
  milestone?: MilestoneRow;
}

/**
 * Upcoming delivery dates on unfinished projects: pending milestone due dates and project end dates,
 * optionally limited to a yyyy-mm-dd range (inclusive). Sorted by date.
 */
export function deliveryDates(projects: ProjectRow[], range: { from?: string; to?: string } = {}): DeliveryDate[] {
  const inRange = (k: string) => (!range.from || k >= range.from) && (!range.to || k <= range.to);
  const out: DeliveryDate[] = [];
  for (const p of projects) {
    if (p.status === ProjectStatus.COMPLETED) continue;
    for (const m of p.milestones ?? []) {
      const k = dateKey(m.dueDate);
      if (k && m.status === 'PENDING' && inRange(k)) out.push({ date: k, kind: 'milestone', title: m.name, project: p, milestone: m });
    }
    const end = dateKey(p.endDate);
    if (end && inRange(end)) out.push({ date: end, kind: 'project', title: `${p.name} is due`, project: p });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'milestone' ? -1 : 1));
}

/** The next milestone still to be delivered: earliest dated pending one, then undated in list order. */
export function nextMilestone(p: Pick<ProjectRow, 'milestones'>): MilestoneRow | undefined {
  const pending = (p.milestones ?? []).filter((m) => m.status === 'PENDING');
  const dated = pending.filter((m) => m.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  return dated[0] ?? pending[0];
}

/** Milestones delivered so far (anything past PENDING), out of all milestones. */
export function milestoneProgress(p: Pick<ProjectRow, 'milestones'>): { done: number; total: number } {
  const all = p.milestones ?? [];
  return { done: all.filter((m) => m.status !== 'PENDING').length, total: all.length };
}

/**
 * Plain relative day for sentences: "today", "tomorrow", "yesterday", "Friday" (within a week),
 * otherwise "on 12 Oct". Reads naturally after "is due" / "was due".
 */
export function relativeDay(key: string, today: string): string {
  const d = new Date(`${key}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (Math.abs(days) < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return `on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** Members who have left a project keep their row with `leftAt` set; they're no longer on it. */
const stillOn = (m: ProjectRow['members'][number]): boolean => !(m as { leftAt?: string | null }).leftAt;

/** Whether this person is currently a member of the project. */
export const isOnProject = (p: Pick<ProjectRow, 'members'>, userId: string | undefined): boolean =>
  !!userId && (p.members ?? []).some((m) => m.userId === userId && stillOn(m));

/** Active projects per person (by user id), from current project memberships. */
export function activeProjectsByPerson(projects: ProjectRow[]): Map<string, ProjectRow[]> {
  const map = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    if (!isActiveProject(p)) continue;
    for (const m of (p.members ?? []).filter(stillOn)) {
      const list = map.get(m.userId);
      if (list) {
        if (!list.includes(p)) list.push(p);
      } else map.set(m.userId, [p]);
    }
  }
  return map;
}
