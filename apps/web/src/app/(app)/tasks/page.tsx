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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useMyTasks, useUpdateTask, type TaskRow } from '@/features/tasks/tasks.hooks';

const COLUMNS: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My tasks</h1>
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
  return (
    <Card ref={setNodeRef} className={isOver ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">
          {status.replace('_', ' ')} · {tasks.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t._id} task={t} />
        ))}
        {tasks.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
      </CardContent>
    </Card>
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
      className={`cursor-grab rounded border bg-background p-2 text-xs shadow-sm ${isDragging ? 'opacity-60' : ''}`}
    >
      <Link href={`/tasks/${task._id}`} className="block font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {task.title}
      </Link>
      <div className="mt-1 flex items-center justify-between text-muted-foreground">
        <span>{task.priority}</span>
        <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''}</span>
      </div>
    </div>
  );
}
