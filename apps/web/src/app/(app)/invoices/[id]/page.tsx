// Invoice detail (OWNER-only) — line items, payments, send action.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { formatPaise, toPaise, toRupees } from '@/lib/formatters';

import {
  InvoiceLineItems,
  emptyToUndefined,
  emptyToUndefinedNumber,
} from '@/features/invoices/invoice-line-items';
import {
  useDeleteInvoice,
  useInvoice,
  useRecordPayment,
  useSendInvoice,
  useUpdateInvoice,
} from '@/features/invoices/invoices.hooks';
import { useProjects } from '@/features/projects/projects.hooks';
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
  /** Payment amount is entered in rupees; the API stores paise. */
  const [payRupees, setPayRupees] = useState('');
  const editForm = useForm<UpdateInvoiceForm>({
    resolver: zodResolver(updateInvoiceSchema) as never,
  });

  const projects = useProjects({ pageSize: 200 });
  const clientProjects = (projects.data?.items ?? []).filter(
    (p) => !inv.data?.clientId || p.clientId === inv.data.clientId,
  );
  const projectMap = new Map((projects.data?.items ?? []).map((p) => [p._id, p.name]));

  useEffect(() => {
    if (inv.data) {
      editForm.reset({
        lineItems: inv.data.lineItems.map((li) => ({
          description: li.description,
          qty: li.qty,
          unitPaise: li.unitPaise,
          projectId: li.projectId,
          milestoneId: li.milestoneId,
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

  // Header-level project plus every project billed on a line item.
  const linkedProjectIds = [
    ...new Set([i.projectId, ...i.lineItems.map((li) => li.projectId)].filter(Boolean) as string[]),
  ];
  // Per-project totals, so a combined invoice shows what each project owes.
  const projectTotals = new Map<string, number>();
  i.lineItems.forEach((li) => {
    const key = li.projectId ?? '';
    projectTotals.set(key, (projectTotals.get(key) ?? 0) + Math.round(li.qty * li.unitPaise));
  });

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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="grid gap-3">
            <InvoiceLineItems form={editForm} projects={clientProjects} showQty />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>GST %</Label>
                <Input type="number" placeholder="0" {...editForm.register('gstPercent', { setValueAs: emptyToUndefinedNumber })} />
              </div>
              <div className="space-y-1">
                <Label>Issue date</Label>
                <Input type="date" {...editForm.register('issueDate', { setValueAs: emptyToUndefined })} />
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" {...editForm.register('dueDate', { setValueAs: emptyToUndefined })} />
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

      {(linkedProjectIds.length > 0 || i.contractId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Related</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {linkedProjectIds.map((pid) => (
              <Link
                key={pid}
                href={`/projects/${pid}`}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                → {projectMap.get(pid) ?? 'View Project'}
              </Link>
            ))}
            {i.contractId && (
              <Link
                href={`/contracts/${i.contractId}`}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                → View Contract
              </Link>
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
                <TH>Project</TH>
                <TH>Qty</TH>
                <TH>Unit</TH>
                <TH>Total</TH>
              </TR>
            </THead>
            <TBody>
              {i.lineItems.map((li, idx) => (
                <TR key={idx}>
                  <TD>{li.description}</TD>
                  <TD className="text-muted-foreground">
                    {li.projectId ? (
                      <Link href={`/projects/${li.projectId}`} className="hover:underline">
                        {projectMap.get(li.projectId) ?? '—'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD>{li.qty}</TD>
                  <TD>{formatPaise(li.unitPaise, i.currency)}</TD>
                  <TD>{formatPaise(Math.round(li.qty * li.unitPaise), i.currency)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {projectTotals.size > 1 && (
            <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Split across projects
              </p>
              {[...projectTotals.entries()].map(([pid, paise]) => (
                <div key={pid || 'unassigned'} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">
                    {projectMap.get(pid) ?? 'Not linked to a project'}
                  </span>
                  <span className="font-medium tabular-nums">{formatPaise(paise, i.currency)}</span>
                </div>
              ))}
            </div>
          )}
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
                    onSuccess: () => {
                      form.reset({ paidAt: today, amountPaise: 0 } as never);
                      setPayRupees('');
                    },
                  },
                ),
              )}
            >
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" {...form.register('paidAt')} />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <Label>Amount (₹)</Label>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => {
                      setPayRupees(String(toRupees(due)));
                      form.setValue('amountPaise', due as never);
                    }}
                  >
                    Full balance
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={String(toRupees(due))}
                  value={payRupees}
                  onChange={(e) => {
                    setPayRupees(e.target.value);
                    form.setValue('amountPaise', toPaise(e.target.value) as never);
                  }}
                />
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
