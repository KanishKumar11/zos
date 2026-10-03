// One "needs you" row on the owner home — icon chip, a plain sentence, a sub-line and one action.
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONES = {
  brand: 'bg-brand-wash text-brand-ink',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
} as const;

export function AttentionRow({
  icon: Icon,
  tone = 'brand',
  title,
  sub,
  action,
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex animate-rise flex-wrap items-center gap-3 rounded-[var(--radius)] border bg-card px-4 py-3 sm:flex-nowrap', className)}>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', TONES[tone])} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
