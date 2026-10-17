// A freelancer's deals (projects and contracts) as fill jars — agreed vs paid per project/contract, with what's pending and
// a one-click "Pay" prefilled with the pending amount. OWNER only; amounts go through <Price>.
'use client';

import Link from 'next/link';
import { PayeeType, PayoutCategory } from '@agency/shared';

import { useQuickActions } from '@/store/quick-actions.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { FillJar, Price, ProjectChip } from '@/components/viz';
import type { BalanceRow } from '@/features/payouts/payouts.hooks';

export function FreelancerDeals({ freelancerId, deals }: { freelancerId: string; deals: BalanceRow[] }) {
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  return (
    <ul className="divide-y">
      {deals.map((b) => {
        const over = b.agreedPaise > 0 && b.paidPaise > b.agreedPaise;
        const pct = b.agreedPaise > 0 ? Math.round((b.paidPaise / b.agreedPaise) * 100) : null;
        const key = b.contractId ? `c-${b.contractId}` : b.projectId ? `p-${b.projectId}` : 'general';
        return (
          <li key={key} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
            <FillJar
              value={b.paidPaise}
              max={b.agreedPaise}
              label={pct === null ? 'No agreed fee set' : over ? `Paid ${pct}% — more than agreed` : `${pct}% paid`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {b.contractId ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">Contract</Badge>
                    <Link href={`/contracts/${b.contractId}`} className="font-semibold hover:underline">
                      {b.contractName || 'Deleted contract'}
                    </Link>
                  </div>
                ) : b.projectId ? (
                  <ProjectChip id={b.projectId} name={b.projectName || 'Deleted project'} href={`/projects/${b.projectId}?tab=people`} className="font-semibold" />
                ) : (
                  <span className="font-semibold">{b.projectName || 'General'}</span>
                )}
                {b.projectStatus && <StatusBadge status={b.projectStatus} />}
              </div>
              <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <dt>{b.contractId ? 'Monthly pay' : 'Agreed'}</dt>
                  <dd className="text-foreground">{b.agreedPaise > 0 ? <Price paise={b.agreedPaise} /> : 'No fee set'}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Paid</dt>
                  <dd className="text-foreground">
                    <Price paise={b.paidPaise} />
                  </dd>
                </div>
                {over ? (
                  <div className="flex gap-1 text-warning">
                    <dt>Over by</dt>
                    <dd>
                      <Price paise={b.paidPaise - b.agreedPaise} />
                    </dd>
                  </div>
                ) : b.agreedPaise > 0 ? (
                  <div className="flex gap-1">
                    <dt>Pending</dt>
                    <dd className={b.pendingPaise > 0 ? 'font-medium text-warning' : 'text-success'}>
                      {b.pendingPaise > 0 ? <Price paise={b.pendingPaise} /> : 'Settled'}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <Button
              size="sm"
              variant={b.pendingPaise > 0 ? 'default' : 'outline'}
              className="h-7 shrink-0 px-2.5 text-xs"
              onClick={() =>
                openLogPayment({
                  payeeType: PayeeType.FREELANCER,
                  freelancerId,
                  projectId: b.projectId ?? undefined,
                  contractId: b.contractId ?? undefined,
                  amountPaise: b.pendingPaise || b.agreedPaise || undefined,
                  category: b.contractId ? PayoutCategory.CONTRACT_FEE : undefined,
                })
              }
            >
              {b.pendingPaise > 0 ? (
                <>
                  Pay <Price paise={b.pendingPaise} compact className="ml-1" />
                </>
              ) : (
                'Pay'
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
