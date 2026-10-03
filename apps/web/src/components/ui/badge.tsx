// Badge primitive — used for statuses (Open / In Progress / Done etc).
import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-background',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success/10 text-success before:content-[""] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-success',
        warning: 'border-transparent bg-warning/10 text-warning before:content-[""] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-warning',
        muted: 'border-transparent bg-muted text-muted-foreground',
        info: 'border-transparent bg-info/10 text-info',
        danger: 'border-transparent bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
