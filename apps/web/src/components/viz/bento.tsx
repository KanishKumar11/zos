// Bento grid — mixed-size tiles on a 12-column grid that collapses gracefully on small screens.
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const SPAN: Record<number, string> = {
  3: 'col-span-12 sm:col-span-6 lg:col-span-3',
  4: 'col-span-12 sm:col-span-6 lg:col-span-4',
  5: 'col-span-12 lg:col-span-5',
  6: 'col-span-12 lg:col-span-6',
  7: 'col-span-12 lg:col-span-7',
  8: 'col-span-12 lg:col-span-8',
  12: 'col-span-12',
};

export function Bento({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid grid-cols-12 gap-3.5', className)} {...props} />;
}

export function Tile({
  span = 12,
  title,
  action,
  tone = 'default',
  className,
  bodyClassName,
  children,
}: {
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  title?: ReactNode;
  action?: ReactNode;
  /** `ink` = inverted dark tile for the one figure that matters most. */
  tone?: 'default' | 'ink' | 'wash';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'min-w-0 animate-rise rounded-[var(--radius)] border p-4 sm:p-5',
        tone === 'default' && 'bg-card',
        tone === 'ink' && 'border-foreground bg-foreground text-background',
        tone === 'wash' && 'border-brand/20 bg-brand-wash',
        SPAN[span],
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 className={cn('text-[13px] font-semibold', tone === 'ink' ? 'text-background/70' : 'text-muted-foreground')}>{title}</h2>
          )}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Big display number with an optional caption. */
export function BigNumber({ children, caption, className }: { children: ReactNode; caption?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="font-display text-[2.1rem] font-bold leading-none">{children}</div>
      {caption && <p className="mt-1.5 text-xs opacity-75">{caption}</p>}
    </div>
  );
}
