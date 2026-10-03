// Portal invoices — what's due, what's been paid, and every invoice as a card (or a table).
'use client';

import { LayoutGrid, Receipt, Table2 } from 'lucide-react';
import Link from 'next/link';

import { invoicePaymentMethodLabel } from '@agency/shared';

import { cn } from '@/lib/cn';
import { useListState } from '@/lib/list-state';
import { todayLocal, toLocalDateInput } from '@/lib/form';

import { DataTable, type Column } from '@/components/data/data-table';
import { ViewToggle } from '@/components/data/view-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityTimeline, Bento, BigNumber, Hero, HeroFigure, Price, SegmentBar, Tile } from '@/components/viz';
import { usePortalInvoices, type PortalInvoice } from '@/features/portal/portal.hooks';
import { daysBetween, invoiceWord, isOpen } from '@/features/portal/invoice-words';
import { BalanceMeter, PaidStamp, shortDate } from '@/features/portal/portal-ui';

export default function PortalInvoices() {
  const invoices = usePortalInvoices();
  const list = useListState('portal-invoices', { show: 'all', view: 'cards' });
  const show = list.params.show === 'open' ? 'open' : 'all';
  const view = list.params.view === 'table' ? 'table' : 'cards';

  const all = invoices.data ?? [];
  const open = all.filter(isOpen);
  const rows = show === 'open' ? open : all;
  const overdueList = open.filter((i) => i.status === 'OVERDUE');
  const overdue = overdueList.reduce((s, i) => s + i.balancePaise, 0);
  const due = open.reduce((s, i) => s + i.balancePaise, 0);
  const paid = all.reduce((s, i) => s + i.paidPaise, 0);
  const nextDue = [...open].filter((i) => i.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
  const payments = all
    .flatMap((i) => (i.payments ?? []).map((p, idx) => ({ ...p, key: `${i._id}-${idx}`, invoice: i })))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 8);

  const columns: Column<PortalInvoice>[] = [
    { id: 'number', header: 'Invoice', cell: (r) => <span className="font-figures font-medium">{r.number}</span> },
    { id: 'projects', header: 'For', hideBelow: 'md', cell: (r) => <span className="text-muted-foreground">{r.projects.join(', ') || 'General work'}</span> },
    { id: 'issued', header: 'Issued', hideBelow: 'sm', cell: (r) => (r.issueDate ? shortDate(r.issueDate) : '—') },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => (r.dueDate ? <span className={r.status === 'OVERDUE' ? 'font-medium text-destructive' : ''}>{shortDate(r.dueDate)}</span> : '—'),
    },
    { id: 'status', header: 'Status', cell: (r) => <StatusWord invoice={r} /> },
    { id: 'total', header: 'Total', align: 'right', cell: (r) => <Price paise={r.totalPaise} currency={r.currency} /> },
    {
      id: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (r) => <Price paise={r.balancePaise} currency={r.currency} className={r.balancePaise > 0 ? 'font-medium' : 'text-muted-foreground'} />,
    },
  ];

  if (invoices.isError) return <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />;

  return (
    <div className="space-y-7">
      <Hero
        pageTitle="Invoices"
        loading={invoices.isLoading}
        lede={
          all.length === 0
            ? undefined
            : nextDue
              ? <>Next up: invoice <span className="font-figures">{nextDue.number}</span>, due {shortDate(nextDue.dueDate!)}.</>
              : 'Every invoice we send you, and every payment you make, is kept here.'
        }
      >
        {all.length === 0 ? (
          <>No invoices yet. When we send one, it will be here.</>
        ) : due <= 0 ? (
          <>You&rsquo;re all paid up. Thank you!</>
        ) : overdue > 0 ? (
          <>
            <HeroFigure><Price paise={due} compact className="font-display" /></HeroFigure> is due — <Price paise={overdue} compact className="font-display" /> of it is past
            its due date.
          </>
        ) : (
          <>
            <HeroFigure><Price paise={due} compact className="font-display" /></HeroFigure> is due across {open.length} invoice{open.length === 1 ? '' : 's'}.
          </>
        )}
      </Hero>

      {invoices.isLoading ? (
        <Bento>
          <Tile span={5}>
            <Skeleton className="h-28 w-full" />
          </Tile>
          <Tile span={7}>
            <Skeleton className="h-28 w-full" />
          </Tile>
        </Bento>
      ) : all.length === 0 ? (
        <Bento>
          <Tile span={12}>
            <EmptyState illustration="money" title="No invoices yet" description="Invoices appear here as soon as we send them, with a PDF you can download." />
          </Tile>
        </Bento>
      ) : (
        <Bento>
          <Tile span={5} tone="ink" title="Amount due">
            <div className="space-y-4">
              <BigNumber caption={due > 0 ? `${open.length} open invoice${open.length === 1 ? '' : 's'}` : 'Nothing to pay right now'}>
                <Price paise={due} />
              </BigNumber>
              <BalanceMeter onInk paidPaise={paid} duePaise={due - overdue} overduePaise={overdue} paidLabel="Paid to date" />
            </div>
          </Tile>
          <Tile span={7} title="Payment timeline">
            <ActivityTimeline
              items={payments.map((p) => ({
                key: p.key,
                date: p.paidAt,
                color: 'hsl(var(--success))',
                title: (
                  <span>
                    <Price paise={p.amountPaise} currency={p.invoice.currency} /> received
                  </span>
                ),
                meta: (
                  <>
                    {shortDate(p.paidAt)} · for{' '}
                    <Link href={`/portal/invoices/${p.invoice._id}`} className="font-figures hover:underline">
                      {p.invoice.number}
                    </Link>
                    {p.method ? ` · ${invoicePaymentMethodLabel(p.method)}` : ''}
                  </>
                ),
              }))}
              empty={<p className="text-sm text-muted-foreground">No payments recorded yet. Payments you make will show up here.</p>}
            />
          </Tile>
        </Bento>
      )}

      {all.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={show} onValueChange={(v) => list.set({ show: v })}>
              <TabsList>
                <TabsTrigger value="all">All ({all.length})</TabsTrigger>
                <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            <ViewToggle
              value={view}
              onChange={(v) => list.set({ view: v })}
              options={[
                { value: 'cards', label: 'Cards', icon: LayoutGrid },
                { value: 'table', label: 'Table', icon: Table2 },
              ]}
            />
          </div>

          {view === 'table' ? (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r._id}
              loading={invoices.isLoading}
              error={invoices.error}
              onRetry={() => invoices.refetch()}
              rowHref={(r) => `/portal/invoices/${r._id}`}
              empty={<EmptyState icon={Receipt} title={show === 'open' ? 'Nothing due — thank you!' : 'No invoices yet'} />}
            />
          ) : rows.length === 0 ? (
            <div className="rounded-[var(--radius)] border bg-card">
              <EmptyState illustration="done" title="Nothing due — thank you!" description="Every invoice is paid." />
            </div>
          ) : (
            <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((i) => (
                <li key={i._id} className="min-w-0">
                  <InvoiceCard invoice={i} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function StatusWord({ invoice }: { invoice: PortalInvoice }) {
  const w = invoiceWord(invoice);
  return <span className={cn('text-[13px] font-medium', w.tone === 'bad' && 'text-destructive', w.tone === 'good' && 'text-success', w.tone === 'muted' && 'text-muted-foreground')}>{w.label}</span>;
}

function InvoiceCard({ invoice: i }: { invoice: PortalInvoice }) {
  const w = invoiceWord(i);
  const settled = i.status === 'PAID';
  const late = i.status === 'OVERDUE';
  const daysLate = late && i.dueDate ? daysBetween(toLocalDateInput(i.dueDate), todayLocal()) : 0;
  return (
    <Link
      href={`/portal/invoices/${i._id}`}
      className={cn(
        'group relative flex h-full min-w-0 animate-rise flex-col gap-3 overflow-hidden rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5',
        late && 'border-destructive/40',
      )}
    >
      {settled && <PaidStamp className="absolute right-4 top-4" />}
      <div className="min-w-0 pr-16">
        <p className="font-figures text-sm font-semibold">{i.number}</p>
        <p className="truncate text-xs text-muted-foreground">{i.projects.join(', ') || 'General work'}</p>
      </div>
      <div>
        <p className="font-display text-2xl font-bold leading-none">
          <Price paise={settled ? i.totalPaise : i.balancePaise} currency={i.currency} className="font-display" />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {settled ? 'Paid in full' : i.paidPaise > 0 ? <>left to pay of <Price paise={i.totalPaise} currency={i.currency} /></> : i.status === 'WRITTEN_OFF' ? 'Nothing more to pay' : 'to pay'}
        </p>
      </div>
      {!settled && i.totalPaise > 0 && i.paidPaise > 0 && (
        <SegmentBar
          height="h-1.5"
          showLabels={false}
          segments={[
            { value: i.paidPaise, color: 'hsl(var(--success))', label: 'Paid' },
            { value: i.balancePaise, color: late ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', label: 'Left to pay' },
          ]}
        />
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3 text-xs">
        <span className={cn('font-medium', w.tone === 'bad' && 'text-destructive', w.tone === 'good' && 'text-success', w.tone === 'muted' && 'text-muted-foreground')}>
          {w.label}
        </span>
        <span className="text-muted-foreground">
          {late && i.dueDate
            ? `Was due ${shortDate(i.dueDate)}${daysLate > 0 ? ` · ${daysLate} day${daysLate === 1 ? '' : 's'} ago` : ''}`
            : i.dueDate && !settled
              ? `Due ${shortDate(i.dueDate)}`
              : i.issueDate
                ? `Issued ${shortDate(i.issueDate)}`
                : ''}
        </span>
      </div>
      {late && <p className="-mt-1 text-xs text-muted-foreground">Please pay when you can. Already paid? Thank you — it can take a day or two to show.</p>}
    </Link>
  );
}
