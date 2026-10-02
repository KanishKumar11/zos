// "My earnings on this project" — a team member's own deal: agreed, paid, pending and the payments.
// This is all the money a non-owner ever sees about a project.
'use client';

import Link from 'next/link';

import { PAYOUT_METHOD_LABEL, type PayoutMethod } from '@agency/shared';

import { formatDate, formatPaise } from '@/lib/formatters';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';

import type { MyEngagement } from '../projects.hooks';

export function MyProjectEarnings({ engagement }: { engagement: MyEngagement }) {
  const { agreedPaise, paidPaise, pendingPaise, currency, payments } = engagement;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>My earnings on this project</CardTitle>
        <Link href="/earnings" className="text-xs text-primary hover:underline">
          All my earnings
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Agreed</p>
            <p className="text-lg font-semibold tabular-nums">{agreedPaise > 0 ? formatPaise(agreedPaise, currency) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="text-lg font-semibold tabular-nums text-[hsl(var(--success))]">{formatPaise(paidPaise, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-semibold tabular-nums">{formatPaise(pendingPaise, currency)}</p>
          </div>
        </div>
        {agreedPaise > 0 && <ProgressBar value={paidPaise} max={agreedPaise} />}
        {agreedPaise === 0 && (
          <p className="text-xs text-muted-foreground">No fee has been agreed for you on this project yet.</p>
        )}
        {payments.length > 0 && (
          <ul className="divide-y rounded-md border text-[13px]">
            {payments.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-muted-foreground">
                  {formatDate(p.paidAt)}
                  {p.method ? ` · ${PAYOUT_METHOD_LABEL[p.method as PayoutMethod] ?? p.method}` : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                </span>
                <span className="font-medium tabular-nums">{formatPaise(p.amountPaise, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
