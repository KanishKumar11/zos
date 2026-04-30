// Invoices list (OWNER-only).
'use client';

import Link from 'next/link';

import { InvoiceStatus, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise } from '@/lib/formatters';

import { useInvoices } from '@/features/invoices/invoices.hooks';

export default function InvoicesPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const list = useInvoices();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <Card>
        <CardHeader>
          <CardTitle>All invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Client</TH>
                <TH>Status</TH>
                <TH>Total</TH>
                <TH>Paid</TH>
                <TH>Due</TH>
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
                  <TD>{inv.clientId.slice(-6)}</TD>
                  <TD>
                    <span
                      className={
                        inv.status === InvoiceStatus.OVERDUE
                          ? 'text-red-600'
                          : inv.status === InvoiceStatus.PAID
                            ? 'text-green-600'
                            : ''
                      }
                    >
                      {inv.status}
                    </span>
                  </TD>
                  <TD>{formatPaise(inv.totalPaise, inv.currency)}</TD>
                  <TD>{formatPaise(inv.paidPaise, inv.currency)}</TD>
                  <TD>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
