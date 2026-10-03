// MoneyFlow — a Sankey of money in → agency → money out, drawn to one scale. Owner-only content:
// callers must only render it for the owner (the data comes from an owner-only endpoint).
'use client';

import type { ReactElement } from 'react';

import { identityColor } from '@/lib/identity';

import { formatCompact } from './price';

export interface FlowNode {
  key: string;
  label: string;
  paise: number;
  color?: string;
}

export function MoneyFlow({
  inflows,
  outflows,
  height = 260,
  currency = 'INR',
}: {
  inflows: FlowNode[];
  outflows: FlowNode[];
  height?: number;
  currency?: string;
}) {
  const ins = inflows.filter((n) => n.paise > 0);
  const outs = outflows.filter((n) => n.paise > 0);
  const totalIn = ins.reduce((s, n) => s + n.paise, 0);
  const totalOut = outs.reduce((s, n) => s + n.paise, 0);
  const total = Math.max(totalIn, totalOut, 1);
  const W = 640;
  const top = 14;
  const gapIn = ins.length > 1 ? 8 : 0;
  const gapOut = outs.length > 1 ? 6 : 0;
  const usable = height - top - 30 - Math.max(gapIn * (ins.length - 1), gapOut * (outs.length - 1));
  const scale = usable / total;
  const x0 = 150;
  const x1 = 300;
  const x2 = 316;
  const x3 = 470;
  const bar = 12;

  if (ins.length === 0 && outs.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No money moved in this period yet.</p>;
  }

  let yIn = top;
  let yA = top;
  let yOut = top;
  let yB = top;
  const pieces: ReactElement[] = [];

  ins.forEach((n) => {
    const h = Math.max(2, n.paise * scale);
    const color = n.color ?? identityColor(n.key);
    const mid = yIn + h / 2;
    const midA = yA + h / 2;
    pieces.push(
      <g key={`in-${n.key}`}>
        <title>{`${n.label}: ${formatCompact(n.paise, currency)}`}</title>
        <path d={`M${x0} ${mid} C ${x0 + 80} ${mid}, ${x1 - 80} ${midA}, ${x1} ${midA}`} stroke={color} strokeWidth={h} fill="none" opacity={0.3} />
        <rect x={x0 - bar} y={yIn} width={bar} height={h} rx={3} fill={color} />
        <text x={x0 - bar - 8} y={mid - 2} textAnchor="end" fontSize={12} fontWeight={600} fill="hsl(var(--foreground))">
          {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
        </text>
        <text x={x0 - bar - 8} y={mid + 13} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
          {formatCompact(n.paise, currency)}
        </text>
      </g>,
    );
    yIn += h + gapIn;
    yA += h;
  });

  outs.forEach((n) => {
    const h = Math.max(2, n.paise * scale);
    const color = n.color ?? identityColor(n.key);
    const mid = yOut + h / 2;
    const midB = yB + h / 2;
    pieces.push(
      <g key={`out-${n.key}`}>
        <title>{`${n.label}: ${formatCompact(n.paise, currency)}`}</title>
        <path d={`M${x2} ${midB} C ${x2 + 80} ${midB}, ${x3 - 80} ${mid}, ${x3} ${mid}`} stroke={color} strokeWidth={h} fill="none" opacity={0.3} />
        <rect x={x3} y={yOut} width={bar} height={h} rx={3} fill={color} />
        <text x={x3 + bar + 8} y={mid - 2} fontSize={12} fontWeight={600} fill="hsl(var(--foreground))">
          {n.label}
        </text>
        <text x={x3 + bar + 8} y={mid + 13} fontSize={11} fill="hsl(var(--muted-foreground))">
          {formatCompact(n.paise, currency)}
        </text>
      </g>,
    );
    yOut += h + gapOut;
    yB += h;
  });

  const agencyH = Math.max(totalIn, totalOut) * scale;
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        className="min-w-[520px]"
        role="img"
        aria-label={`Money in ${formatCompact(totalIn, currency)} from ${ins.length} sources; money out ${formatCompact(totalOut, currency)}`}
      >
        <rect x={x1} y={top} width={x2 - x1} height={agencyH} rx={4} fill="hsl(var(--foreground))" />
        <text x={(x1 + x2) / 2} y={top + agencyH + 16} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
          Agency
        </text>
        {pieces}
      </svg>
    </div>
  );
}
