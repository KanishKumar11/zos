// Payments as a story: grouped by the day they were paid ("Today", "Yesterday", "Mon 28 Sep"),
// each with the payee, the project it was for, how it was paid and the amount (OWNER views).
'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PAYOUT_CATEGORY_LABEL, PAYOUT_METHOD_LABEL, PayeeType, PayoutCategory } from '@agency/shared';

import { identityColor } from '@/lib/identity';
import { isNewSince } from '@/lib/last-visit';

import { Badge } from '@/components/ui/badge';
import { ActivityTimeline, Avatar, NewDot, Price, ProjectChip, type TimelineItem } from '@/components/viz';

import { groupByDay } from './payout-days';
import type { PayoutRow } from './payouts.hooks';

const REMOVED = 'Removed person';

export const payeeIdOf = (r: Pick<PayoutRow, 'userId' | 'freelancerId'>): string => r.userId ?? r.freelancerId ?? '';

export function payeeHref(r: Pick<PayoutRow, 'payeeType' | 'userId' | 'freelancerId' | 'payeeName'>): string | undefined {
  if (r.payeeName === REMOVED) return undefined;
  if (r.payeeType === PayeeType.MEMBER) return r.userId ? `/team/${r.userId}` : undefined;
  return r.freelancerId ? `/freelancers/${r.freelancerId}` : undefined;
}

/** Project cell shared by the timeline and tables: chip, "Deleted project" or "General". */
export function PayoutProject({ row, className }: { row: Pick<PayoutRow, 'projectId' | 'projectName'>; className?: string }) {
  if (!row.projectId) return <span className={className ?? 'text-muted-foreground'}>General</span>;
  if (!row.projectName) return <span className={className ?? 'text-muted-foreground'}>Deleted project</span>;
  return <ProjectChip id={row.projectId} name={row.projectName} href={`/projects/${row.projectId}?tab=people`} className={className} />;
}

export function PayoutDayTimeline({
  rows,
  onOpen,
  showPayee = true,
  empty,
  since = null,
}: {
  rows: PayoutRow[];
  /** Opens the payment for editing (the Log payment sheet). */
  onOpen: (row: PayoutRow) => void;
  /** False on a person's own page, where the payee is obvious. */
  showPayee?: boolean;
  empty?: ReactNode;
  /** Last visit time (`useLastVisit`) — payments logged after it get a "new" dot. */
  since?: number | null;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;
  const days = groupByDay(rows);
  return (
    <div className="space-y-6">
      {days.map((d) => (
        <section key={d.day} aria-label={d.label}>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b pb-1.5">
            <h3 className="text-[13px] font-semibold">{d.label}</h3>
            <span className="text-xs text-muted-foreground">
              {d.items.length} payment{d.items.length === 1 ? '' : 's'}
              {d.items.length > 1 && (
                <>
                  {' · '}
                  <Price paise={d.totalPaise} compact />
                </>
              )}
            </span>
          </div>
          <ActivityTimeline items={d.items.map((r) => toItem(r, onOpen, showPayee, since))} />
        </section>
      ))}
    </div>
  );
}

function toItem(r: PayoutRow, onOpen: (row: PayoutRow) => void, showPayee: boolean, since: number | null): TimelineItem {
  const href = payeeHref(r);
  const meta = [
    PAYOUT_METHOD_LABEL[r.method],
    r.reference ? `ref ${r.reference}` : '',
    r.category !== PayoutCategory.PROJECT_FEE ? PAYOUT_CATEGORY_LABEL[r.category] : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    key: r._id,
    date: r.paidAt,
    color: identityColor(showPayee ? payeeIdOf(r) || r.payeeName : r.projectId ?? 'general'),
    title: (
      <div className="flex items-start gap-2.5 font-normal">
        {showPayee && <Avatar id={payeeIdOf(r) || undefined} name={r.payeeName} size="sm" className="mt-0.5" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {showPayee ? (
              href ? (
                <Link href={href} className="font-semibold hover:underline">
                  {r.payeeName}
                </Link>
              ) : (
                <span className="font-semibold">{r.payeeName}</span>
              )
            ) : (
              <PayoutProject row={r} className="font-semibold" />
            )}
            {showPayee && r.payeeType === PayeeType.FREELANCER && <Badge variant="info">Freelancer</Badge>}
            <NewDot show={isNewSince(r.createdAt ?? r.paidAt, since)} />
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {showPayee && (
              <>
                <PayoutProject row={r} className="max-w-[220px] text-foreground/80" />
                <span aria-hidden>·</span>
              </>
            )}
            <span>{meta}</span>
          </div>
          {r.note && <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{r.note}</p>}
        </div>
        <button
          type="button"
          onClick={() => onOpen(r)}
          className="group -mr-1 flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-semibold hover:bg-accent"
          aria-label={`Edit payment to ${r.payeeName}`}
          title="Edit payment"
        >
          <Price paise={r.amountPaise} currency={r.currency} />
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      </div>
    ),
  };
}
