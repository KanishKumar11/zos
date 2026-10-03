// Freelancer card for the directory grid — who they are, what they've been paid, what's still owed
// and how many project deals they have. OWNER only; amounts go through <Price>.
'use client';

import Link from 'next/link';

import { formatDate } from '@/lib/formatters';
import { useQuickActions } from '@/store/quick-actions.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, FillJar, Price } from '@/components/viz';

import type { FreelancerRow } from './freelancers.hooks';

export function FreelancerCard({ f }: { f: FreelancerRow }) {
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  const pct = f.agreedPaise > 0 ? Math.round((f.paidPaise / f.agreedPaise) * 100) : null;
  return (
    <article className="group relative flex animate-rise flex-col rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25">
      <div className="flex items-start gap-3">
        <Avatar id={f._id} name={f.name} size="lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/freelancers/${f._id}`} className="block truncate font-semibold after:absolute after:inset-0 after:rounded-[var(--radius)] hover:underline">
            {f.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{f.skill || f.email || 'Freelancer'}</p>
          {f.legacyEngagements.length > 0 && (
            <Badge variant="warning" className="mt-1.5">
              Needs a project link
            </Badge>
          )}
        </div>
        {f.agreedPaise > 0 && (
          <FillJar value={f.paidPaise} max={f.agreedPaise} size="sm" label={`${pct}% of agreed fees paid`} />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Paid</dt>
          <dd className="truncate text-sm font-semibold">
            <Price paise={f.paidPaise} compact />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Outstanding</dt>
          <dd className="truncate text-sm font-semibold">
            {f.pendingPaise > 0 ? (
              <Price paise={f.pendingPaise} compact className="text-warning" />
            ) : (
              <span className="font-normal text-muted-foreground">{f.agreedPaise > 0 ? 'Settled' : 'Nothing owed'}</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Deals</dt>
          <dd className="font-figures text-sm font-semibold">{f.projectCount}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{f.lastPaidAt ? `Last paid ${formatDate(f.lastPaidAt)}` : 'Not paid yet'}</span>
        <Button
          size="sm"
          variant={f.pendingPaise > 0 ? 'default' : 'outline'}
          className="relative z-10 h-7 shrink-0 px-2.5 text-xs"
          onClick={() => openLogPayment({ payeeType: 'FREELANCER', freelancerId: f._id })}
        >
          Pay
        </Button>
      </div>
    </article>
  );
}

export function FreelancerCardSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    </div>
  );
}
