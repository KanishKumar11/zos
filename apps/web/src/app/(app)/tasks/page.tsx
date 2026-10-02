// My tasks — what's assigned to me, grouped by when it's due (list) or by status (board).
'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Columns3, List } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { TASK_STATUS_ORDER, TaskPriority, TaskStatus } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { useListState } from '@/lib/list-state';
import { qk } from '@/lib/query-keys';

import { FilterBar, SelectFilter } from '@/components/data/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { statusLabel } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { tasksApi, useMyTasks, type TaskRow } from '@/features/tasks/tasks.hooks';

const PRIORITY_TONE: Record<string, 'muted' | 'outline' | 'warning' | 'danger'> = {
  LOW: 'muted',
  MEDIUM: 'outline',
  HIGH: 'warning',
  URGENT: 'danger',
};

/** Optimistic status change with rollback — used by both views. */
function useSetStatus() {
  const qc = useQueryClient();
  return async (task: TaskRow, status: TaskStatus) => {
    const key = qk.tasks.mine();
    const prev = qc.getQueryData<TaskRow[]>(key);
    qc.setQueryData<TaskRow[]>(key, (old) => (old ?? []).map((t) => (t._id === task._id ? { ...t, status } : t)));
    try {
      await tasksApi.update(task._id, { status });
      if (status === TaskStatus.DONE) toast.success('Nice — task done', { action: { label: 'Undo', onClick: () => void tasksApi.update(task._id, { status: task.status }).then(() => qc.invalidateQueries({ queryKey: ['tasks'] })) } });
    } catch (err) {
      qc.setQueryData(key, prev);
      toast.error(getErrorMessage(err));
    } finally {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
  };
}

export default function MyTasksPage() {
  const tasks = useMyTasks();
  const projects = useAllProjects();
  const list = useListState('my-tasks', { view: 'list', projectId: '', showDone: '' });
  const projectName = new Map((projects.data?.items ?? []).map((p) => [p._id, p.name]));
  const setStatus = useSetStatus();

  const rows = (tasks.data ?? []).filter((t) => !list.params.projectId || t.projectId === list.params.projectId);
  const open = rows.filter((t) => t.status !== TaskStatus.DONE);
  const today = todayLocal();
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My tasks"
        description={tasks.isLoading ? undefined : `${open.length} open${overdue ? ` · ${overdue} overdue` : ''}`}
        action={
          <div className="inline-flex rounded-md border p-0.5">
            {(['list', 'board'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => list.set({ view: v })}
                className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 text-xs', list.params.view === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'list' ? <List className="h-3.5 w-3.5" /> : <Columns3 className="h-3.5 w-3.5" />}
                {v === 'list' ? 'List' : 'Board'}
              </button>
            ))}
          </div>
        }
      />
      <FilterBar>
        <SelectFilter
          value={list.params.projectId}
          onChange={(projectId) => list.set({ projectId })}
          allLabel="All projects"
          options={(projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name }))}
        />
        {list.params.view === 'list' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={list.params.showDone === '1'} onChange={(e) => list.set({ showDone: e.target.checked ? '1' : '' })} />
            Show completed
          </label>
        )}
      </FilterBar>

      {tasks.isLoading ? (
        <Card>
          <TableSkeleton rows={6} columns={3} />
        </Card>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="Nothing assigned to you" description="Tasks assigned to you on any project show up here." />
        </Card>
      ) : list.params.view === 'board' ? (
        <Board tasks={rows} projectName={projectName} onMove={setStatus} />
      ) : (
        <GroupedList tasks={list.params.showDone === '1' ? rows : open} projectName={projectName} onToggle={(t) => setStatus(t, t.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)} />
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

function GroupedList({ tasks, projectName, onToggle }: { tasks: TaskRow[]; projectName: Map<string, string>; onToggle: (t: TaskRow) => void }) {
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
    <div className="space-y-4">
      {BUCKETS.filter((b) => groups.get(b)?.length).map((b) => (
        <section key={b}>
          <p className={cn('mb-1.5 text-xs font-medium', b === 'Overdue' ? 'text-destructive' : 'text-muted-foreground')}>
            {b} · {groups.get(b)!.length}
          </p>
          <Card>
            <ul className="divide-y">
              {groups.get(b)!.map((t) => (
                <li key={t._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <input type="checkbox" aria-label={`Mark ${t.title} done`} checked={t.status === TaskStatus.DONE} onChange={() => onToggle(t)} />
                  <Link href={`/tasks/${t._id}`} className={cn('min-w-0 flex-1 truncate text-sm hover:underline', t.status === TaskStatus.DONE && 'text-muted-foreground line-through')}>
                    {t.title}
                  </Link>
                  <Link href={`/projects/${t.projectId}?tab=tasks`} className="text-xs text-muted-foreground hover:text-foreground">
                    {projectName.get(t.projectId) ?? 'Project'}
                  </Link>
                  {t.status !== TaskStatus.TODO && t.status !== TaskStatus.DONE && <Badge variant="outline">{statusLabel(t.status)}</Badge>}
                  {t.priority !== TaskPriority.MEDIUM && <Badge variant={PRIORITY_TONE[t.priority]}>{statusLabel(t.priority)}</Badge>}
                  {t.dueDate && <span className={cn('w-20 text-right text-xs', b === 'Overdue' ? 'text-destructive' : 'text-muted-foreground')}>{formatDate(t.dueDate)}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function Board({ tasks, projectName, onMove }: { tasks: TaskRow[]; projectName: Map<string, string>; onMove: (t: TaskRow, s: TaskStatus) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const byStatus = useMemo(() => {
    const g = new Map<TaskStatus, TaskRow[]>(TASK_STATUS_ORDER.map((s) => [s, []]));
    for (const t of tasks) g.get(t.status)?.push(t);
    return g;
  }, [tasks]);
  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t._id === String(e.active.id));
    if (task && target && task.status !== target) onMove(task, target);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {TASK_STATUS_ORDER.map((s) => (
          <BoardColumn key={s} status={s} tasks={byStatus.get(s) ?? []} projectName={projectName} />
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumn({ status, tasks, projectName }: { status: TaskStatus; tasks: TaskRow[]; projectName: Map<string, string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn('flex min-h-[120px] flex-col rounded-lg border bg-card', isOver && 'ring-2 ring-primary')}>
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
        {statusLabel(status)}
        <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {tasks.map((t) => (
          <BoardCard key={t._id} task={t} projectName={projectName.get(t.projectId)} />
        ))}
        {tasks.length === 0 && <p className="py-4 text-center text-[11px] text-muted-foreground">Drop here</p>}
      </div>
    </div>
  );
}

function BoardCard({ task, projectName }: { task: TaskRow; projectName?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task._id });
  const late = task.status !== TaskStatus.DONE && task.dueDate && task.dueDate.slice(0, 10) < todayLocal();
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...attributes}
      {...listeners}
      className={cn('cursor-grab rounded-md border bg-background px-3 py-2 shadow-sm active:cursor-grabbing', isDragging && 'opacity-50')}
    >
      <Link href={`/tasks/${task._id}`} onClick={(e) => e.stopPropagation()} className="block text-[13px] font-medium leading-snug hover:text-primary">
        {task.title}
      </Link>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{projectName ?? 'Project'}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {task.priority !== TaskPriority.MEDIUM ? <Badge variant={PRIORITY_TONE[task.priority]}>{statusLabel(task.priority)}</Badge> : <span />}
        {task.dueDate && <span className={cn('text-[11px]', late ? 'font-medium text-destructive' : 'text-muted-foreground')}>{formatDate(task.dueDate)}</span>}
      </div>
    </div>
  );
}
