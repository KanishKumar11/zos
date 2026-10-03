// Project tasks — quick-add plus a list grouped by status (inline status / assignee changes) or an
// animated board. Assignees show as avatars, overdue work is flagged. Anyone on the project can add.
'use client';

import { Columns3, List, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Role, TASK_STATUS_ORDER, TaskPriority, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatDate } from '@/lib/formatters';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';

import { ViewToggle } from '@/components/data/view-toggle';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { statusLabel } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Avatar } from '@/components/viz';
import type { ProjectRow } from '@/features/projects/projects.hooks';

import { PRIORITY_TONE, TaskBoard } from './task-board';
import { useCreateTask, useDeleteTask, useSetTaskStatus, useTasks, useUpdateTask, type TaskRow } from './tasks.hooks';

const VIEW_KEY = 'zos:project-tasks-view';
/** Remember List/Board for the project Tasks tab (per browser; the tab URL belongs to the page). */
function useRememberedView(): ['list' | 'board', (v: 'list' | 'board') => void] {
  const [view, setView] = useState<'list' | 'board'>('list');
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'board') setView('board');
    } catch {
      /* storage blocked — default view */
    }
  }, []);
  return [
    view,
    (v) => {
      setView(v);
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {
        /* ignore */
      }
    },
  ];
}

export function ProjectTasks({ project }: { project: ProjectRow }) {
  const me = useAuthStore((s) => s.user);
  const tasks = useTasks({ projectId: project._id });
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string>();
  const [view, setView] = useRememberedView();
  const setStatus = useSetTaskStatus(qk.tasks.byProject(project._id));

  const names = new Map(project.members.map((m) => [m.userId, m.name ?? (m.userId === me?.id ? me?.name : undefined) ?? 'Team member']));
  const today = todayLocal();

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, TaskRow[]>();
    for (const t of tasks.data ?? []) {
      const list = map.get(t.status) ?? [];
      list.push(t);
      map.set(t.status, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    }
    return map;
  }, [tasks.data]);

  const add = async () => {
    if (title.trim().length < 2) return setError('Give the task a title');
    setError(undefined);
    await create.mutateAsync({
      projectId: project._id,
      title: title.trim(),
      priority,
      ...(assigneeId ? { assigneeId } : {}),
      ...(dueDate ? { dueDate: dueDate as unknown as Date } : {}),
    });
    setTitle('');
    setDueDate('');
  };

  const open = (tasks.data ?? []).filter((t) => t.status !== TaskStatus.DONE).length;
  const overdue = (tasks.data ?? []).filter((t) => t.status !== TaskStatus.DONE && t.dueDate && t.dueDate.slice(0, 10) < today).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Tasks</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {open} open{overdue > 0 && <span className="text-destructive"> · {overdue} overdue</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {view === 'list' && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Show done
            </label>
          )}
          <ViewToggle
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List', icon: List },
              { value: 'board', label: 'Board', icon: Columns3 },
            ]}
          />
        </div>
      </CardHeader>
      <form
        className="grid gap-2 border-b bg-muted/30 px-5 py-3 sm:grid-cols-[1fr_170px_150px_120px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" aria-invalid={!!error} />
          {error && <p className="pt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Assignee">
          <option value="">Unassigned</option>
          {project.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userId === me?.id ? 'Me' : (m.name ?? 'Team member')}
            </option>
          ))}
        </Select>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" />
        <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} aria-label="Priority">
          {Object.values(TaskPriority).map((p) => (
            <option key={p} value={p}>
              {statusLabel(p)}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" className="h-9" disabled={create.isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </form>
      <CardContent className="p-0">
        {tasks.isLoading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        ) : (tasks.data ?? []).length === 0 ? (
          <EmptyState illustration="done" title="No tasks yet" description="Add the first task above." />
        ) : view === 'board' ? (
          <div className="p-3">
            <TaskBoard tasks={tasks.data ?? []} onMove={setStatus} assigneeName={(uid) => names.get(uid) ?? 'Former member'} />
          </div>
        ) : (
          TASK_STATUS_ORDER.filter((s) => (showDone || s !== TaskStatus.DONE) && grouped.get(s)?.length).map((status) => (
            <section key={status}>
              <p className="border-b bg-muted/20 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                {statusLabel(status)} · {grouped.get(status)!.length}
              </p>
              <ul className="divide-y">
                {grouped.get(status)!.map((t) => {
                  const late = t.status !== TaskStatus.DONE && t.dueDate && t.dueDate.slice(0, 10) < today;
                  const canDelete = t.createdBy === me?.id || me?.role === Role.OWNER || me?.role === Role.ADMIN || me?.role === Role.LEAD;
                  return (
                    <li key={t._id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2', late && 'bg-destructive/[0.04]')}>
                      <input
                        type="checkbox"
                        aria-label={`Mark ${t.title} done`}
                        checked={t.status === TaskStatus.DONE}
                        onChange={(e) => update.mutate({ id: t._id, body: { status: e.target.checked ? TaskStatus.DONE : TaskStatus.TODO } })}
                      />
                      <Link href={`/tasks/${t._id}`} className={cn('min-w-0 flex-1 truncate text-sm hover:underline', t.status === TaskStatus.DONE && 'text-muted-foreground line-through')}>
                        {t.title}
                      </Link>
                      {t.priority !== TaskPriority.MEDIUM && <Badge variant={PRIORITY_TONE[t.priority]}>{statusLabel(t.priority)}</Badge>}
                      {t.dueDate && (
                        <span className={cn('text-xs', late ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {late ? 'Overdue · ' : ''}
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                      {t.assigneeId ? (
                        <Avatar id={t.assigneeId} name={names.get(t.assigneeId) ?? 'Former member'} size="xs" />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border border-dashed" title="Unassigned" aria-hidden />
                      )}
                      <Select
                        value={t.assigneeId ?? ''}
                        onChange={(e) => update.mutate({ id: t._id, body: { assigneeId: e.target.value || null } })}
                        className="h-7 w-[140px] text-xs"
                        aria-label="Assignee"
                      >
                        <option value="">Unassigned</option>
                        {project.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {names.get(m.userId)}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={t.status}
                        onChange={(e) => update.mutate({ id: t._id, body: { status: e.target.value as TaskStatus } })}
                        className="h-7 w-[120px] text-xs"
                        aria-label="Status"
                      >
                        {TASK_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </Select>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete ${t.title}`}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                          onClick={async () => {
                            if (await confirm({ title: `Delete “${t.title}”?`, destructive: true })) remove.mutate(t._id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
