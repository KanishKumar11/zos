// Zlaark brand lockup from the brand kit (public/brand). `tone="rail"` is for the dark ink rail;
// `tone="paper"` is for light surfaces and switches to the white logo in dark mode.
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/icon-color-transparent.svg" alt="" aria-hidden className={cn('h-6 w-6 shrink-0', className)} />;
}

export function BrandLogo({ tone = 'paper', className }: { tone?: 'rail' | 'paper'; className?: string }) {
  if (tone === 'rail') return <img src="/brand/logo-white.svg" alt="Zlaark" className={cn('h-5 w-auto shrink-0', className)} />;
  return (
    <>
      <img src="/brand/logo-dark.svg" alt="Zlaark" className={cn('h-5 w-auto shrink-0 dark:hidden', className)} />
      <img src="/brand/logo-white.svg" alt="Zlaark" className={cn('hidden h-5 w-auto shrink-0 dark:block', className)} />
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
  if (compact) {
    return (
      <Link href={href} className={cn('flex shrink-0 items-center justify-center', className)} aria-label="Zlaark ZOS — home">
        <BrandMark />
      </Link>
    );
  }

  return (
    <Link href={href} className={cn('flex min-w-0 items-center gap-2', className)} aria-label="Zlaark ZOS — home">
      <BrandLogo tone={tone} className="h-5" />
      <span
        className={cn(
          'font-figures text-[10px] font-semibold uppercase tracking-[0.14em]',
          tone === 'rail' ? 'text-rail-foreground/60' : 'text-muted-foreground'
        )}
      >
        OS
      </span>
    </Link>
  );
}

