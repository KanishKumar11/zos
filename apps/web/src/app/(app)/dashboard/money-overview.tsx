'use client';

import Link from 'next/link';

import { InvoiceStatus } from '@agency/shared';

import { formatPaise } from '@/lib/formatters';

import { useClients } from '@/features/clients/clients.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { useOwed } from '@/features/payouts/payouts.hooks';

const OPEN_STATUSES = new Set([
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
]);

export function MoneyOverview() {
  const clients = useClients();
  const invoices = useInvoices();
  const owed = useOwed();

  const clientNameMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));

  // Receivable — outstanding per client, from any not-yet-fully-collected invoice.
  const receivableByClient = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    if (!OPEN_STATUSES.has(inv.status)) continue;
    const due = inv.totalPaise - inv.paidPaise;
    if (due <= 0) continue;
    receivableByClient.set(inv.clientId, (receivableByClient.get(inv.clientId) ?? 0) + due);
  }
  const receivableRows = [...receivableByClient.entries()]
    .map(([clientId, amountPaise]) => ({ clientId, amountPaise, name: clientNameMap.get(clientId) ?? 'Deleted client' }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  const totalReceivable = receivableRows.reduce((s, r) => s + r.amountPaise, 0);

  // What we still owe, per person across projects (agreed fee − payouts logged).
  const teamRows = (owed.data?.team ?? []).map((r) => ({ userId: r.payeeId, name: r.name, amountPaise: r.pendingPaise }));
  const totalTeamPayable = teamRows.reduce((s, r) => s + r.amountPaise, 0);
  const freelancerRows = (owed.data?.freelancers ?? []).map((r) => ({ id: r.payeeId, name: r.name, amountPaise: r.pendingPaise }));
  const totalFreelancerPayable = freelancerRows.reduce((s, r) => s + r.amountPaise, 0);

  const totalPayable = totalTeamPayable + totalFreelancerPayable;
  const netPosition = totalReceivable - totalPayable;
  const isLoading = clients.isLoading || invoices.isLoading || owed.isLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 h-48 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-sm font-semibold">Who owes whom</p>
        <p className={`text-sm font-semibold tracking-tight ${netPosition >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
          Net {netPosition >= 0 ? '+' : '−'}{formatPaise(Math.abs(netPosition), 'INR')}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border mt-4">
        <MoneyColumn
          title="Clients owe us"
          total={totalReceivable}
          accent="text-emerald-600"
          emptyLabel="Nothing outstanding — all invoices collected."
          rows={receivableRows.map((r) => ({
            key: r.clientId,
            label: r.name,
            amountPaise: r.amountPaise,
            href: `/clients/${r.clientId}`,
          }))}
        />
        <MoneyColumn
          title="We owe the team"
          total={totalTeamPayable}
          accent="text-amber-600"
          emptyLabel="No pending team payouts."
          rows={teamRows.map((r) => ({
            key: r.userId,
            label: r.name,
            amountPaise: r.amountPaise,
            href: `/team/${r.userId}`,
          }))}
        />
        <MoneyColumn
          title="We owe freelancers"
          total={totalFreelancerPayable}
          accent="text-amber-600"
          emptyLabel="No pending freelancer payouts."
          rows={freelancerRows.map((r) => ({
            key: r.id,
            label: r.name,
            amountPaise: r.amountPaise,
            href: `/freelancers/${r.id}`,
          }))}
        />
      </div>
    </div>
  );
}

function MoneyColumn({
  title,
  total,
  accent,
  rows,
  emptyLabel,
}: {
  title: string;
  total: number;
  accent: string;
  rows: { key: string; label: string; amountPaise: number; href?: string }[];
  emptyLabel: string;
}) {
  const shown = rows.slice(0, 6);
  const remainder = rows.length - shown.length;

  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className={`text-lg font-semibold tracking-tight ${accent}`}>{formatPaise(total, 'INR')}</p>
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => {
            const content = (
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{r.label}</span>
                <span className="tabular-nums font-medium shrink-0 ml-3">{formatPaise(r.amountPaise, 'INR')}</span>
              </div>
            );
            return r.href ? (
              <Link key={r.key} href={r.href} className="block hover:opacity-70 transition-opacity">
                {content}
              </Link>
            ) : (
              <div key={r.key}>{content}</div>
            );
          })}
          {remainder > 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">+{remainder} more</p>
          )}
        </div>
      )}
    </div>
  );
}
