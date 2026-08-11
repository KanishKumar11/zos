// Invoices list (OWNER-only).
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { InvoiceStatus, Role, createInvoiceSchema } from '@agency/shared';

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
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useClients } from '@/features/clients/clients.hooks';
import { useContracts } from '@/features/contracts/contracts.hooks';
import {
  InvoiceLineItems,
  emptyToUndefined,
  emptyToUndefinedNumber,
} from '@/features/invoices/invoice-line-items';
import { useCreateInvoice, useInvoices, type InvoiceRow } from '@/features/invoices/invoices.hooks';
import { useInvoiceAging, useInvoiceDashboard } from '@/features/invoices/invoices.hooks';
import { useProjects } from '@/features/projects/projects.hooks';

type CreateInvoiceForm = z.input<typeof createInvoiceSchema>;

/** Collects every project an invoice touches — header-level and per line item. */
function invoiceProjectIds(inv: InvoiceRow): string[] {
  const ids = new Set<string>();
  if (inv.projectId) ids.add(inv.projectId);
  inv.lineItems.forEach((li) => li.projectId && ids.add(li.projectId));
  return [...ids];
}

function InvoiceLinks({
  invoice,
  projectMap,
  contractMap,
}: {
  invoice: InvoiceRow;
  projectMap: Map<string, string>;
  contractMap: Map<string, string>;
}) {
  const projectIds = invoiceProjectIds(invoice);
  if (projectIds.length === 0) {
    return invoice.contractId ? (
      <Link href={`/contracts/${invoice.contractId}`} className="hover:underline">
        {contractMap.get(invoice.contractId) ?? '—'}
      </Link>
    ) : (
      <>—</>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {projectIds.map((pid) => (
        <Link key={pid} href={`/projects/${pid}`} className="hover:underline">
          {projectMap.get(pid) ?? '—'}
        </Link>
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [clientFilter, setClientFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const list = useInvoices({
    status: statusFilter || undefined,
    clientId: clientFilter || undefined,
  });
  const dash = useInvoiceDashboard();
  const aging = useInvoiceAging();
  const clients = useClients();
  const projects = useProjects({ pageSize: 200 });
  const contracts = useContracts();
  const createInvoice = useCreateInvoice();
  const d = dash.data;

  const clientMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));
  const projectMap = new Map((projects.data?.items ?? []).map((p) => [p._id, p.name]));
  const contractMap = new Map((contracts.data ?? []).map((c) => [c._id, c.name]));

  const createForm = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema) as never,
    defaultValues: {
      clientId: '',
      lineItems: [{ description: '', qty: 1, unitPaise: 0 }],
      currency: 'INR',
    } as never,
  });

  /** Only offer projects belonging to the client selected in the create form. */
  const selectedClientId = createForm.watch('clientId');
  const clientProjects = (projects.data?.items ?? []).filter(
    (p) => !selectedClientId || p.clientId === selectedClientId,
  );

  const onCreateSubmit = createForm.handleSubmit((values) => {
    createInvoice.mutate(values as never, {
      onSuccess: (data) => {
        setCreateOpen(false);
        createForm.reset({ clientId: '', lineItems: [{ description: '', qty: 1, unitPaise: 0 }], currency: 'INR' } as never);
        router.push(`/invoices/${data._id}`);
      },
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Billing and collections overview."
        action={<Button onClick={() => setCreateOpen(true)}>New invoice</Button>}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="grid gap-3">
            <div className="space-y-1">
              <Label>Client</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...createForm.register('clientId')}
              >
                <option value="">Select client…</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Contract (optional — for retainer billing)</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...createForm.register('contractId')}
              >
                <option value="">No contract</option>
                {(contracts.data ?? []).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <InvoiceLineItems form={createForm} projects={clientProjects} />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>GST %</Label>
                {/* Blank must submit as "no GST" rather than NaN, which the schema rejects. */}
                <Input type="number" placeholder="0" {...createForm.register('gstPercent', { setValueAs: emptyToUndefinedNumber })} />
              </div>
              <div className="space-y-1">
                <Label>Issue date</Label>
                <Input type="date" {...createForm.register('issueDate', { setValueAs: emptyToUndefined })} />
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" {...createForm.register('dueDate', { setValueAs: emptyToUndefined })} />
              </div>
            </div>
            {createForm.formState.errors.lineItems && (
              <p className="text-xs text-destructive">
                Every line item needs a description and an amount.
              </p>
            )}
            {createForm.formState.errors.clientId && (
              <p className="text-xs text-destructive">Select a client.</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? 'Creating…' : 'Create draft'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Billed</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {d ? formatPaise(d.billedPaise, 'INR') : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums text-[hsl(var(--success))]">
            {d ? formatPaise(d.collectedPaise, 'INR') : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums text-amber-600">
            {d ? formatPaise(d.outstandingPaise, 'INR') : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums text-destructive">
            {d ? formatPaise(d.overduePaise, 'INR') : '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Bucket</TH>
                <TH>Invoices</TH>
                <TH>Open amount</TH>
              </TR>
            </THead>
            <TBody>
              {(aging.data ?? []).map((b) => (
                <TR key={b.range}>
                  <TD>{b.range}</TD>
                  <TD>{b.countInvoices}</TD>
                  <TD>{formatPaise(b.openPaise, 'INR')}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle>All invoices</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
              className="text-sm"
            >
              <option value="">All statuses</option>
              {Object.values(InvoiceStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="text-sm"
            >
              <option value="">All clients</option>
              {(clients.data ?? []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Issued</TH>
                <TH>Client</TH>
                <TH>Project / Contract</TH>
                <TH>Status</TH>
                <TH>Total</TH>
                <TH>Paid</TH>
                <TH>Due</TH>
                <TH>PDF</TH>
              </TR>
            </THead>
            <TBody>
              {(list.data ?? []).map((inv) => (
                <TR key={inv._id}>
                  <TD>
                    <Link className="underline" href={`/invoices/${inv._id}`}>
                      {inv.number}
                    </Link>
                  </TD>
                  <TD>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '—'}</TD>
                  <TD>
                    <Link href={`/clients/${inv.clientId}`} className="hover:underline">
                      {clientMap.get(inv.clientId) ?? inv.clientId.slice(-6)}
                    </Link>
                  </TD>
                  <TD>
                    <InvoiceLinks
                      invoice={inv}
                      projectMap={projectMap}
                      contractMap={contractMap}
                    />
                  </TD>
                  <TD>
                    <span
                      className={
                        inv.status === InvoiceStatus.OVERDUE
                          ? 'text-red-600'
                          : inv.status === InvoiceStatus.PAID
                            ? 'text-green-600'
                            : inv.status === InvoiceStatus.WRITTEN_OFF
                              ? 'text-muted-foreground line-through'
                              : ''
                      }
                    >
                      {inv.status}
                    </span>
                  </TD>
                  <TD>{formatPaise(inv.totalPaise, inv.currency)}</TD>
                  <TD>{formatPaise(inv.paidPaise, inv.currency)}</TD>
                  <TD>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</TD>
                  <TD>
                    <a
                      href={`${env.apiBaseUrl}/invoices/${inv._id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Download
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
