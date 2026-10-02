// Reusable Table primitives.
import * as React from 'react';
import { cn } from '@/lib/cn';

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-lg border border-border bg-card">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('[&_tr]:border-b border-border bg-muted/40', className)} {...props} />
);
export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0 divide-y divide-border', className)} {...props} />
);
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('transition-colors hover:bg-muted/30', className)} {...props} />
);
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap', className)}
    {...props}
  />
);
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 align-middle text-[13px]', className)} {...props} />
);
