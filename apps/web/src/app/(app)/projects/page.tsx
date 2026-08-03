// Projects list page.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  ProjectStatus,
  Role,
  createProjectSchema,
  type CreateProjectInput,
} from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader } from '@/components/layout/page-header';
import { useCreateProject, useProjects } from '@/features/projects/projects.hooks';
import { useClients } from '@/features/clients/clients.hooks';

export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const list = useProjects({ page, pageSize: 20, status: statusFilter || undefined });
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === Role.OWNER;
  const [open, setOpen] = useState(false);
  const create = useCreateProject();
  const clients = useClients();

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', code: '', status: ProjectStatus.ACTIVE, currency: 'INR' },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track deliverables, budgets, and team assignments."
        action={
          <RoleGate allow={[Role.OWNER, Role.ADMIN, Role.LEAD]}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New project</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input {...form.register('name')} />
                </div>
                <div className="space-y-1">
                  <Label>Code (unique)</Label>
                  <Input {...form.register('code')} />
                </div>
                <div className="space-y-1">
                  <Label>Brief</Label>
                  <textarea
                    className="min-h-24 w-full rounded border bg-background px-3 py-2 text-sm"
                    {...form.register('brief')}
                  />
                </div>
                {isOwner && (
                  <>
                    <div className="space-y-1">
                      <Label>Client</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        {...form.register('clientId')}
                      >
                        <option value="">No client (internal)</option>
                        {(clients.data ?? []).map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Required to create invoices against this project later.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Client budget (paise)</Label>
                        <Input type="number" {...form.register('clientBudgetPaise', { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Agency margin (paise)</Label>
                        <Input type="number" {...form.register('agencyMarginPaise', { valueAsNumber: true })} />
                      </div>
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          </RoleGate>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>All projects</CardTitle>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as ProjectStatus | ''); setPage(1); }}
            className="rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            {Object.values(ProjectStatus).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH>Status</TH>
                <TH>Members</TH>
                {isOwner && <TH>Budget</TH>}
                {isOwner && <TH>Margin</TH>}
              </TR>
            </THead>
            <TBody>
              {(list.data?.items ?? []).map((p) => (
                <TR key={p._id}>
                  <TD>
                    <Link className="underline" href={`/projects/${p._id}`}>
                      {p.code}
                    </Link>
                  </TD>
                  <TD>{p.name}</TD>
                  <TD>{p.status}</TD>
                  <TD>{(p.members ?? []).length}</TD>
                  {isOwner && <TD>{p.clientBudgetPaise ? formatPaise(p.clientBudgetPaise, p.currency ?? 'INR') : '—'}</TD>}
                  {isOwner && <TD>{p.agencyMarginPaise ? formatPaise(p.agencyMarginPaise, p.currency ?? 'INR') : '—'}</TD>}
                </TR>
              ))}
            </TBody>
          </Table>
          {list.data && list.data.meta.totalPages > 1 && (
            <Pagination
              page={list.data.meta.page}
              totalPages={list.data.meta.totalPages}
              total={list.data.meta.total}
              onPage={setPage}
              className="pt-4"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
