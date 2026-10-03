// <Price> — the only way amounts should reach the screen.
//
// Rule: real prices are visible to the OWNER, and to a CLIENT for their own company (portal pages).
// Anyone else sees an amount only when it is their own pay (`own`). In every other case this renders
// nothing (or `fallback`), so a mistake in a page can't leak a number. The API enforces the same
// rule; this is defence in depth and makes leaks easy to audit (grep for formatPaise outside viz/).
'use client';

import type { ReactNode } from 'react';

import { Role } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

export function useCanSeePrices(own = false): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return own || role === Role.OWNER || role === Role.CLIENT;
}

/** Compact Indian notation: ₹4.2L, ₹1.3Cr, ₹85k. */
export function formatCompact(paise: number, currency = 'INR'): string {
  const v = paise / 100;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  if (currency === 'INR') {
    if (a >= 1e7) return `${sign}${sym}${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
    if (a >= 1e5) return `${sign}${sym}${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  } else if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${sym}${Math.round(a / 1e3)}k`;
  return `${sign}${sym}${Math.round(a)}`;
}

export function Price({
  paise,
  currency = 'INR',
  own = false,
  compact = false,
  fallback = null,
  className,
}: {
  paise: number | null | undefined;
  currency?: string;
  /** The viewer's own pay — visible to them whatever their role. */
  own?: boolean;
  compact?: boolean;
  fallback?: ReactNode;
  className?: string;
}) {
  const allowed = useCanSeePrices(own);
  if (!allowed || paise === null || paise === undefined) return <>{fallback}</>;
  return (
    <span className={cn('font-figures tabular-nums', className)} title={compact ? formatPaise(paise, currency) : undefined}>
      {compact ? formatCompact(paise, currency) : formatPaise(paise, currency)}
    </span>
  );
}
