// Small trend visuals: Sparkline, TrendDelta, DivergingBars (who owes whom), WeekStrip, ActivityTimeline.
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { todayLocal, toLocalDateInput } from '@/lib/form';

export function Sparkline({
  values,
  color = 'hsl(var(--primary))',
  height = 44,
  className,
  fill = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  fill?: boolean;
}) {
  const w = 200;
  if (values.length < 2) return <div className={cn('h-11', className)} />;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" className={className} aria-hidden>
      {fill && <path d={`${line} L${w} ${height} L0 ${height} Z`} fill={color} opacity={0.15} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  );
}

export function TrendDelta({ current, previous, invert = false, suffix = 'vs last month' }: { current: number; previous: number; invert?: boolean; suffix?: string }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (!Number.isFinite(pct)) return null;
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className={cn('text-xs font-medium', good ? 'text-success' : 'text-destructive')}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '■'} {Math.abs(pct)}% <span className="font-normal opacity-70">{suffix}</span>
    </span>
  );
}

export interface DivergingRow {
  key: string;
  label: string;
  value: number;
  display: string;
  side: 'left' | 'right';
  href?: string;
}

/** Two-sided bars around a centre axis: left = they owe you, right = you owe them. */
export function DivergingBars({ rows, leftColor = 'hsl(var(--success))', rightColor = 'hsl(var(--primary))' }: { rows: DivergingRow[]; leftColor?: string; rightColor?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="grid gap-2">
      {rows.map((r) => {
        const width = `${Math.max(4, (r.value / max) * 100)}%`;
        const label = r.href ? (
          <Link href={r.href} className="font-semibold hover:underline">
            {r.label}
          </Link>
        ) : (
          <b>{r.label}</b>
        );
        return (
          <div key={`${r.side}-${r.key}`} className="grid grid-cols-[1fr_2px_1fr] items-center gap-2 text-[13px]">
            {r.side === 'left' ? (
              <div className="flex justify-end">
                <div className="h-2.5 rounded-full" style={{ width, background: leftColor }} />
              </div>
            ) : (
              <div className="truncate text-right">
                {label} <span className="font-figures text-muted-foreground">{r.display}</span>
              </div>
            )}
            <div className="h-full min-h-[24px] bg-border" />
            {r.side === 'right' ? (
              <div>
                <div className="h-2.5 rounded-full" style={{ width, background: rightColor }} />
              </div>
            ) : (
              <div className="truncate">
                {label} <span className="font-figures text-muted-foreground">{r.display}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface WeekDot {
  date: string; // yyyy-mm-dd
  color: string;
  title?: string;
}

/** This week (Mon–Sun) with coloured dots for things on each day. */
export function WeekStrip({ dots, onSelect, selected }: { dots: WeekDot[]; onSelect?: (date: string) => void; selected?: string }) {
  const today = todayLocal();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const key = toLocalDateInput(d);
        const mine = dots.filter((x) => x.date === key);
        const isToday = key === today;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            className={cn(
              'rounded-xl border px-1 py-2 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/25',
              isToday && 'border-brand bg-brand-wash',
              selected === key && 'ring-2 ring-brand',
            )}
            aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}: ${mine.length} item${mine.length === 1 ? '' : 's'}`}
          >
            {d.toLocaleDateString('en-IN', { weekday: 'short' })}
            <span className="font-display block text-xl font-bold text-foreground">{d.getDate()}</span>
            <span className="mt-1 flex min-h-[6px] justify-center gap-0.5">
              {mine.slice(0, 4).map((x, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: x.color }} title={x.title} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface TimelineItem {
  key: string;
  date: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  color?: string;
  icon?: ReactNode;
}

/** Vertical story feed with a rail and coloured nodes. */
export function ActivityTimeline({ items, empty }: { items: TimelineItem[]; empty?: ReactNode }) {
  if (items.length === 0) return <>{empty ?? null}</>;
  return (
    <ol className="relative space-y-5 pl-6 before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-0.5 before:rounded before:bg-border">
      {items.map((i) => (
        <li key={i.key} className="relative">
          <span
            className="absolute -left-6 top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-card text-white"
            style={{ background: i.color ?? 'hsl(var(--primary))' }}
            aria-hidden
          >
            {i.icon}
          </span>
          <div className="text-sm font-semibold">{i.title}</div>
          {i.meta && <div className="text-xs text-muted-foreground">{i.meta}</div>}
          {i.body && <div className="mt-1 text-[13px] leading-relaxed">{i.body}</div>}
        </li>
      ))}
    </ol>
  );
}
