'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

import { env } from '@/lib/env';
import { formatDate, formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { usePortalInvoice } from '@/features/portal/portal.hooks';

export default function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const inv = usePortalInvoice(id);
  if (inv.isLoading) return <PageSkeleton />;
  if (inv.isError || !inv.data) return <ErrorState title="Couldn't open this invoice" error={inv.error} onRetry={() => inv.refetch()} />;
  const i = inv.data;
  const cur = i.currency;

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices" className="text-sm text-muted-foreground hover:text-foreground">
        ← All invoices
      </Link>
      <PageHeader
        title={`Invoice ${i.number}`}
        meta={<StatusBadge status={i.status} />}
        description={[i.projects.join(', '), i.issueDate ? `Issued ${formatDate(i.issueDate)}` : '', i.dueDate ? `Due ${formatDate(i.dueDate)}` : ''].filter(Boolean).join(' · ')}
        action={
          <Button asChild size="sm" variant="outline">
            <a href={`${env.apiBaseUrl}/portal/invoices/${i._id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Description</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(i.lineItems ?? []).map((l, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-2.5">{l.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPaise(l.unitPaise, cur)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatPaise(l.amountPaise, cur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t text-sm">
                <tr>
                  <td colSpan={3} className="px-5 py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="px-5 py-2 text-right tabular-nums">{formatPaise(i.subTotalPaise, cur)}</td>
                </tr>
                {i.gstPaise > 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-2 text-right text-muted-foreground">GST {i.gstPercent}%</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatPaise(i.gstPaise, cur)}</td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <td colSpan={3} className="px-5 py-2 text-right">Total</td>
                  <td className="px-5 py-2 text-right tabular-nums">{formatPaise(i.totalPaise, cur)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="tabular-nums">{formatPaise(i.totalPaise, cur)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="tabular-nums text-[hsl(var(--success))]">{formatPaise(i.paidPaise, cur)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Balance due</span>
                <span className="tabular-nums">{formatPaise(i.balancePaise, cur)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments received</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(i.payments ?? []).length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y">
                  {i.payments!.map((p, idx) => (
                    <li key={idx} className="flex justify-between gap-3 px-5 py-2.5 text-[13px]">
                      <span className="text-muted-foreground">
                        {formatDate(p.paidAt)}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </span>
                      <span className="tabular-nums">{formatPaise(p.amountPaise, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {i.notes && (
            <Card>
              <CardContent className="whitespace-pre-line p-5 text-[13px] text-muted-foreground">{i.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
