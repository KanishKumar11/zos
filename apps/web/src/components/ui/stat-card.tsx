// StatCard — KPI tile. Pass `href` to make it click through to the filtered list behind the number.
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Skeleton } from './skeleton';

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <p
          className={cn(
            'mt-1 text-xl font-semibold tabular-nums tracking-tight',
            tone === 'success' && 'text-[hsl(var(--success))]',
            tone === 'warning' && 'text-amber-600',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const base = cn('block rounded-lg border bg-card px-4 py-3', className);
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link href={href} className={cn(base, 'transition-colors hover:border-foreground/25 hover:bg-accent/40')}>
      {body}
    </Link>
  );
}
