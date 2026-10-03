// People helpers shared by the team pulse, the people grid and the member profile. No money here.
import { useQuery } from '@tanstack/react-query';

import { TaskStatus, canSignIn } from '@agency/shared';

import { toLocalDateInput } from '@/lib/form';

import { tasksApi, type TaskRow } from '@/features/tasks/tasks.hooks';

import type { UserRow } from './team.api';

/** Onboarding checklist progress, or null when the person has no checklist. */
export function onboardingProgress(u: Pick<UserRow, 'onboardingChecklist'>): { done: number; total: number; pct: number } | null {
  const items = u.onboardingChecklist ?? [];
  if (items.length === 0) return null;
  const done = items.filter((i) => i.completed).length;
  return { done, total: items.length, pct: done / items.length };
}

/** "2 yrs 3 mos", "5 months", "Joined this month". Undefined when there's no joining date. */
export function tenureLabel(dateOfJoining: string | null | undefined, now = new Date()): string | undefined {
  if (!dateOfJoining) return undefined;
  const start = new Date(dateOfJoining);
  if (Number.isNaN(start.getTime())) return undefined;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return 'Starts soon';
  if (months === 0) return 'Joined this month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const yrs = y ? `${y} yr${y === 1 ? '' : 's'}` : '';
  const mos = m ? `${m} mo${m === 1 ? '' : 's'}` : '';
  return [yrs, mos].filter(Boolean).join(' ');
}

/** People who can sign in (active, probation, on leave) — the ones expected at work. */
export const isCurrentStaff = (u: Pick<UserRow, 'status'>): boolean => canSignIn(u.status);

export const isOpenTask = (t: Pick<TaskRow, 'status'>): boolean => t.status !== TaskStatus.DONE;

export const dueKey = (t: Pick<TaskRow, 'dueDate'>): string | undefined => t.dueDate?.slice(0, 10);

/** Monday..Sunday of the current week as yyyy-mm-dd. */
export function thisWeekRange(now = new Date()): { from: string; to: string } {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toLocalDateInput(monday), to: toLocalDateInput(sunday) };
}

/** Short due label relative to today: "Overdue", "Today", "Tomorrow", "Thu", "12 Oct". */
export function dueLabel(key: string, today: string): { label: string; tone: 'bad' | 'warn' | 'muted' } {
  if (key < today) return { label: 'Overdue', tone: 'bad' };
  if (key === today) return { label: 'Today', tone: 'warn' };
  const d = new Date(`${key}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (days === 1) return { label: 'Tomorrow', tone: 'muted' };
  if (days < 7) return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), tone: 'muted' };
  return { label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), tone: 'muted' };
}

/**
 * Every task in the workspace (GET /tasks with no filter — allowed for all staff, no money in it).
 * Own query key so it never collides with "my tasks"; `['tasks']` invalidations still refresh it.
 */
export function useTeamTasks(enabled = true) {
  return useQuery({ queryKey: ['tasks', 'team'], queryFn: () => tasksApi.list({}), enabled, staleTime: 60_000 });
}

/** Tasks assigned to one person. */
export function useAssigneeTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'assignee', userId],
    queryFn: () => tasksApi.list({ assigneeId: userId! }),
    enabled: !!userId,
  });
}
