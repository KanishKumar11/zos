// Contracts list page (OWNER-only).
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  ContractStatus,
  Role,
  createContractSchema,
  type CreateContractInput,
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
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useClients } from '@/features/clients/clients.hooks';
import { useContracts, useCreateContract } from '@/features/contracts/contracts.hooks';

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
  const list = useContracts();
  const clients = useClients();
  const create = useCreateContract();

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

      <Card>
        <CardHeader>
          <CardTitle>All contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Client</TH>
                <TH>Monthly</TH>
                <TH>Status</TH>
                <TH>Start</TH>
                <TH>Notes</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((c) => (
                <TR key={c._id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{clientMap.get(c.clientId) ?? c.clientId.slice(-6)}</TD>
                  <TD>{formatPaise(c.monthlyAmountPaise, c.currency)}</TD>
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
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
