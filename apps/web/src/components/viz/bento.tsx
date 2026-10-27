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
  return <div className={cn('grid grid-cols-12 gap-4 lg:gap-5', className)} {...props} />;
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
        'min-w-0 animate-rise rounded-2xl border p-5 sm:p-6 transition-all duration-200',
        tone === 'default' &&
          'border-border/80 bg-card/90 shadow-sm hover:border-border hover:shadow-md backdrop-blur-sm',
        tone === 'ink' &&
          'relative overflow-hidden border border-white/10 bg-gradient-to-br from-rail via-rail/95 to-black text-rail-foreground shadow-xl ring-1 ring-white/10 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-primary/60 before:to-transparent',
        tone === 'wash' && 'border-primary/20 bg-primary/[0.04] text-foreground',
        SPAN[span],
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2
              className={cn(
                'text-[13px] font-semibold tracking-wide',
                tone === 'ink' ? 'text-rail-foreground/80' : 'text-muted-foreground',
              )}
            >
              {title}
            </h2>
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
      <div className="font-display text-[2.2rem] sm:text-[2.5rem] font-bold leading-none tracking-tight">{children}</div>
      {caption && <p className="mt-2 text-xs opacity-75 leading-relaxed">{caption}</p>}
    </div>
  );
}
