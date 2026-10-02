// Combobox — searchable picker for people, projects, clients. Radix Popover + filtered list with
// full keyboard support (↑ ↓ Enter Esc). Options can be grouped and carry a secondary line.
'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text, e.g. email or "agreed ₹40,000 · pending ₹10,000". */
  description?: ReactNode;
  group?: string;
  /** Extra text matched by search but not shown. */
  keywords?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
  /** Rendered at the bottom of the list, e.g. "+ Add new client". */
  footer?: ReactNode;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  allowClear,
  disabled,
  invalid,
  loading,
  className,
  id,
  footer,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${typeof o.description === 'string' ? o.description : ''} ${o.keywords ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [options, query]);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (opt: ComboboxOption | undefined) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  let lastGroup: string | undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm ring-offset-background transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-destructive',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.label ?? placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {allowClear && selected && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                className="rounded p-0.5 hover:bg-accent hover:text-foreground"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(undefined);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector('input')?.focus();
          }}
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  pick(filtered[active]);
                }
              }}
            />
          </div>
          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {loading && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            )}
            {!loading &&
              filtered.map((opt, i) => {
                const header = opt.group && opt.group !== lastGroup ? opt.group : undefined;
                lastGroup = opt.group;
                return (
                  <div key={opt.value}>
                    {header && (
                      <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">{header}</p>
                    )}
                    <div
                      role="option"
                      data-index={i}
                      aria-selected={opt.value === value}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(opt)}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm',
                        i === active && 'bg-accent',
                        opt.disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <Check
                        className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', opt.value === value ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="min-w-0">
                        <p className="truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {footer && <div className="border-t p-1">{footer}</div>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
