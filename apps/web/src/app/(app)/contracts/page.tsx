// Contracts list page (OWNER-only).
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import {
  ContractStatus,
  Role,
  createContractSchema,
  updateContractSchema,
  type CreateContractInput,
} from '@agency/shared';

type UpdateContractForm = z.input<typeof updateContractSchema>;

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
import { useClients } from '@/features/clients/clients.hooks';
import {
  type ContractRow,
  useContracts,
  useCreateContract,
  useDeleteContract,
  useUpdateContract,
} from '@/features/contracts/contracts.hooks';

export default function ContractsPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVE]: 'Active',
  [ContractStatus.PAUSED]: 'Paused',
  [ContractStatus.COMPLETED]: 'Completed',
};

function Inner() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContractRow | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const list = useContracts({
    ...(clientFilter ? { clientId: clientFilter } : {}),
    ...(statusFilter ? { status: statusFilter as ContractStatus } : {}),
  });
  const clients = useClients();
  const create = useCreateContract();
  const update = useUpdateContract();
  const del = useDeleteContract();

  const clientMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));

  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      name: '',
      clientId: '',
      monthlyAmountPaise: 0,
      currency: 'INR',
      status: ContractStatus.ACTIVE,
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    }),
  );

  const editForm = useForm<UpdateContractForm>({
    resolver: zodResolver(updateContractSchema) as never,
  });

  useEffect(() => {
    if (editing) {
      editForm.reset({
        name: editing.name,
        clientId: editing.clientId,
        description: editing.description,
        monthlyAmountPaise: editing.monthlyAmountPaise,
        currency: editing.currency,
        status: editing.status,
        startDate: editing.startDate?.slice(0, 10),
        endDate: editing.endDate?.slice(0, 10),
        notes: editing.notes,
        billingDay: editing.billingDay,
      } as never);
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editing) return;
    update.mutate(
      { id: editing._id, body: values as never },
      { onSuccess: () => setEditing(null) },
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Manage retainer and monthly development contracts."
        action={<Button onClick={() => setOpen(true)}>New contract</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create contract</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...form.register('name')} placeholder="e.g. Monthly Development Retainer" />
            </div>
            <div className="space-y-1">
              <Label>Client</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('clientId')}
              >
                <option value="">Select client…</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.clientId && (
                <p className="text-xs text-destructive">{form.formState.errors.clientId.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...form.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monthly amount (paise)</Label>
                <Input
                  type="number"
                  {...form.register('monthlyAmountPaise', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...form.register('currency')} defaultValue="INR" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" {...form.register('startDate')} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" {...form.register('endDate')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register('status')}
                >
                  {(Object.values(ContractStatus) as ContractStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Billing day</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  placeholder="e.g. 1"
                  {...form.register('billingDay', { valueAsNumber: true })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Day of month the dashboard reminds you to invoice this contract.
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-20 w-full rounded border bg-background px-3 py-2 text-sm"
                {...form.register('notes')}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contract</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={onEditSubmit}>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...editForm.register('name')} />
            </div>
            <div className="space-y-1">
              <Label>Client</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...editForm.register('clientId')}
              >
                {(clients.data ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...editForm.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monthly amount (paise)</Label>
                <Input type="number" {...editForm.register('monthlyAmountPaise', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input {...editForm.register('currency')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" {...editForm.register('startDate')} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" {...editForm.register('endDate')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...editForm.register('status')}
                >
                  {(Object.values(ContractStatus) as ContractStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Billing day</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  placeholder="e.g. 1"
                  {...editForm.register('billingDay', { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-20 w-full rounded border bg-background px-3 py-2 text-sm"
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

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{confirmDelete?.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() =>
                confirmDelete &&
                del.mutate(confirmDelete._id, { onSuccess: () => setConfirmDelete(null) })
              }
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>All contracts</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-sm"
            >
              <option value="">All clients</option>
              {(clients.data ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-sm"
            >
              <option value="">All statuses</option>
              {(Object.values(ContractStatus) as ContractStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Client</TH>
                <TH>Monthly</TH>
                <TH>Billing day</TH>
                <TH>Status</TH>
                <TH>Start</TH>
                <TH>Notes</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((c) => (
                <TR key={c._id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{clientMap.get(c.clientId) ?? c.clientId.slice(-6)}</TD>
                  <TD>{formatPaise(c.monthlyAmountPaise, c.currency)}</TD>
                  <TD className="text-muted-foreground">
                    {c.billingDay ? `Day ${c.billingDay}` : '— (no reminder)'}
                  </TD>
                  <TD>
                    <span
                      className={
                        c.status === ContractStatus.ACTIVE
                          ? 'text-green-600'
                          : c.status === ContractStatus.COMPLETED
                            ? 'text-muted-foreground'
                            : 'text-amber-600'
                      }
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </TD>
                  <TD>{c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}</TD>
                  <TD className="max-w-xs truncate text-muted-foreground">{c.notes || '—'}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <a href={`/contracts/${c._id}`} className="text-xs text-primary hover:underline">
                        View →
                      </a>
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(c)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
              {!list.isLoading && (list.data ?? []).length === 0 && (
                <TR>
                  <TD colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No contracts match these filters.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
