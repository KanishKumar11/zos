// Monthly totals as bars (last 12 months), current month in the accent colour.
'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { formatPaise } from '@/lib/formatters';

import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { formatCompact, useCanSeePrices } from '@/components/viz';

import type { MonthBucket } from './money-time';

export function MonthlyBars({
  months,
  values,
  seriesName,
  label,
  height = 170,
}: {
  months: MonthBucket[];
  /** Paise per month, same order as `months`. */
  values: number[];
  /** Tooltip series name, e.g. "Spent". */
  seriesName: string;
  /** Accessible description prefix, e.g. "Monthly spend". */
  label: string;
  height?: number;
}) {
  const canSee = useCanSeePrices();
  const data = months.map((m, i) => ({ month: m.label, long: m.long, [seriesName]: values[i] ?? 0 }));
  const last = data.length - 1;
  // Amounts only go into the accessible label when the viewer may see them.
  const aria = canSee
    ? `${label}: ${months.map((m, i) => `${m.long} ${formatCompact(values[i] ?? 0)}`).join(', ')}`
    : label;

  return (
    <div role="img" aria-label={aria} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          {canSee && (
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  label={(payload?.[0]?.payload as { long?: string } | undefined)?.long}
                  payload={payload?.map((p) => ({ name: String(p.name ?? ''), value: Number(p.value ?? 0), color: 'hsl(var(--primary))' }))}
                  formatValue={(v) => formatPaise(v)}
                />
              )}
            />
          )}
          <Bar dataKey={seriesName} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill="hsl(var(--primary))" fillOpacity={i === last ? 1 : 0.32} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
