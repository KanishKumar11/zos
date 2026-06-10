// Invoice detail (OWNER-only) — line items, payments, send action.
'use client';

import { use } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';

import {
  InvoiceStatus,
  Role,
  recordPaymentSchema,
} from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/formatters';

import {
  useInvoice,
  useRecordPayment,
  useSendInvoice,
} from '@/features/invoices/invoices.hooks';
import { PageHeader } from '@/components/layout/page-header';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner id={id} />
    </RoleGate>
  );
}

function Inner({ id }: { id: string }) {
  const inv = useInvoice(id);
  const send = useSendInvoice();
  const pay = useRecordPayment();
  const today = new Date().toISOString().slice(0, 10);
  type RecordPaymentForm = z.input<typeof recordPaymentSchema>;
  const form = useForm<RecordPaymentForm>({
    resolver: zodResolver(recordPaymentSchema) as never,
    defaultValues: { paidAt: today, amountPaise: 0 } as never,
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
          i.status === InvoiceStatus.DRAFT ? (
            <Button onClick={() => send.mutate(id)} disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Mark as sent'}
            </Button>
          ) : undefined
        }
      />

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
