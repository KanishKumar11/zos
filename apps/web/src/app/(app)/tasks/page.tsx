// My tasks — what's assigned to me, grouped by when it's due (list) or by status (board).
// Every task carries its project's colour; overdue work is flagged; board moves animate.
'use client';

import { Columns3, List } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TaskPriority, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useListState } from '@/lib/list-state';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';

import { FilterBar, ResetFilters, SelectFilter } from '@/components/data/filter-bar';
import { ViewToggle } from '@/components/data/view-toggle';
import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Bento, Hero, HeroFigure, HeroMark, ProjectChip, Tile, WeekStrip } from '@/components/viz';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { isOverdue, PRIORITY_TONE, TaskBoard } from '@/features/tasks/task-board';
import { useMyTasks, useSetTaskStatus, type TaskRow } from '@/features/tasks/tasks.hooks';

export default function MyTasksPage() {
  const me = useAuthStore((s) => s.user);
  const tasks = useMyTasks();
  const projects = useAllProjects();
  const list = useListState('my-tasks', { view: 'list', projectId: '', showDone: '' });
  // A picked day from the week strip is a quick look, not a remembered filter.
  const [day, setDay] = useState('');
  const view = list.params.view === 'board' ? 'board' : 'list';
  const projectNames = useMemo(() => new Map((projects.data?.items ?? []).map((p) => [p._id, p.name])), [projects.data]);
  const projectName = (id: string) => projectNames.get(id) ?? (projects.isLoading ? undefined : 'Project');
  const setStatus = useSetTaskStatus(qk.tasks.mine());

  const all = tasks.data ?? [];
  const rows = all.filter((t) => (!list.params.projectId || t.projectId === list.params.projectId) && (!day || t.dueDate?.slice(0, 10) === day));
  const open = rows.filter((t) => t.status !== TaskStatus.DONE);
  const today = todayLocal();
  const allOpen = all.filter((t) => t.status !== TaskStatus.DONE);
  const overdue = allOpen.filter((t) => isOverdue(t, today)).length;
  const dueToday = allOpen.filter((t) => t.dueDate?.slice(0, 10) === today).length;
  const filterCount = (list.params.projectId ? 1 : 0) + (list.params.showDone ? 1 : 0) + (day ? 1 : 0);
  const projectCount = new Set(allOpen.map((t) => t.projectId)).size;
  const firstName = me?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <Hero
        pageTitle="My tasks"
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        loading={tasks.isLoading}
        lede={
          allOpen.length
            ? `${dueToday ? `${dueToday} due today. ` : ''}Spread across ${projectCount} project${projectCount === 1 ? '' : 's'}. Drag cards on the board to change their status.`
            : 'New tasks assigned to you on any project show up here.'
        }
      >
        {allOpen.length === 0 ? (
          <>Nothing on your plate{firstName ? `, ${firstName}` : ''}. Nice.</>
        ) : (
          <>
            You have <HeroFigure>{allOpen.length} open task{allOpen.length === 1 ? '' : 's'}</HeroFigure>
            {overdue ? (
              <>
                {' '}— <HeroMark>{overdue} overdue</HeroMark>.
              </>
            ) : dueToday ? (
              <>
                {' '}— {dueToday} due today.
              </>
            ) : (
              ' — none overdue.'
            )}
          </>
        )}
      </Hero>

      {allOpen.some((t) => t.dueDate) && (
        <Bento>
          <Tile span={12} title="This week" action={day && <button type="button" className="text-xs text-brand-ink hover:underline" onClick={() => setDay('')}>Show every day</button>}>
            <WeekStrip
              dots={allOpen
                .filter((t) => t.dueDate)
                .map((t) => ({ date: t.dueDate!.slice(0, 10), color: identityColor(t.projectId), title: t.title }))}
              selected={day || undefined}
              onSelect={(d) => setDay(day === d ? '' : d)}
            />
          </Tile>
        </Bento>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar className="flex-1">
          <SelectFilter
            value={list.params.projectId}
            onChange={(projectId) => list.set({ projectId })}
            allLabel="All projects"
            options={(projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name }))}
          />
          {view === 'list' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={list.params.showDone === '1'} onChange={(e) => list.set({ showDone: e.target.checked ? '1' : '' })} />
              Show completed
            </label>
          )}
          {day && <Badge variant="info">Due {formatDate(`${day}T00:00:00`, { weekday: 'short', day: 'numeric', month: 'short' })}</Badge>}
          <ResetFilters count={filterCount} onReset={() => {
              setDay('');
              list.set({ projectId: '', showDone: '' });
            }} />
        </FilterBar>
        <ViewToggle
          value={view}
          onChange={(v) => list.set({ view: v })}
          options={[
            { value: 'list', label: 'List', icon: List },
            { value: 'board', label: 'Board', icon: Columns3 },
          ]}
        />
      </div>

      {tasks.isLoading ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <TableSkeleton rows={6} columns={3} />
        </div>
      ) : tasks.isError ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <EmptyState
            illustration="done"
            title={filterCount ? 'No tasks match these filters' : 'Nothing assigned to you'}
            description={filterCount ? undefined : 'Tasks assigned to you on any project show up here.'}
          />
        </div>
      ) : view === 'board' ? (
        <TaskBoard tasks={rows} projectName={projectName} onMove={setStatus} />
      ) : (list.params.showDone === '1' ? rows : open).length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card">
          <EmptyState illustration="done" title="All done here" description="Everything in this view is complete. Tick “Show completed” to see it." />
        </div>
      ) : (
        <GroupedList
          tasks={list.params.showDone === '1' ? rows : open}
          projectName={projectName}
          onToggle={(t) => setStatus(t, t.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}
        />
      )}
    </div>
  );
}

function bucketOf(t: TaskRow, today: string, weekEnd: string): string {
  if (t.status === TaskStatus.DONE) return 'Done';
  if (!t.dueDate) return 'No due date';
  const d = t.dueDate.slice(0, 10);
  if (d < today) return 'Overdue';
  if (d === today) return 'Today';
  if (d <= weekEnd) return 'This week';
  return 'Later';
}
const BUCKETS = ['Overdue', 'Today', 'This week', 'Later', 'No due date', 'Done'];

function GroupedList({ tasks, projectName, onToggle }: { tasks: TaskRow[]; projectName: (id: string) => string | undefined; onToggle: (t: TaskRow) => void }) {
  const today = todayLocal();
  const weekEnd = toLocalDateInput(new Date(Date.now() + 6 * 86_400_000));
  const groups = useMemo(() => {
    const g = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      const b = bucketOf(t, today, weekEnd);
      g.set(b, [...(g.get(b) ?? []), t]);
    }
    const rank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    for (const list of g.values()) list.sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
    return g;
  }, [tasks, today, weekEnd]);

  return (
    <div className="space-y-5">
      {BUCKETS.filter((b) => groups.get(b)?.length).map((b) => (
        <section key={b}>
          <p className={cn('mb-2 text-[13px] font-semibold', b === 'Overdue' ? 'text-destructive' : 'text-muted-foreground')}>
            {b} · <span className="font-figures">{groups.get(b)!.length}</span>
          </p>
          <ul className={cn('divide-y overflow-hidden rounded-[var(--radius)] border bg-card', b === 'Overdue' && 'border-destructive/40')}>
            {groups.get(b)!.map((t) => (
              <li
                key={t._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] px-4 py-2.5"
                style={{ borderLeftColor: identityColor(t.projectId) }}
              >
                <input type="checkbox" aria-label={`Mark ${t.title} done`} checked={t.status === TaskStatus.DONE} onChange={() => onToggle(t)} />
                <Link href={`/tasks/${t._id}`} className={cn('min-w-0 flex-1 truncate text-sm font-medium hover:underline', t.status === TaskStatus.DONE && 'text-muted-foreground line-through')}>
                  {t.title}
                </Link>
                <ProjectChip id={t.projectId} name={projectName(t.projectId) ?? 'Project'} href={`/projects/${t.projectId}?tab=tasks`} className="max-w-[12rem] text-xs text-muted-foreground" />
                {t.status !== TaskStatus.TODO && t.status !== TaskStatus.DONE && (
                  <Badge variant={t.status === TaskStatus.BLOCKED ? 'danger' : 'outline'}>{statusLabel(t.status)}</Badge>
                )}
                {t.priority !== TaskPriority.MEDIUM && <Badge variant={PRIORITY_TONE[t.priority]}>{statusLabel(t.priority)}</Badge>}
                {t.dueDate && (
                  <span className={cn('w-20 text-right text-xs', b === 'Overdue' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                    {formatDate(t.dueDate, { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
