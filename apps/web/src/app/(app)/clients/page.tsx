// Clients list page (OWNER-only).
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  ProjectStatus,
  Role,
  createClientSchema,
  type CreateClientInput,
} from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

import { PageHeader } from '@/components/layout/page-header';
import { useClients, useCreateClient } from '@/features/clients/clients.hooks';
import { useProjects } from '@/features/projects/projects.hooks';

export default function ClientsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const list = useClients(search || undefined);
  const create = useCreateClient();
  const projects = useProjects({ pageSize: 200 });

  const projectCountMap = new Map<string, { total: number; active: number }>();
  for (const p of projects.data?.items ?? []) {
    if (!p.clientId) continue;
    const entry = projectCountMap.get(p.clientId) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (p.status === ProjectStatus.ACTIVE) entry.active += 1;
    projectCountMap.set(p.clientId, entry);
  }
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: '' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage client accounts and contacts."
        action={
          <Button onClick={() => setOpen(true)}>New client</Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create client</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={form.handleSubmit((v) =>
                create.mutate(v, {
                  onSuccess: () => {
                    setOpen(false);
                    form.reset({ name: '' });
                  },
                }),
              )}
            >
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...form.register('name')} />
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input {...form.register('gstin')} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input {...form.register('address')} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>GSTIN</TH>
                <TH>Contacts</TH>
                <TH>Projects</TH>
                <TH>Active</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((c) => (
                <TR key={c._id}>
                  <TD>
                    <Link className="underline" href={`/clients/${c._id}`}>
                      {c.name}
                    </Link>
                  </TD>
                  <TD>{c.gstin || '—'}</TD>
                  <TD>{c.contacts.length}</TD>
                  <TD>{projectCountMap.get(c._id)?.total ?? 0}</TD>
                  <TD>{projectCountMap.get(c._id)?.active ?? 0}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
