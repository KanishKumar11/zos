// PageHeader — consistent title + description + optional action used across all app pages.
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight uppercase">{title}</h1>
        {description && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
