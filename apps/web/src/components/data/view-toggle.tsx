// ViewToggle — segmented switch between a visual view and the table, e.g. Board | Table.
// Pair it with `useListState` (store the view in a param like `view`) so the choice is remembered.
'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ViewOption<T>[];
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="View" className={cn('inline-flex rounded-lg border bg-card p-0.5', className)}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
              active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
