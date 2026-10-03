// Who owes whom — clients who owe the agency on the left, team and freelancers the agency owes on the
// right, drawn to one scale around a centre axis. OWNER only (open invoices + /payouts/owed).
'use client';

import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { DivergingBars, formatCompact, Price, SpotIllustration, Tile, useCanSeePrices, type DivergingRow } from '@/components/viz';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { useOwed } from '@/features/payouts/payouts.hooks';

const PER_SIDE = 5;

export function MoneyOverview({ span = 7 }: { span?: 5 | 6 | 7 | 8 | 12 }) {
  const invoices = useInvoices({ status: 'open' });
  const owed = useOwed();
  const canSee = useCanSeePrices();
  const show = (paise: number) => (canSee ? formatCompact(paise) : '');

  // Clients — outstanding per client across open invoices (the API already nets out write-offs).
  const byClient = new Map<string, { name: string; paise: number }>();
  for (const inv of invoices.data ?? []) {
    const due = inv.balancePaise ?? Math.max(0, inv.totalPaise - inv.paidPaise);
    if (due <= 0) continue;
    const row = byClient.get(inv.clientId) ?? { name: inv.clientName ?? 'Deleted client', paise: 0 };
    row.paise += due;
    byClient.set(inv.clientId, row);
  }
  const clients = [...byClient.entries()].map(([id, r]) => ({ id, ...r })).sort((a, b) => b.paise - a.paise);
  const people = [
    ...(owed.data?.team ?? []).map((r) => ({ id: r.payeeId, name: r.name, paise: r.pendingPaise, href: `/team/${r.payeeId}` })),
    ...(owed.data?.freelancers ?? []).map((r) => ({
      id: r.payeeId,
      name: `${r.name} (freelance)`,
      paise: r.pendingPaise,
      href: `/freelancers/${r.payeeId}`,
    })),
  ]
    .filter((r) => r.paise > 0)
    .sort((a, b) => b.paise - a.paise);

  const receivable = clients.reduce((s, r) => s + r.paise, 0);
  const payable = people.reduce((s, r) => s + r.paise, 0);
  const net = receivable - payable;

  const rows: DivergingRow[] = [
    ...clients.slice(0, PER_SIDE).map((c) => ({
      key: c.id,
      label: c.name,
      value: c.paise,
      display: show(c.paise),
      side: 'left' as const,
      href: c.name === 'Deleted client' ? undefined : `/clients/${c.id}`,
    })),
    ...people.slice(0, PER_SIDE).map((p) => ({ key: p.id, label: p.name, value: p.paise, display: show(p.paise), side: 'right' as const, href: p.href })),
  ];
  const moreClients = clients.length - PER_SIDE;
  const morePeople = people.length - PER_SIDE;
  const loading = invoices.isLoading || owed.isLoading;

  return (
    <Tile
      span={span}
      title="Who owes whom"
      action={<span className="text-xs text-muted-foreground">They owe you ← · → you owe them</span>}
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : invoices.isError || owed.isError ? (
        <p className="py-6 text-sm text-muted-foreground">
          Couldn&apos;t load balances.{' '}
          <button
            type="button"
            className="font-medium text-foreground underline"
            onClick={() => {
              void invoices.refetch();
              void owed.refetch();
            }}
          >
            Try again
          </button>
        </p>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-3 py-3">
          <SpotIllustration kind="done" className="h-16 w-20" />
          <p className="text-sm text-muted-foreground">All square. No client owes you and you don&apos;t owe anyone.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="text-right">
              Clients owe you <Price paise={receivable} compact className="font-semibold text-success" />
            </div>
            <div>
              You owe <Price paise={payable} compact className="font-semibold text-brand" />
            </div>
          </div>
          <DivergingBars rows={rows} leftColor="hsl(var(--success))" rightColor="hsl(var(--primary))" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span>
              {moreClients > 0 && (
                <Link href="/invoices?status=open" className="hover:underline">
                  +{moreClients} more client{moreClients === 1 ? '' : 's'}
                </Link>
              )}
              {moreClients > 0 && morePeople > 0 && ' · '}
              {morePeople > 0 && (
                <Link href="/payments" className="hover:underline">
                  +{morePeople} more {morePeople === 1 ? 'person' : 'people'}
                </Link>
              )}
            </span>
            <span>
              Net{' '}
              <Price
                paise={Math.abs(net)}
                compact
                className={net >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}
              />{' '}
              {net >= 0 ? 'in your favour' : 'more owed than owing'}
            </span>
          </div>
        </div>
      )}
    </Tile>
  );
}
