// Gauges — HealthRing (concentric progress rings), FillJar (agreed vs paid), BurnBar (budget vs time),
// SegmentBar (proportions like aging or paid/due/unbilled). All drawn to one scale, theme-aware.
'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface RingValue {
  /** 0..1 (values above 1 are drawn full and flagged). */
  value: number;
  color: string;
  label: string;
}

export function HealthRing({
  rings,
  size = 74,
  center,
  className,
}: {
  rings: RingValue[];
  size?: number;
  center?: ReactNode;
  className?: string;
}) {
  const c = size / 2;
  const stroke = size * 0.08;
  const gap = size * 0.035;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={rings.map((r) => `${r.label} ${Math.round(r.value * 100)}%`).join(', ')}>
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          if (radius <= 0) return null;
          const len = 2 * Math.PI * radius;
          const pct = Math.max(0, Math.min(1, r.value));
          return (
            <g key={r.label}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
              <circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(len * pct).toFixed(2)} ${len.toFixed(2)}`}
                transform={`rotate(-90 ${c} ${c})`}
                style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.7,.2,1)' }}
              />
            </g>
          );
        })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function FillJar({
  value,
  max,
  size = 'md',
  className,
  label,
}: {
  value: number;
  max: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0;
  const over = max > 0 && value > max;
  const done = max > 0 && value >= max && !over;
  const dims = size === 'lg' ? 'h-20 w-14 border-[3px] rounded-t-[10px] rounded-b-[16px]' : size === 'sm' ? 'h-8 w-6 border-2 rounded-t-[5px] rounded-b-[8px]' : 'h-11 w-8 border-2 rounded-t-[6px] rounded-b-[10px]';
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden border-border bg-card', dims, className)}
      role="img"
      aria-label={label ?? `${Math.round(pct * 100)}% paid`}
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{
          height: `${pct * 100}%`,
          background: over ? 'hsl(var(--warning))' : done ? 'hsl(var(--success))' : 'hsl(var(--primary))',
          opacity: 0.9,
        }}
      />
    </div>
  );
}

export function BurnBar({
  spent,
  elapsed,
  className,
}: {
  /** Share of budget used, 0..1+. */
  spent: number;
  /** Share of time elapsed, 0..1. */
  elapsed: number;
  className?: string;
}) {
  const verdict = burnVerdict(spent, elapsed);
  return (
    <div className={className}>
      <div className="relative my-2 h-3 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(1, spent) * 100}%`, background: verdict.color }}
        />
        <span
          className="absolute -bottom-1.5 -top-1.5 w-0.5 rounded bg-foreground"
          style={{ left: `${Math.min(1, Math.max(0, elapsed)) * 100}%` }}
          title="Today"
        />
      </div>
    </div>
  );
}

export function burnVerdict(spent: number, elapsed: number): { label: string; tone: 'good' | 'warn' | 'bad'; color: string } {
  if (spent > 1) return { label: 'Over budget', tone: 'bad', color: 'hsl(var(--destructive))' };
  if (spent - elapsed > 0.15) return { label: 'Spending ahead of schedule', tone: 'warn', color: 'hsl(var(--warning))' };
  return { label: 'On track', tone: 'good', color: 'hsl(var(--primary))' };
}

export function SegmentBar({
  segments,
  height = 'h-9',
  showLabels = true,
  className,
}: {
  segments: { value: number; color: string; label: string; display?: string; onClick?: () => void }[];
  height?: string;
  showLabels?: boolean;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return <div className={cn('rounded-lg bg-muted', height, className)} />;
  return (
    <div className={cn('flex gap-[3px] overflow-hidden rounded-lg', height, className)} role="img" aria-label={segments.map((s) => `${s.label}: ${s.display ?? s.value}`).join(', ')}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onClick}
            disabled={!s.onClick}
            title={`${s.label}: ${s.display ?? s.value}`}
            className="grid min-w-[28px] place-items-center font-figures text-[11px] font-semibold text-white transition-opacity enabled:hover:opacity-85 disabled:cursor-default"
            style={{ flex: s.value, background: s.color }}
          >
            {showLabels ? s.display : null}
          </button>
        ))}
    </div>
  );
}

export function Legend({ items, className }: { items: { color: string; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      {items.map((i, idx) => (
        <span key={idx} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
