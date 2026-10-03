'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

import { invoicePaymentMethodLabel } from '@agency/shared';

import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { todayLocal, toLocalDateInput } from '@/lib/form';

import { usePageTitle } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { ActivityTimeline, Bento, FillJar, Price, Tile } from '@/components/viz';
import { daysBetween, invoiceWord } from '@/features/portal/invoice-words';
import { usePortalInvoice } from '@/features/portal/portal.hooks';
import { PaidStamp, shortDate } from '@/features/portal/portal-ui';

export default function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const inv = usePortalInvoice(id);
  usePageTitle(inv.data ? `Invoice ${inv.data.number}` : 'Invoice', [{ label: 'Invoices', href: '/portal/invoices' }]);

  const back = (
    <Link href="/portal/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> All invoices
    </Link>
  );

  if (inv.isLoading) return <PageSkeleton />;
  if (inv.isError || !inv.data) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState title="Couldn't open this invoice" error={inv.error} onRetry={() => inv.refetch()} />
      </div>
    );
  }
  const i = inv.data;
  const cur = i.currency;
  const word = invoiceWord(i);
  const settled = i.status === 'PAID';
  const late = i.status === 'OVERDUE';
  const daysLate = late && i.dueDate ? daysBetween(toLocalDateInput(i.dueDate), todayLocal()) : 0;
  const payments = [...(i.payments ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <div className="space-y-6">
      {back}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">
            Invoice <span className="font-figures">{i.number}</span>
            {i.projects.length > 0 ? ` · ${i.projects.join(', ')}` : ''}
          </p>
          <h1 className="font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.05]">
            {settled ? (
              <>
                Paid in full — <span className="text-success">thank you</span>.
              </>
            ) : i.status === 'WRITTEN_OFF' || i.status === 'VOID' ? (
              <>Nothing more to pay on this invoice.</>
            ) : (
              <>
                <Price paise={i.balancePaise} currency={cur} className="font-display text-brand" /> left to pay
                {i.dueDate ? (late ? `, was due ${shortDate(i.dueDate)}` : ` by ${shortDate(i.dueDate)}`) : ''}.
              </>
            )}
          </h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={`${env.apiBaseUrl}/portal/invoices/${i._id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
          </a>
        </Button>
      </header>

      {late && (
        <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium">This invoice is past its due date{daysLate > 0 ? ` by ${daysLate} day${daysLate === 1 ? '' : 's'}` : ''}.</p>
          <p className="mt-0.5 text-muted-foreground">
            Please pay when you can. If you&rsquo;ve already paid, thank you — it can take a day or two to show here. Questions? Just reply to the invoice email.
          </p>
        </div>
      )}

      <Bento>
        {/* The invoice as a sheet of paper */}
        <Tile span={8} className="relative overflow-hidden" bodyClassName="space-y-4">
          {settled && <PaidStamp className="absolute right-5 top-5 text-2xl" />}
          <dl className="grid grid-cols-2 gap-3 pr-20 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Issued</dt>
              <dd className="font-medium">{i.issueDate ? shortDate(i.issueDate) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due</dt>
              <dd className={cn('font-medium', late && 'text-destructive')}>{i.dueDate ? shortDate(i.dueDate) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className={cn('font-medium', word.tone === 'bad' && 'text-destructive', word.tone === 'good' && 'text-success', word.tone === 'muted' && 'text-muted-foreground')}>
                {word.label}
              </dd>
            </div>
          </dl>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium sm:px-5">What it&rsquo;s for</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(i.lineItems ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-4 text-center text-muted-foreground">
                      The details are in the PDF.
                    </td>
                  </tr>
                ) : (
                  i.lineItems!.map((l, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 sm:px-5">{l.description}</td>
                      <td className="px-3 py-2.5 text-right font-figures">{l.qty}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Price paise={l.unitPaise} currency={cur} />
                      </td>
                      <td className="px-4 py-2.5 text-right sm:px-5">
                        <Price paise={l.amountPaise} currency={cur} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t border-dashed text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground sm:px-5">Subtotal</td>
                  <td className="px-4 py-2 text-right sm:px-5">
                    <Price paise={i.subTotalPaise} currency={cur} />
                  </td>
                </tr>
                {i.gstPaise > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground sm:px-5">GST {i.gstPercent}%</td>
                    <td className="px-4 py-2 text-right sm:px-5">
                      <Price paise={i.gstPaise} currency={cur} />
                    </td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <td colSpan={3} className="px-4 py-2 text-right sm:px-5">Total</td>
                  <td className="px-4 py-2 text-right sm:px-5">
                    <Price paise={i.totalPaise} currency={cur} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {i.notes && <p className="whitespace-pre-line border-t pt-4 text-[13px] text-muted-foreground">{i.notes}</p>}
        </Tile>

        <div className="col-span-12 grid content-start gap-3.5 lg:col-span-4">
          <Tile title="Balance">
            <div className="flex items-center gap-4">
              <FillJar value={i.paidPaise} max={i.totalPaise} size="lg" label={`Paid ${i.totalPaise > 0 ? Math.round((i.paidPaise / i.totalPaise) * 100) : 0}% of this invoice`} />
              <dl className="flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd>
                    <Price paise={i.totalPaise} currency={cur} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="text-success">
                    <Price paise={i.paidPaise} currency={cur} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t pt-1.5 font-semibold">
                  <dt>Left to pay</dt>
                  <dd>
                    <Price paise={i.balancePaise} currency={cur} />
                  </dd>
                </div>
              </dl>
            </div>
          </Tile>
          <Tile title="Payments received">
            <ActivityTimeline
              items={payments.map((p, idx) => ({
                key: `${p.paidAt}-${idx}`,
                date: p.paidAt,
                color: 'hsl(var(--success))',
                title: <Price paise={p.amountPaise} currency={cur} />,
                meta: [shortDate(p.paidAt), invoicePaymentMethodLabel(p.method), p.reference ? `ref ${p.reference}` : ''].filter(Boolean).join(' · '),
              }))}
              empty={<p className="text-sm text-muted-foreground">No payments recorded yet.</p>}
            />
          </Tile>
        </div>
      </Bento>
    </div>
  );
}
