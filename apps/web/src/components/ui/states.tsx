// Empty / error / loading states — every list and detail page uses these so nothing ever renders
// as a blank box, a silent ₹0, or "Empty" while it's actually still loading.
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';

import { SpotIllustration } from '@/components/viz/illustrations';

import { Button } from './button';
import { Skeleton } from './skeleton';

export function EmptyState({
  icon: Icon = Inbox,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  /** A warm spot illustration instead of the icon. */
  illustration?: 'inbox' | 'money' | 'projects' | 'people' | 'calendar' | 'done' | 'files';
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {illustration ? (
        <SpotIllustration kind={illustration} className="mb-3" />
      ) : (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-wash">
          <Icon className="h-5 w-5 text-brand-ink" />
        </div>
      )}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[var(--radius)]" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-[var(--radius)]" />
    </div>
  );
}
