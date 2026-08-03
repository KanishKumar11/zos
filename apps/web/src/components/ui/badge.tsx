// Badge primitive — used for statuses (Open / In Progress / Done etc).
import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] before:content-[""] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[hsl(var(--success))]',
        warning: 'border-transparent bg-amber-600/10 text-amber-600 before:content-[""] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-amber-600',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
