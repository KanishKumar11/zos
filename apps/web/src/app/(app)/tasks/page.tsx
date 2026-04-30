// My tasks page.
'use client';

import Link from 'next/link';

import { TaskStatus } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import { useMyTasks } from '@/features/tasks/tasks.hooks';

export default function MyTasksPage() {
  const tasks = useMyTasks();
  const groups: Record<TaskStatus, typeof tasks.data> = {
    [TaskStatus.TODO]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.IN_REVIEW]: [],
    [TaskStatus.DONE]: [],
    [TaskStatus.BLOCKED]: [],
  } as never;
  for (const t of tasks.data ?? []) (groups[t.status] ??= []).push(t);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My tasks</h1>
      {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'] as const).map((status) => (
        <Card key={status}>
          <CardHeader>
            <CardTitle>{status.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Project</TH>
                  <TH>Priority</TH>
                  <TH>Due</TH>
                </TR>
              </THead>
              <TBody>
                {(groups[status as TaskStatus] ?? []).map((t) => (
                  <TR key={t._id}>
                    <TD>
                      <Link className="underline" href={`/tasks/${t._id}`}>
                        {t.title}
                      </Link>
                    </TD>
                    <TD>
                      <Link className="underline" href={`/projects/${t.projectId}`}>
                        {t.projectId.slice(-6)}
                      </Link>
                    </TD>
                    <TD>{t.priority}</TD>
                    <TD>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
