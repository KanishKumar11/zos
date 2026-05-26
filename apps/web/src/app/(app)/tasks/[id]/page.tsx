// Task detail with comments + time log.
'use client';

import { use } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  TaskStatus,
  createCommentSchema,
  type CreateCommentInput,
} from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

import {
  useAddComment,
  useTask,
  useTaskComments,
  useUpdateTask,
} from '@/features/tasks/tasks.hooks';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const task = useTask(id);
  const comments = useTaskComments(id);
  const update = useUpdateTask();
  const addComment = useAddComment();
  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { body: '' },
  });

  if (task.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!task.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const t = task.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={`${t.priority} · ${t.status}`} />

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={t.status}
            onChange={(e) =>
              update.mutate({ id, body: { status: e.target.value as TaskStatus } })
            }
          >
            {Object.values(TaskStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{t.description || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {(comments.data ?? []).map((c) => (
              <li key={c._id} className="rounded border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {c.authorId.slice(-6)} · {new Date(c.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-line">{c.body}</p>
              </li>
            ))}
            {!(comments.data ?? []).length && (
              <li className="text-sm text-muted-foreground">No comments yet.</li>
            )}
          </ul>
          <form
            className="space-y-2"
            onSubmit={form.handleSubmit((vals) =>
              addComment.mutate(
                { id, body: vals },
                { onSuccess: () => form.reset({ body: '' }) },
              ),
            )}
          >
            <textarea
              className="min-h-20 w-full rounded border bg-background px-3 py-2 text-sm"
              placeholder="Write a comment…"
              {...form.register('body')}
            />
            <Button type="submit" disabled={addComment.isPending}>
              {addComment.isPending ? 'Posting…' : 'Post comment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
