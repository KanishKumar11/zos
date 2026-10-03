// Money totals per currency ("₹1.2L + $2,000"), rendered through <Price> so they only reach viewers
// who may see prices. Also a client identity chip that copes with deleted / still-loading clients.
'use client';

import { Fragment } from 'react';

import { cn } from '@/lib/cn';

import { Price, ProjectChip, useCanSeePrices } from '@/components/viz';

/** INR first, then the rest alphabetically. An empty map reads as ₹0. */
export function totalsEntries(totals: Map<string, number>): [string, number][] {
  if (totals.size === 0) return [['INR', 0]];
  return [...totals.entries()].sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
}

export function PriceTotals({
  totals,
  compact,
  own,
  className,
}: {
  totals: Map<string, number>;
  compact?: boolean;
  own?: boolean;
  className?: string;
}) {
  const allowed = useCanSeePrices(own);
  if (!allowed) return null;
  return (
    <span className={className}>
      {totalsEntries(totals).map(([cur, paise], i) => (
        <Fragment key={cur}>
          {i > 0 && <span className="opacity-60"> + </span>}
          <Price paise={paise} currency={cur} compact={compact} own={own} />
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Client name with its identity dot. `name` undefined means the client isn't in the list: shows "…"
 * while the list loads, then "Deleted client" (never a raw id).
 */
export function ClientChip({
  clientId,
  name,
  loading,
  href,
  className,
}: {
  clientId: string | undefined;
  name: string | undefined;
  loading?: boolean;
  /** Link target when the client exists. */
  href?: string;
  className?: string;
}) {
  if (!name) {
    return <span className={cn('italic text-muted-foreground', className)}>{loading ? '…' : clientId ? 'Deleted client' : 'No client'}</span>;
  }
  return <ProjectChip id={clientId} name={name} href={href} className={className} />;
}
