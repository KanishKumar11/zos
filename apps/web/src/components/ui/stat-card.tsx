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
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {tone !== 'default' && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              tone === 'success' && 'bg-success',
              tone === 'warning' && 'bg-warning',
              tone === 'danger' && 'bg-destructive',
            )}
          />
        )}
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p
          className={cn(
            'font-display mt-1.5 text-[1.6rem] font-bold leading-none tabular-nums',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const base = cn('block animate-rise rounded-[var(--radius)] border bg-card px-4 py-3.5', className);
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link href={href} className={cn(base, 'transition-[border-color,transform] hover:-translate-y-px hover:border-foreground/25')}>
      {body}
    </Link>
  );
}
