// Tasks API + hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  TaskPriority,
  TaskStatus,
  type CreateCommentInput,
  type CreateTaskInput,
  type CreateTimeEntryInput,
  type ListTasksQuery,
  type MoveTaskInput,
  type UpdateTaskInput,
} from '@agency/shared';

import { api, getErrorMessage, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface TaskRow {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  createdBy: string;
  dueDate?: string;
  position: number;
  parentId?: string;
  labels: string[];
  attachmentKeys: string[];
}
export interface TaskCommentRow {
  _id: string;
  taskId: string;
  authorId: string;
  body: string;
  mentions: string[];
  createdAt: string;
}
export interface TimeEntryRow {
  _id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  date: string;
  minutes: number;
  description?: string;
  billable: boolean;
}

export const tasksApi = {
  list: (q: ListTasksQuery = {}) => unwrap<TaskRow[]>(api.get('/tasks', { params: q })),
  byId: (id: string) => unwrap<TaskRow>(api.get(`/tasks/${id}`)),
  create: (body: CreateTaskInput) => unwrap<TaskRow>(api.post('/tasks', body)),
  update: (id: string, body: UpdateTaskInput) => unwrap<TaskRow>(api.patch(`/tasks/${id}`, body)),
  move: (id: string, body: MoveTaskInput) => unwrap<TaskRow>(api.patch(`/tasks/${id}/move`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/tasks/${id}`)),
  comments: (id: string) => unwrap<TaskCommentRow[]>(api.get(`/tasks/${id}/comments`)),
  comment: (id: string, body: CreateCommentInput) =>
    unwrap<TaskCommentRow>(api.post(`/tasks/${id}/comments`, body)),
};

export const timeApi = {
  mine: (range?: { from: string; to: string }) =>
    unwrap<TimeEntryRow[]>(api.get('/time/me', { params: range })),
  log: (body: CreateTimeEntryInput) => unwrap<TimeEntryRow>(api.post('/time', body)),
};

export function useTasks(q: ListTasksQuery = {}) {
  return useQuery({
    // Without a project this is every task the viewer may see — its own key, so it never collides
    // with the "my tasks" cache. Mutations still refresh it through the ['tasks'] prefix.
    queryKey: q.projectId ? qk.tasks.byProject(q.projectId, q.status) : q.mine ? qk.tasks.mine() : ['tasks', 'list', q],
    queryFn: () => tasksApi.list(q),
  });
}
/**
 * Optimistic status change with rollback, for boards and checklists. `queryKey` is the list the
 * task lives in (qk.tasks.mine() or qk.tasks.byProject(id)). Marking done offers an Undo.
 */
export function useSetTaskStatus(queryKey: readonly unknown[]) {
  const qc = useQueryClient();
  return async (task: TaskRow, status: TaskStatus) => {
    if (task.status === status) return;
    await qc.cancelQueries({ queryKey });
    const prev = qc.getQueryData<TaskRow[]>(queryKey);
    qc.setQueryData<TaskRow[]>(queryKey, (old) => (old ?? []).map((t) => (t._id === task._id ? { ...t, status } : t)));
    try {
      await tasksApi.update(task._id, { status });
      if (status === TaskStatus.DONE) {
        toast.success('Nice — task done', {
          action: {
            label: 'Undo',
            onClick: () =>
              void tasksApi
                .update(task._id, { status: task.status })
                .then(() => qc.invalidateQueries({ queryKey: ['tasks'] }))
                .catch((err: unknown) => toast.error(getErrorMessage(err))),
          },
        });
      }
    } catch (err) {
      qc.setQueryData(queryKey, prev);
      toast.error(getErrorMessage(err));
    } finally {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
  };
}

export function useMyTasks() {
  return useQuery({ queryKey: qk.tasks.mine(), queryFn: () => tasksApi.list({ mine: true }) });
}
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.tasks.byId(id) : ['tasks', 'undefined'],
    queryFn: () => tasksApi.byId(id!),
    enabled: !!id,
  });
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaskInput) => tasksApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateTaskInput }) => tasksApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task deleted');
    },
  });
}
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: MoveTaskInput }) => tasksApi.move(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useTaskComments(id: string | undefined) {
  return useQuery({
    queryKey: id ? ['tasks', id, 'comments'] : ['tasks', 'undefined', 'comments'],
    queryFn: () => tasksApi.comments(id!),
    enabled: !!id,
  });
}
export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: CreateCommentInput }) =>
      tasksApi.comment(vars.id, vars.body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['tasks', vars.id, 'comments'] }),
  });
}

export function useMyTime(range?: { from: string; to: string }) {
  return useQuery({ queryKey: ['time', 'me', range], queryFn: () => timeApi.mine(range) });
}
export function useLogTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTimeEntryInput) => timeApi.log(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time'] });
      toast.success('Time logged');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
