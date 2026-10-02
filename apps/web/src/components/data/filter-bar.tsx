// Filter bar building blocks: debounced search, select filters, date-range presets, reset.
'use client';

import { Download, Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { RANGE_PRESETS, presetRange, type RangePreset } from '@/lib/date-range';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
        aria-label={placeholder}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            onChange('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  allLabel = 'All',
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label ?? allLabel}
      className={cn('w-auto min-w-[140px]', value && 'border-foreground/30 font-medium', className)}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Preset + custom date range. Stores the preset key plus resolved from/to. */
export function DateRangeFilter({
  preset,
  from,
  to,
  onChange,
  className,
}: {
  preset: string;
  from: string;
  to: string;
  onChange: (v: { range: string; from: string; to: string }) => void;
  className?: string;
}) {
  const current = (preset || 'all') as RangePreset;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select
        value={current}
        aria-label="Date range"
        className={cn('w-auto min-w-[160px]', current !== 'all' && 'border-foreground/30 font-medium')}
        onChange={(e) => {
          const p = e.target.value as RangePreset;
          if (p === 'custom') onChange({ range: 'custom', from, to });
          else onChange({ range: p === 'all' ? '' : p, ...presetRange(p) });
        }}
      >
        {RANGE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      {current === 'custom' && (
        <>
          <Input
            type="date"
            value={from}
            aria-label="From"
            className="w-[150px]"
            onChange={(e) => onChange({ range: 'custom', from: e.target.value, to })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={to}
            aria-label="To"
            className="w-[150px]"
            onChange={(e) => onChange({ range: 'custom', from, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

export function ResetFilters({ count, onReset }: { count: number; onReset: () => void }) {
  if (count === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
      <X className="mr-1 h-3.5 w-3.5" />
      Clear {count} filter{count === 1 ? '' : 's'}
    </Button>
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="mr-1.5 h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
