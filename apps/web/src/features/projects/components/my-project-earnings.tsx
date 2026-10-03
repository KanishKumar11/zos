// "My earnings on this project" — a team member's own deal: a jar filling up as the agreed fee is
// paid, plus the payments behind it. This is all the money a non-owner ever sees about a project,
// and every figure is rendered as the viewer's own (<Price own>).
'use client';

import Link from 'next/link';

import { PAYOUT_METHOD_LABEL, type PayoutMethod } from '@agency/shared';

import { formatDate } from '@/lib/formatters';

import { FillJar, Price, PrivacyChip, Tile } from '@/components/viz';

import type { MyEngagement } from '../projects.hooks';

export function MyProjectEarnings({ engagement, span = 4 }: { engagement: MyEngagement; span?: 4 | 5 | 12 }) {
  const { agreedPaise, paidPaise, pendingPaise, currency, payments } = engagement;
  const share = agreedPaise > 0 ? Math.round((paidPaise / agreedPaise) * 100) : 0;
  return (
    <Tile
      span={span}
      title="My earnings here"
      action={
        <Link href="/earnings" className="text-xs text-brand-ink hover:underline">
          All my earnings
        </Link>
      }
    >
      {agreedPaise === 0 && paidPaise === 0 ? (
        <p className="text-sm text-muted-foreground">No fee has been agreed for you on this project yet. Ask the owner if you expected one.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <FillJar value={paidPaise} max={agreedPaise} size="lg" label={agreedPaise > 0 ? `${share}% of your fee received` : 'Payments received'} />
            <div className="min-w-0 space-y-1">
              <p className="font-display text-[1.7rem] font-bold leading-none">
                <Price own paise={paidPaise} currency={currency} compact />
              </p>
              <p className="text-xs text-muted-foreground">
                {agreedPaise > 0 ? (
                  <>
                    received of <Price own paise={agreedPaise} currency={currency} /> agreed
                  </>
                ) : (
                  'received so far'
                )}
              </p>
              {pendingPaise > 0 ? (
                <p className="text-xs font-medium text-warning">
                  <Price own paise={pendingPaise} currency={currency} /> still to come
                </p>
              ) : agreedPaise > 0 ? (
                <p className="text-xs font-medium text-success">Fully paid</p>
              ) : null}
            </div>
          </div>
          {payments.length > 0 && (
            <ul className="divide-y rounded-lg border text-[13px]">
              {payments.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDate(p.paidAt)}
                    {p.method ? ` · ${PAYOUT_METHOD_LABEL[p.method as PayoutMethod] ?? p.method}` : ''}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <Price own paise={p.amountPaise} currency={currency} className="font-medium" />
                </li>
              ))}
            </ul>
          )}
          <PrivacyChip>Only you see your pay</PrivacyChip>
        </div>
      )}
    </Tile>
  );
}
