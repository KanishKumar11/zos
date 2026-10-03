// Task board — status columns with drag-and-drop (pointer and keyboard). Cards carry their
// project's identity colour, overdue cards are flagged, and cards glide between columns when their
// status changes (framer-motion layout; off when the viewer prefers reduced motion).
'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { LayoutGroup, motion, MotionConfig } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TASK_STATUS_ORDER, TaskPriority, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';

import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/components/ui/status-badge';
import { Avatar, ProjectChip } from '@/components/viz';

import type { TaskRow } from './tasks.hooks';

export const PRIORITY_TONE: Record<string, 'muted' | 'outline' | 'warning' | 'danger'> = {
  LOW: 'muted',
  MEDIUM: 'outline',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const isOverdue = (t: Pick<TaskRow, 'status' | 'dueDate'>, today = todayLocal()) =>
  t.status !== TaskStatus.DONE && !!t.dueDate && t.dueDate.slice(0, 10) < today;

export interface TaskBoardProps {
  tasks: TaskRow[];
  onMove: (task: TaskRow, status: TaskStatus) => void;
  /** Project name lookup — shows a coloured project chip on each card when given. */
  projectName?: (projectId: string) => string | undefined;
  /** Assignee name lookup — shows the assignee avatar on each card when given. */
  assigneeName?: (userId: string) => string | undefined;
}

export function TaskBoard({ tasks, onMove, projectName, assigneeName }: TaskBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  // The card the user just dropped appears where they let go; everything else animates.
  const [dropped, setDropped] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const byStatus = useMemo(() => {
    const g = new Map<TaskStatus, TaskRow[]>(TASK_STATUS_ORDER.map((s) => [s, []]));
    for (const t of tasks) g.get(t.status)?.push(t);
    return g;
  }, [tasks]);

  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t._id === String(e.active.id));
    if (!task || !target || task.status === target) return;
    setDropped(task._id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDropped(null), 600);
    onMove(task, target);
  };

  return (
    <MotionConfig reducedMotion="user">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <LayoutGroup>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {TASK_STATUS_ORDER.map((s) => (
              <BoardColumn key={s} status={s} tasks={byStatus.get(s) ?? []} dropped={dropped} projectName={projectName} assigneeName={assigneeName} />
            ))}
          </div>
        </LayoutGroup>
      </DndContext>
    </MotionConfig>
  );
}

function BoardColumn({
  status,
  tasks,
  dropped,
  projectName,
  assigneeName,
}: {
  status: TaskStatus;
  tasks: TaskRow[];
  dropped: string | null;
  projectName?: TaskBoardProps['projectName'];
  assigneeName?: TaskBoardProps['assigneeName'];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const late = tasks.filter((t) => isOverdue(t)).length;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[140px] flex-col rounded-[var(--radius)] border bg-card/60 transition-colors',
        isOver && 'border-brand bg-brand-wash',
        status === TaskStatus.BLOCKED && tasks.length > 0 && 'border-destructive/40',
      )}
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5 text-[13px] font-semibold">
        {statusLabel(status)}
        <span className="flex items-center gap-1.5">
          {late > 0 && <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">{late} late</span>}
          <span className="rounded-full bg-muted px-1.5 font-figures text-[10px] text-muted-foreground">{tasks.length}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2 pt-1">
        {tasks.map((t) => (
          <motion.div
            key={t._id}
            layout="position"
            layoutId={dropped === t._id ? undefined : `task-${t._id}`}
            transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
          >
            <BoardCard task={t} projectName={projectName?.(t.projectId)} assigneeName={t.assigneeId ? assigneeName?.(t.assigneeId) : undefined} showProject={!!projectName} showAssignee={!!assigneeName} />
          </motion.div>
        ))}
        {tasks.length === 0 && <p className="grid flex-1 place-items-center rounded-lg border border-dashed py-4 text-center text-[11px] text-muted-foreground">Drop here</p>}
      </div>
    </div>
  );
}

function BoardCard({
  task,
  projectName,
  assigneeName,
  showProject,
  showAssignee,
}: {
  task: TaskRow;
  projectName?: string;
  assigneeName?: string;
  showProject: boolean;
  showAssignee: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task._id });
  const late = isOverdue(task);
  const done = task.status === TaskStatus.DONE;
  return (
    <div
      ref={setNodeRef}
      style={{
        ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
        borderLeftColor: identityColor(task.projectId),
      }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task. Press space to pick up, arrow keys to move, space to drop."
      className={cn(
        'relative cursor-grab rounded-lg border border-l-[3px] bg-card px-3 py-2 shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'z-10 opacity-80 shadow-lg',
        late && 'border-y-destructive/40 border-r-destructive/40 bg-destructive/[0.04]',
      )}
    >
      {showProject && <ProjectChip id={task.projectId} name={projectName ?? 'Project'} className="max-w-full text-[11px] text-muted-foreground" />}
      <Link
        href={`/tasks/${task._id}`}
        onClick={(e) => e.stopPropagation()}
        className={cn('mt-0.5 block text-[13px] font-medium leading-snug hover:text-brand-ink', done && 'text-muted-foreground line-through')}
      >
        {task.title}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {task.priority !== TaskPriority.MEDIUM && <Badge variant={PRIORITY_TONE[task.priority]}>{statusLabel(task.priority)}</Badge>}
          {task.dueDate && (
            <span className={cn('inline-flex items-center gap-1 text-[11px]', late ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              <CalendarClock className="h-3 w-3" />
              {late ? 'Late · ' : ''}
              {formatDate(task.dueDate, { day: 'numeric', month: 'short' })}
            </span>
          )}
        </span>
        {showAssignee &&
          (task.assigneeId ? (
            <Avatar id={task.assigneeId} name={assigneeName ?? 'Former member'} size="xs" />
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-full border border-dashed" title="Unassigned" aria-label="Unassigned" />
          ))}
      </div>
    </div>
  );
}
