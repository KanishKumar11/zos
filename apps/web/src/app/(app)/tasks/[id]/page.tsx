// Task detail — edit everything inline, discuss in comments, @mention teammates.
'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { Role, TASK_STATUS_ORDER, TaskPriority, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatDateTime, initials } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge, statusLabel } from '@/components/ui/status-badge';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { useProject } from '@/features/projects/projects.hooks';
import { useAddComment, useDeleteTask, useTask, useTaskComments, useUpdateTask } from '@/features/tasks/tasks.hooks';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const task = useTask(id);
  const project = useProject(task.data?.projectId);
  const comments = useTaskComments(id);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const addComment = useAddComment();
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (task.data) {
      setTitle(task.data.title);
      setDescription(task.data.description ?? '');
    }
  }, [task.data]);

  if (task.isLoading) return <PageSkeleton />;
  if (task.isError || !task.data) return <ErrorState title="Couldn't open this task" error={task.error} onRetry={() => task.refetch()} />;
  const t = task.data;
  const members = project.data?.members ?? [];
  const nameOf = (uid?: string) => members.find((m) => m.userId === uid)?.name ?? (uid === me?.id ? me?.name : undefined) ?? 'Former member';
  const late = t.status !== TaskStatus.DONE && t.dueDate && t.dueDate.slice(0, 10) < todayLocal();
  const canDelete = t.createdBy === me?.id || me?.role === Role.OWNER || me?.role === Role.ADMIN || me?.role === Role.LEAD;
  const save = (body: Record<string, unknown>) => update.mutate({ id, body: body as never });

  const postComment = async () => {
    const body = comment.trim();
    if (!body) return;
    // "@Priya" or "@Priya Sharma" notifies that teammate.
    const mentions = members
      .filter((m) => m.name && (body.includes(`@${m.name}`) || body.includes(`@${m.name.split(' ')[0]}`)))
      .map((m) => m.userId);
    await addComment.mutateAsync({ id, body: { body, mentions } });
    setComment('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        crumbs={[
          { label: 'My tasks', href: '/tasks' },
          ...(project.data ? [{ label: project.data.name, href: `/projects/${t.projectId}?tab=tasks` }] : []),
        ]}
        meta={<StatusBadge status={t.status} />}
        action={
          canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this task?', description: 'Its comments are deleted too.', destructive: true }))) return;
                await remove.mutateAsync(id);
                router.push(`/projects/${t.projectId}?tab=tasks`);
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              <FormField label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim().length >= 2 && title !== t.title && save({ title: title.trim() })} />
              </FormField>
              <FormField label="Description">
                <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details, links, acceptance criteria…" />
              </FormField>
              {description !== (t.description ?? '') && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDescription(t.description ?? '')}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={() => save({ description })} disabled={update.isPending}>
                    Save description
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(comments.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {comments.data!.map((c) => (
                    <li key={c._id} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{initials(nameOf(c.authorId))}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{nameOf(c.authorId)}</span> · {formatDateTime(c.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line text-sm">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void postComment();
                }}
              >
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment… type @ and a teammate's name to notify them"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void postComment();
                  }}
                />
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {members
                      .filter((m) => m.userId !== me?.id && m.name)
                      .slice(0, 8)
                      .map((m) => (
                        <button key={m.userId} type="button" className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent" onClick={() => setComment((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}@${m.name} `)}>
                          @{m.name}
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!comment.trim() || addComment.isPending}>
                    {addComment.isPending ? 'Posting…' : 'Comment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-3 p-5">
            <FormField label="Status">
              <Select value={t.status} onChange={(e) => save({ status: e.target.value })}>
                {TASK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assignee">
              <Select value={t.assigneeId ?? ''} onChange={(e) => save({ assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === me?.id ? `${m.name ?? 'Me'} (me)` : m.name ?? 'Team member'}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={t.priority} onChange={(e) => save({ priority: e.target.value })}>
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>
                    {statusLabel(p)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Due date" error={late ? 'Overdue' : undefined}>
              <Input type="date" value={t.dueDate?.slice(0, 10) ?? ''} onChange={(e) => save({ dueDate: e.target.value || null })} className={cn(late && 'border-destructive')} />
            </FormField>
            <div className="border-t pt-3 text-xs text-muted-foreground">
              Project:{' '}
              <Link href={`/projects/${t.projectId}?tab=tasks`} className="text-primary hover:underline">
                {project.data?.name ?? 'Open project'}
              </Link>
              <br />
              Created by {nameOf(t.createdBy)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
