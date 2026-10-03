// Narrative hero — a page opens with one plain-language sentence written from live data, set big in
// the display face. Wrap key figures in <HeroFigure> (brand colour) or <HeroMark> (highlighter).
'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { usePageTitle, type Crumb } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export function Hero({
  pageTitle,
  crumbs,
  eyebrow,
  children,
  lede,
  aside,
  loading,
  className,
}: {
  /** Short name for the top bar + browser tab (the headline is a sentence, so it can't double as the title). */
  pageTitle: string;
  crumbs?: Crumb[];
  /** Small line above, e.g. "Command centre · October 2026". */
  eyebrow?: ReactNode;
  /** The sentence. */
  children: ReactNode;
  /** One supporting sentence under the headline. */
  lede?: ReactNode;
  /** Right-aligned extras (chips, actions). */
  aside?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  usePageTitle(pageTitle, crumbs);
  return (
    <header className={cn('space-y-3', className)}>
      {(eyebrow || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {eyebrow ? <p className="text-[13px] text-muted-foreground">{eyebrow}</p> : <span />}
          {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-4/5 max-w-2xl" />
          <Skeleton className="h-10 w-3/5 max-w-xl" />
        </div>
      ) : (
        <h1 className="font-display max-w-[24ch] text-[clamp(1.85rem,4.2vw,3.25rem)] font-bold leading-[1.05]">{children}</h1>
      )}
      {lede && !loading && <p className="max-w-[62ch] text-[15px] text-muted-foreground">{lede}</p>}
    </header>
  );
}

export function HeroFigure({ children }: { children: ReactNode }) {
  return <span className="text-brand">{children}</span>;
}

export function HeroMark({ children }: { children: ReactNode }) {
  return <span className="mark-wash">{children}</span>;
}

/** Small "Only you see these figures" style chip. */
export function PrivacyChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      {children}
    </span>
  );
}

/** Small brand dot marking something new since the viewer's last visit (see `useLastVisit`). */
export function NewDot({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]', className)} title="New since your last visit">
      <span className="sr-only">New</span>
    </span>
  );
}
