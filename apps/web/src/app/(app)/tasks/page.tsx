// My tasks — Kanban board with drag-and-drop status updates.
'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

import { TaskStatus } from '@agency/shared';

import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/cn';

import { useMyTasks, useUpdateTask, type TaskRow } from '@/features/tasks/tasks.hooks';

const COLUMNS: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

const COLUMN_META: Record<TaskStatus, { label: string; color: string }> = {
  [TaskStatus.BACKLOG]:    { label: 'Backlog',    color: 'bg-slate-400' },
  [TaskStatus.TODO]:       { label: 'To do',      color: 'bg-zinc-500' },
  [TaskStatus.IN_PROGRESS]:{ label: 'In progress',color: 'bg-primary' },
  [TaskStatus.IN_REVIEW]:  { label: 'In review',  color: 'bg-amber-500' },
  [TaskStatus.BLOCKED]:    { label: 'Blocked',    color: 'bg-destructive' },
  [TaskStatus.DONE]:       { label: 'Done',       color: 'bg-[hsl(var(--success))]' },
};

export default function MyTasksPage() {
  const tasks = useMyTasks();
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const groups = useMemo(() => {
    const g: Record<TaskStatus, TaskRow[]> = {
      [TaskStatus.BACKLOG]: [],
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.IN_REVIEW]: [],
      [TaskStatus.BLOCKED]: [],
      [TaskStatus.DONE]: [],
    };
    for (const t of tasks.data ?? []) g[t.status].push(t);
    return g;
  }, [tasks.data]);

  function onDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const target = e.over?.id ? (String(e.over.id) as TaskStatus) : undefined;
    if (!target) return;
    const task = (tasks.data ?? []).find((t) => t._id === taskId);
    if (!task || task.status === target) return;
    update.mutate({ id: taskId, body: { status: target } as never });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My tasks" description="Drag cards to update status." />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} tasks={groups[status]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks }: { status: TaskStatus; tasks: TaskRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = COLUMN_META[status];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg border bg-card transition-shadow',
        isOver && 'ring-2 ring-primary shadow-md',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className={cn('h-2 w-2 rounded-full shrink-0', meta.color)} />
        <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      {/* Cards */}
      <div className="flex flex-col gap-2 p-2">
        {tasks.map((t) => (
          <TaskCard key={t._id} task={t} />
        ))}
        {tasks.length === 0 && (
          <p className="py-4 text-center text-[11px] text-muted-foreground">Empty</p>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task._id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab select-none rounded-md border bg-background px-3 py-2.5 shadow-[0_1px_2px_0_rgb(0_0_0/0.06)] transition-shadow active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <Link
        href={`/tasks/${task._id}`}
        className="block text-[12px] font-medium leading-snug hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {task.title}
      </Link>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          task.priority === 'URGENT' ? 'text-destructive' :
          task.priority === 'HIGH'   ? 'text-amber-600' :
          'text-muted-foreground',
        )}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}
