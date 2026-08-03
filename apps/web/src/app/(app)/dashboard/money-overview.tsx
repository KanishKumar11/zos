'use client';

import Link from 'next/link';

import { InvoiceStatus } from '@agency/shared';

import { formatPaise } from '@/lib/formatters';

import { useClients } from '@/features/clients/clients.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { useProjects } from '@/features/projects/projects.hooks';
import { useFreelancerPayments } from '@/features/freelancer-payments/freelancer-payments.hooks';
import { useTeamList } from '@/features/team/team.hooks';

const OPEN_STATUSES = new Set([
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
]);

export function MoneyOverview() {
  const clients = useClients();
  const invoices = useInvoices();
  const projects = useProjects({ pageSize: 500 });
  const freelancers = useFreelancerPayments({ limit: 200 });
  const team = useTeamList({ pageSize: 100 });

  const clientNameMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));
  const teamNameMap = new Map((team.data ?? []).map((u) => [u._id, u.name]));

  // Receivable — outstanding per client, from any not-yet-fully-collected invoice.
  const receivableByClient = new Map<string, number>();
  for (const inv of invoices.data ?? []) {
    if (!OPEN_STATUSES.has(inv.status)) continue;
    const due = inv.totalPaise - inv.paidPaise;
    if (due <= 0) continue;
    receivableByClient.set(inv.clientId, (receivableByClient.get(inv.clientId) ?? 0) + due);
  }
  const receivableRows = [...receivableByClient.entries()]
    .map(([clientId, amountPaise]) => ({ clientId, amountPaise, name: clientNameMap.get(clientId) ?? clientId.slice(-6) }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  const totalReceivable = receivableRows.reduce((s, r) => s + r.amountPaise, 0);

  // Payable to team — budgeted minus paid, summed per person across every project.
  const payableToTeam = new Map<string, number>();
  for (const p of projects.data?.items ?? []) {
    for (const m of p.members) {
      const paid = m.payments.reduce((s, pay) => s + pay.amountPaise, 0);
      const pending = Math.max(0, (m.amountPaise ?? 0) - paid);
      if (pending <= 0) continue;
      payableToTeam.set(m.userId, (payableToTeam.get(m.userId) ?? 0) + pending);
    }
  }
  const teamRows = [...payableToTeam.entries()]
    .map(([userId, amountPaise]) => ({ userId, amountPaise, name: teamNameMap.get(userId) ?? userId.slice(-6) }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  const totalTeamPayable = teamRows.reduce((s, r) => s + r.amountPaise, 0);

  // Payable to freelancers — pendingPaise already computed server-side per contract.
  const freelancerRows = (freelancers.data?.items ?? [])
    .filter((f) => f.pendingPaise > 0)
    .map((f) => ({ id: f._id, name: f.freelancerName, amountPaise: f.pendingPaise, currency: f.currency }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  const totalFreelancerPayable = freelancerRows.reduce((s, r) => s + r.amountPaise, 0);

  const totalPayable = totalTeamPayable + totalFreelancerPayable;
  const netPosition = totalReceivable - totalPayable;
  const isLoading = clients.isLoading || invoices.isLoading || projects.isLoading || freelancers.isLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-border divide-y lg:divide-y-0 lg:divide-x divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 md:p-8 h-64 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-8">
        <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Who Owes Whom</p>
        <p className={`text-sm font-semibold tracking-tight ${netPosition >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
          Net {netPosition >= 0 ? '+' : '−'}{formatPaise(Math.abs(netPosition), 'INR')}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border mt-4">
        <MoneyColumn
          title="Clients Owe Us"
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
          title="We Owe The Team"
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
          title="We Owe Freelancers"
          total={totalFreelancerPayable}
          accent="text-amber-600"
          emptyLabel="No pending freelancer payouts."
          rows={freelancerRows.map((r) => ({
            key: r.id,
            label: r.name,
            amountPaise: r.amountPaise,
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
    <div className="p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">{title}</p>
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
