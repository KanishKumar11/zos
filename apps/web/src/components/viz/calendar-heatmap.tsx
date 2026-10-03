// CalendarHeatmap — weeks × weekdays grid. Each day can carry two series (e.g. money in / money out)
// drawn as a split cell, or one series as a full cell. Intensity is scaled to the busiest day.
'use client';

import { useMemo } from 'react';

import { toLocalDateInput } from '@/lib/form';

export interface HeatDay {
  date: string; // yyyy-mm-dd
  a?: number;
  b?: number;
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function CalendarHeatmap({
  days,
  weeks = 26,
  colorA = 'hsl(var(--success))',
  colorB = 'hsl(var(--primary))',
  labelA = 'In',
  labelB = 'Out',
  format = (v: number) => String(v),
  split = true,
}: {
  days: HeatDay[];
  weeks?: number;
  colorA?: string;
  colorB?: string;
  labelA?: string;
  labelB?: string;
  format?: (v: number) => string;
  /** Two series per day (split cell); false = only series `a`. */
  split?: boolean;
}) {
  const { grid, maxA, maxB, monthMarks } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    const today = new Date();
    // Start on the Monday `weeks` weeks ago.
    const start = new Date(today);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow - (weeks - 1) * 7);
    const cells: { date: string; a: number; b: number; future: boolean; w: number; d: number }[] = [];
    const marks: { w: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + d);
        const key = toLocalDateInput(dt);
        const v = byDate.get(key);
        if (d === 0 && dt.getMonth() !== lastMonth) {
          marks.push({ w, label: MONTHS[dt.getMonth()]! });
          lastMonth = dt.getMonth();
        }
        cells.push({ date: key, a: v?.a ?? 0, b: v?.b ?? 0, future: dt > today, w, d });
      }
    }
    return {
      grid: cells,
      maxA: Math.max(1, ...cells.map((c) => c.a)),
      maxB: Math.max(1, ...cells.map((c) => c.b)),
      monthMarks: marks,
    };
  }, [days, weeks]);

  const cell = 13;
  const gap = 3;
  const colW = split ? cell * 2 + 1 + gap : cell + gap;
  const x0 = 30;
  const y0 = 16;
  const width = x0 + weeks * colW;
  const height = y0 + 7 * (cell + gap);

  const shade = (v: number, max: number) => (v <= 0 ? 0 : 0.28 + 0.72 * Math.min(1, v / max));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="min-w-[560px]" role="img" aria-label={`Daily ${labelA.toLowerCase()}${split ? ` and ${labelB.toLowerCase()}` : ''} over the last ${weeks} weeks`}>
        {DAY_LABELS.map((l, i) =>
          l ? (
            <text key={l} x={0} y={y0 + i * (cell + gap) + 10} fontSize={10} fill="hsl(var(--muted-foreground))">
              {l}
            </text>
          ) : null,
        )}
        {monthMarks.map((m) => (
          <text key={`${m.w}-${m.label}`} x={x0 + m.w * colW} y={10} fontSize={10} fill="hsl(var(--muted-foreground))">
            {m.label}
          </text>
        ))}
        {grid.map((c) => {
          const x = x0 + c.w * colW;
          const y = y0 + c.d * (cell + gap);
          const title = `${c.date}: ${labelA} ${format(c.a)}${split ? ` · ${labelB} ${format(c.b)}` : ''}`;
          if (c.future) return <rect key={c.date} x={x} y={y} width={split ? cell * 2 + 1 : cell} height={cell} rx={3} fill="hsl(var(--muted))" opacity={0.35} />;
          return (
            <g key={c.date}>
              <title>{title}</title>
              <rect x={x} y={y} width={cell} height={cell} rx={3} fill={c.a ? colorA : 'hsl(var(--muted))'} opacity={c.a ? shade(c.a, maxA) : 0.8} />
              {split && <rect x={x + cell + 1} y={y} width={cell} height={cell} rx={3} fill={c.b ? colorB : 'hsl(var(--muted))'} opacity={c.b ? shade(c.b, maxB) : 0.8} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
