// Zlaark brand lockup from the brand kit (public/brand). `tone="rail"` is for the dark ink rail;
// `tone="paper"` is for light surfaces and switches to the white logo in dark mode.
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/icon-color-transparent.svg" alt="" aria-hidden className={cn('h-7 w-7 shrink-0', className)} />;
}

export function BrandLogo({ tone = 'paper', className }: { tone?: 'rail' | 'paper'; className?: string }) {
  if (tone === 'rail') return <img src="/brand/logo-white.svg" alt="Zlaark" className={cn('h-6 w-auto', className)} />;
  return (
    <>
      <img src="/brand/logo-color.svg" alt="Zlaark" className={cn('h-6 w-auto dark:hidden', className)} />
      <img src="/brand/logo-white.svg" alt="Zlaark" className={cn('hidden h-6 w-auto dark:block', className)} />
    </>
  );
}

export function Brand({
  href = '/dashboard',
  tone = 'paper',
  compact = false,
  className,
}: {
  href?: string;
  tone?: 'rail' | 'paper';
  /** Mark only (collapsed rail). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn('flex min-w-0 items-center gap-2.5', className)} aria-label="Zlaark ZOS — home">
      <BrandMark />
      {!compact && (
        <span className="flex min-w-0 items-baseline gap-2">
          <BrandLogo tone={tone} className="h-[18px]" />
          <span className={cn('font-figures text-[10px] font-medium uppercase tracking-[0.14em]', tone === 'rail' ? 'text-rail-foreground/50' : 'text-muted-foreground')}>
            OS
          </span>
        </span>
      )}
    </Link>
  );
}
