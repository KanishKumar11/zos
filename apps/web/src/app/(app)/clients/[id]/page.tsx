// Client detail (OWNER-only).
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { Role, updateClientSchema } from '@agency/shared';

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
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useClient, useDeleteClient, useUpdateClient } from '@/features/clients/clients.hooks';
import { useProjects } from '@/features/projects/projects.hooks';

type UpdateClientForm = z.input<typeof updateClientSchema>;

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const c = useClient(id);
  const update = useUpdateClient();
  const del = useDeleteClient();
  const projects = useProjects({ clientId: id, pageSize: 100 });

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema) as never,
  });
  const contacts = useFieldArray({ control: editForm.control, name: 'contacts' as never });

  useEffect(() => {
    if (c.data) {
      editForm.reset({
        name: c.data.name,
        gstin: c.data.gstin,
        address: c.data.address,
        notes: c.data.notes,
        contacts: c.data.contacts,
      } as never);
    }
  }, [c.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    update.mutate({ id, body: values as never }, { onSuccess: () => setEditOpen(false) });
  });

  if (c.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!c.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const client = c.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={client.gstin || 'No GSTIN'}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...editForm.register('name')} />
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input {...editForm.register('gstin')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input {...editForm.register('address')} />
            </div>
            <div className="space-y-2">
              <Label>Contacts</Label>
              {contacts.fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
                  <Input placeholder="Name" className="h-8 text-sm" {...editForm.register(`contacts.${idx}.name` as never)} />
                  <Input placeholder="Email" className="h-8 text-sm" {...editForm.register(`contacts.${idx}.email` as never)} />
                  <Input placeholder="Phone" className="h-8 text-sm" {...editForm.register(`contacts.${idx}.phone` as never)} />
                  <Input placeholder="Role" className="h-8 text-sm" {...editForm.register(`contacts.${idx}.role` as never)} />
                  <button
                    type="button"
                    onClick={() => contacts.remove(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => contacts.append({ name: '' } as never)}
                className="text-xs text-primary hover:underline"
              >
                + Add contact
              </button>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-24 w-full rounded border bg-background px-3 py-2 text-sm"
                {...editForm.register('notes')}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{client.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => del.mutate(id, { onSuccess: () => router.push('/clients') })}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{client.address || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {client.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts recorded.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH>Role</TH>
                </TR>
              </THead>
              <TBody>
                {client.contacts.map((cc, i) => (
                  <TR key={i}>
                    <TD>{cc.name}</TD>
                    <TD>{cc.email ?? '—'}</TD>
                    <TD>{cc.phone ?? '—'}</TD>
                    <TD>{cc.role ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects ({projects.data?.items.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(projects.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>Status</TH>
                  <TH>Budget</TH>
                </TR>
              </THead>
              <TBody>
                {(projects.data?.items ?? []).map((p) => (
                  <TR key={p._id}>
                    <TD>
                      <Link href={`/projects/${p._id}`} className="text-blue-600 hover:underline">
                        {p.code}
                      </Link>
                    </TD>
                    <TD>{p.name}</TD>
                    <TD>{p.status}</TD>
                    <TD>{p.clientBudgetPaise ? formatPaise(p.clientBudgetPaise, p.currency ?? 'INR') : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{client.notes || '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
