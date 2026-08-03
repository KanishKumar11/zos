'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ArrowRight, Calendar, DollarSign, FileText, Plus } from 'lucide-react';

import { ContractStatus, Role, updateContractSchema } from '@agency/shared';

type UpdateContractForm = z.input<typeof updateContractSchema>;

import { RoleGate } from '@/components/auth/role-gate';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise, formatDate } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import {
  useContract,
  useDeleteContract,
  useGenerateContractInvoice,
  useUpdateContract,
} from '@/features/contracts/contracts.hooks';
import { useClients } from '@/features/clients/clients.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';

const STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [ContractStatus.PAUSED]: 'bg-yellow-100 text-yellow-800',
  [ContractStatus.COMPLETED]: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVE]: 'Active',
  [ContractStatus.PAUSED]: 'Paused',
  [ContractStatus.COMPLETED]: 'Completed',
};

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.id as string;

  return (
    <RoleGate
      allow={[Role.OWNER]}
      fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}
    >
      <Inner contractId={contractId} />
    </RoleGate>
  );
}

function Inner({ contractId }: { contractId: string }) {
  const router = useRouter();
  const contract = useContract(contractId);
  const clients = useClients();
  const invoices = useInvoices({ contractId });
  const generateInvoice = useGenerateContractInvoice();
  const update = useUpdateContract();
  const del = useDeleteContract();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editForm = useForm<UpdateContractForm>({
    resolver: zodResolver(updateContractSchema) as never,
  });

  useEffect(() => {
    if (contract.data) {
      editForm.reset({
        name: contract.data.name,
        clientId: contract.data.clientId,
        description: contract.data.description,
        monthlyAmountPaise: contract.data.monthlyAmountPaise,
        currency: contract.data.currency,
        status: contract.data.status,
        startDate: contract.data.startDate?.slice(0, 10),
        endDate: contract.data.endDate?.slice(0, 10),
        notes: contract.data.notes,
        billingDay: contract.data.billingDay,
      } as never);
    }
  }, [contract.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    update.mutate({ id: contractId, body: values as never }, { onSuccess: () => setEditOpen(false) });
  });

  const clientName = clients.data?.find((c) => c._id === contract.data?.clientId)?.name;
  const contractInvoices = invoices.data || [];
  const totalBilled = contractInvoices.reduce((sum, inv) => sum + inv.totalPaise, 0);
  const totalPaid = contractInvoices.reduce((sum, inv) => sum + inv.paidPaise, 0);
  const totalOutstanding = totalBilled - totalPaid;

  if (contract.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contract.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Contract not found</p>
      </div>
    );
  }

  const c = contract.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={c.description}
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={() =>
                generateInvoice.mutate(
                  { id: contractId, month: selectedMonth },
                  { onSuccess: (data) => router.push(`/invoices/${data._id}`) },
                )
              }
              disabled={generateInvoice.isPending}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              {generateInvoice.isPending ? 'Generating…' : 'Generate Invoice'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
                {(clients.data ?? []).map((cl) => (
                  <option key={cl._id} value={cl._id}>
                    {cl.name}
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

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{c.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => del.mutate(contractId, { onSuccess: () => router.push('/contracts') })}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={STATUS_COLORS[c.status]}>
              {STATUS_LABELS[c.status]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/clients/${c.clientId}`} className="font-semibold hover:underline">
              {clientName}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{formatPaise(c.monthlyAmountPaise)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{c.startDate ? formatDate(c.startDate) : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {c.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{c.notes}</p>
            </div>
          )}
          {c.endDate && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p className="mt-1 text-sm">{formatDate(c.endDate)}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Currency</p>
            <p className="mt-1 text-sm">{c.currency}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Billing Reminder</p>
            {c.billingDay ? (
              <p className="mt-1 text-sm">Day {c.billingDay} of every month</p>
            ) : (
              <p className="mt-1 text-sm text-amber-600">
                No billing day set — this contract won&apos;t trigger a dashboard invoicing reminder. Click Edit to set one.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {contractInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Financials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Billed</p>
                <p className="mt-2 text-2xl font-bold">{formatPaise(totalBilled)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{formatPaise(totalPaid)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-2xl font-bold text-orange-600">{formatPaise(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contractInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Invoices ({contractInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice #</TH>
                    <TH>Project</TH>
                    <TH>Amount</TH>
                    <TH>Paid</TH>
                    <TH>Status</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {contractInvoices.map((inv) => (
                    <TR key={inv._id}>
                      <TD className="font-mono text-sm">{inv.number}</TD>
                      <TD className="text-sm">
                        {inv.projectId ? (
                          <Link
                            href={`/projects/${inv.projectId}`}
                            className="text-blue-600 hover:underline"
                          >
                            View Project
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD className="font-semibold">{formatPaise(inv.totalPaise)}</TD>
                      <TD>{formatPaise(inv.paidPaise)}</TD>
                      <TD>
                        <Badge variant="outline">{inv.status}</Badge>
                      </TD>
                      <TD>
                        <Link
                          href={`/invoices/${inv._id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {contractInvoices.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">No invoices linked to this contract</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
