// A team member's deals across projects + their payment history (OWNER, on the person's page).
'use client';

import Link from 'next/link';

import { PAYOUT_METHOD_LABEL, PayeeType } from '@agency/shared';

import { formatDate, formatPaise } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';

import { usePayeeBalances, usePayouts } from './payouts.hooks';

export function PersonPayments({ userId }: { userId: string }) {
  const balances = usePayeeBalances(PayeeType.MEMBER, userId);
  const history = usePayouts({ userId, pageSize: 10 });
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const rows = balances.data ?? [];
  const pending = rows.reduce((s, r) => s + r.pendingPaise, 0);
  const paid = rows.reduce((s, r) => s + r.paidPaise, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Projects &amp; payments</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Paid {formatPaise(paid)}
              {pending > 0 && <span className="text-amber-700 dark:text-amber-500"> · {formatPaise(pending)} pending</span>}
            </p>
          </div>
          <Button size="sm" onClick={() => openLogPayment({ payeeType: 'MEMBER', userId })}>
            Log payment
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {balances.isLoading ? (
            <TableSkeleton rows={3} columns={3} />
          ) : balances.isError ? (
            <ErrorState error={balances.error} onRetry={() => balances.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="Not on any project" />
          ) : (
            <ul className="divide-y">
              {rows.map((b) => (
                <li key={b.projectId ?? 'general'} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_170px_auto] sm:items-center">
                  <div>
                    {b.projectId ? (
                      <Link href={`/projects/${b.projectId}?tab=people`} className="font-medium hover:underline">
                        {b.projectName}
                      </Link>
                    ) : (
                      <span className="font-medium">General payments</span>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {b.projectStatus && <StatusBadge status={b.projectStatus} />}
                      <span>
                        {formatPaise(b.paidPaise)}
                        {b.agreedPaise ? ` of ${formatPaise(b.agreedPaise)}` : ''}
                      </span>
                    </div>
                  </div>
                  {b.agreedPaise > 0 ? <ProgressBar value={b.paidPaise} max={b.agreedPaise} /> : <span className="text-xs text-muted-foreground">{b.projectId ? 'No fee set' : ''}</span>}
                  {b.projectId ? (
                    <Button
                      size="sm"
                      variant={b.pendingPaise > 0 ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => openLogPayment({ payeeType: 'MEMBER', userId, projectId: b.projectId!, amountPaise: b.pendingPaise || undefined })}
                    >
                      {b.pendingPaise > 0 ? `Pay ${formatPaise(b.pendingPaise)}` : 'Pay'}
                    </Button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent payments</CardTitle>
          <Link href={`/payments?userId=${userId}`} className="text-xs text-primary hover:underline">
            See all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {(history.data?.items ?? []).length === 0 ? (
            <EmptyState title="No payments yet" className="py-8" />
          ) : (
            <ul className="divide-y">
              {history.data!.items.map((p) => (
                <li key={p._id}>
                  <button type="button" onClick={() => openLogPayment({}, p._id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{p.projectName ?? 'General'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(p.paidAt)} · {PAYOUT_METHOD_LABEL[p.method]}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{formatPaise(p.amountPaise, p.currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
