// MoneyInput — people type rupees, the form stores paise. Every amount field in the app uses this,
// so nobody ever has to think in paise. Shows ₹ prefix and Indian digit grouping when not focused.
'use client';

import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED' };

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  /** Amount in paise (minor units). undefined = empty. */
  value: number | undefined | null;
  onChange: (paise: number | undefined) => void;
  currency?: string;
  invalid?: boolean;
}

const toDisplay = (paise: number | undefined | null): string =>
  paise === undefined || paise === null || Number.isNaN(paise) ? '' : String(paise / 100);

const group = (raw: string): string => {
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, currency = 'INR', invalid, className, onBlur, onFocus, ...props }, ref) => {
    const [text, setText] = useState(() => toDisplay(value));
    const [focused, setFocused] = useState(false);

    // Follow external changes (form reset, "pay pending" chips) unless the user is mid-edit.
    useEffect(() => {
      if (!focused) setText(toDisplay(value));
    }, [value, focused]);

    return (
      <div
        className={cn(
          'flex h-9 w-full items-center rounded-md border border-input bg-background text-sm ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:border-foreground/30',
          invalid && 'border-destructive',
          props.disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <span className="select-none pl-3 pr-1 text-muted-foreground">{SYMBOL[currency] ?? currency}</span>
        <input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          className="h-full w-full min-w-0 bg-transparent pr-3 tabular-nums outline-none placeholder:text-muted-foreground"
          value={focused ? text : group(text)}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[,\s₹]/g, '');
            if (raw !== '' && !/^\d*\.?\d{0,2}$/.test(raw)) return;
            setText(raw);
            onChange(raw === '' || raw === '.' ? undefined : Math.round(Number(raw) * 100));
          }}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
