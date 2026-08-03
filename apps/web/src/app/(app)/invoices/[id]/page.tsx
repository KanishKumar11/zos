// Invoice detail (OWNER-only) — line items, payments, send action.
'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';

import {
  InvoiceStatus,
  Role,
  recordPaymentSchema,
  updateInvoiceSchema,
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
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/formatters';

import {
  useDeleteInvoice,
  useInvoice,
  useRecordPayment,
  useSendInvoice,
  useUpdateInvoice,
} from '@/features/invoices/invoices.hooks';
import { PageHeader } from '@/components/layout/page-header';

type UpdateInvoiceForm = z.input<typeof updateInvoiceSchema>;

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const inv = useInvoice(id);
  const send = useSendInvoice();
  const pay = useRecordPayment();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const today = new Date().toISOString().slice(0, 10);
  type RecordPaymentForm = z.input<typeof recordPaymentSchema>;
  const form = useForm<RecordPaymentForm>({
    resolver: zodResolver(recordPaymentSchema) as never,
    defaultValues: { paidAt: today, amountPaise: 0 } as never,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editForm = useForm<UpdateInvoiceForm>({
    resolver: zodResolver(updateInvoiceSchema) as never,
  });
  const lineItems = useFieldArray({ control: editForm.control, name: 'lineItems' as never });

  useEffect(() => {
    if (inv.data) {
      editForm.reset({
        lineItems: inv.data.lineItems.map((li) => ({
          description: li.description, qty: li.qty, unitPaise: li.unitPaise,
        })),
        gstPercent: inv.data.gstPercent,
        currency: inv.data.currency,
        issueDate: inv.data.issueDate?.slice(0, 10),
        dueDate: inv.data.dueDate?.slice(0, 10),
        notes: inv.data.notes,
        status: inv.data.status,
      } as never);
    }
  }, [inv.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEditSubmit = editForm.handleSubmit((values) => {
    updateInvoice.mutate({ id, body: values as never }, { onSuccess: () => setEditOpen(false) });
  });

  if (inv.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!inv.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const i = inv.data;
  const due = Math.max(0, i.totalPaise - i.paidPaise);

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.number}
        description={i.status}
        action={
          <div className="flex items-center gap-2">
            {i.status === InvoiceStatus.DRAFT && (
              <Button onClick={() => send.mutate(id)} disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Mark as sent'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="grid gap-3">
            <div className="space-y-2">
              <Label>Line items</Label>
              {lineItems.fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-[1fr_80px_120px_auto] gap-2">
                  <Input
                    placeholder="Description"
                    className="h-8 text-sm"
                    {...editForm.register(`lineItems.${idx}.description` as never)}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    className="h-8 text-sm"
                    {...editForm.register(`lineItems.${idx}.qty` as never, { valueAsNumber: true })}
                  />
                  <Input
                    type="number"
                    placeholder="Unit (paise)"
                    className="h-8 text-sm"
                    {...editForm.register(`lineItems.${idx}.unitPaise` as never, { valueAsNumber: true })}
                  />
                  <button
                    type="button"
                    onClick={() => lineItems.remove(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => lineItems.append({ description: '', qty: 1, unitPaise: 0 } as never)}
                className="text-xs text-primary hover:underline"
              >
                + Add line item
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>GST %</Label>
                <Input type="number" {...editForm.register('gstPercent', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Issue date</Label>
                <Input type="date" {...editForm.register('issueDate')} />
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" {...editForm.register('dueDate')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...editForm.register('status')}>
                {Object.values(InvoiceStatus).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-20 w-full rounded border bg-background px-3 py-2 text-sm"
                {...editForm.register('notes')}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateInvoice.isPending}>
                {updateInvoice.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete invoice <span className="font-medium text-foreground">{i.number}</span>?
            {i.payments.length > 0 && (
              <span className="text-destructive"> This invoice has {i.payments.length} recorded payment(s) — they will be removed too.</span>
            )}
            {' '}This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteInvoice.isPending}
              onClick={() => deleteInvoice.mutate(id, { onSuccess: () => router.push('/invoices') })}
            >
              {deleteInvoice.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        <a
          href={`${env.apiBaseUrl}/invoices/${id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Download PDF
        </a>
      </div>

      {(i.projectId || i.contractId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Related</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            {i.projectId && (
              <a
                href={`/projects/${i.projectId}`}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                → View Project
              </a>
            )}
            {i.contractId && (
              <a
                href={`/contracts/${i.contractId}`}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                → View Contract
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Description</TH>
                <TH>Qty</TH>
                <TH>Unit</TH>
                <TH>Total</TH>
              </TR>
            </THead>
            <TBody>
              {i.lineItems.map((li, idx) => (
                <TR key={idx}>
                  <TD>{li.description}</TD>
                  <TD>{li.qty}</TD>
                  <TD>{formatPaise(li.unitPaise, i.currency)}</TD>
                  <TD>{formatPaise(Math.round(li.qty * li.unitPaise), i.currency)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 grid gap-1 text-sm">
            <p>Subtotal: {formatPaise(i.subTotalPaise, i.currency)}</p>
            <p>GST {i.gstPercent}%: {formatPaise(i.gstPaise, i.currency)}</p>
            <p className="font-semibold">Total: {formatPaise(i.totalPaise, i.currency)}</p>
            <p>Paid: {formatPaise(i.paidPaise, i.currency)}</p>
            <p>Outstanding: {formatPaise(due, i.currency)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Amount</TH>
                <TH>Reference</TH>
                <TH>Method</TH>
              </TR>
            </THead>
            <TBody>
              {i.payments.map((p) => (
                <TR key={p._id}>
                  <TD>{new Date(p.paidAt).toLocaleDateString()}</TD>
                  <TD>{formatPaise(p.amountPaise, i.currency)}</TD>
                  <TD>{p.reference || '—'}</TD>
                  <TD>{p.method || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {due > 0 && (
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={form.handleSubmit((v) =>
                pay.mutate(
                  { id, body: v as never },
                  {
                    onSuccess: () => form.reset({ paidAt: today, amountPaise: 0 } as never),
                  },
                ),
              )}
            >
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...form.register('paidAt')} />
              </div>
              <div className="space-y-1">
                <Label>Amount (paise)</Label>
                <Input type="number" {...form.register('amountPaise', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input {...form.register('reference')} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pay.isPending}>
                  {pay.isPending ? 'Saving…' : 'Record'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
