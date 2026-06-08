// Time tracking page.
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createTimeEntrySchema } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import { PageHeader } from '@/components/layout/page-header';
import { useLogTime, useMyTime } from '@/features/tasks/tasks.hooks';
import { useProjects } from '@/features/projects/projects.hooks';

export default function TimePage() {
  const projects = useProjects();
  const list = useMyTime();
  const log = useLogTime();
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<z.input<typeof createTimeEntrySchema>>({
    resolver: zodResolver(createTimeEntrySchema) as never,
    defaultValues: { date: today, minutes: 60, billable: false } as never,
  });

  const total = (list.data ?? []).reduce((acc, e) => acc + e.minutes, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Time tracking" description={`Total: ${(total / 60).toFixed(1)} h logged`} />

      <Card>
        <CardHeader>
          <CardTitle>Log time</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={form.handleSubmit((v) =>
              log.mutate(v as never, { onSuccess: () => form.reset({ date: today, minutes: 60, billable: false } as never) }),
            )}
          >
            <div className="space-y-1">
              <Label>Project</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('projectId')}
              >
                <option value="">Select…</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" {...form.register('date')} />
            </div>
            <div className="space-y-1">
              <Label>Minutes</Label>
              <Input type="number" {...form.register('minutes', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...form.register('description')} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={log.isPending}>
                {log.isPending ? 'Saving…' : 'Log'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent entries · total {Math.floor(total / 60)}h {total % 60}m</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Project</TH>
                <TH>Minutes</TH>
                <TH>Description</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((e) => (
                <TR key={e._id}>
                  <TD>{e.date}</TD>
                  <TD>{e.projectId.slice(-6)}</TD>
                  <TD>{e.minutes}</TD>
                  <TD>{e.description ?? ''}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
