// Category treemap for the money overviews — one rounded tile per category, sized by amount, in the
// category's identity colour. Tiles and the list below toggle the category filter. The SVG is
// decorative for screen readers; the list underneath is the accessible version.
'use client';

import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';

import { cn } from '@/lib/cn';
import { formatPaise } from '@/lib/formatters';

import { Price, formatCompact, useCanSeePrices } from '@/components/viz';

export interface TreemapSlice {
  key: string;
  label: string;
  paise: number;
  color: string;
  count?: number;
}

interface CellDatum {
  name: string;
  size: number;
  /** Category id. Not called `key` — recharts spreads node data into elements. */
  catKey: string;
  color: string;
  dim: boolean;
  canSee: boolean;
}

export function CategoryTreemap({
  slices,
  selected,
  onSelect,
  height = 260,
  label,
}: {
  slices: TreemapSlice[];
  /** The category currently filtered on, if any. */
  selected?: string;
  onSelect?: (key: string) => void;
  height?: number;
  /** Short description for the chart, e.g. "Expenses by category". */
  label: string;
}) {
  const canSee = useCanSeePrices();
  const shown = slices.filter((s) => s.paise > 0).sort((a, b) => b.paise - a.paise);
  const total = shown.reduce((s, x) => s + x.paise, 0);
  const data: CellDatum[] = shown.map((s) => ({
    name: s.label,
    size: s.paise,
    catKey: s.key,
    color: s.color,
    dim: !!selected && selected !== s.key,
    canSee,
  }));

  return (
    <div>
      {data.length > 0 && (
        <div style={{ height }} aria-hidden className="select-none">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              nameKey="name"
              aspectRatio={4 / 3}
              isAnimationActive={false}
              content={<TreemapCell />}
              onClick={(node) => {
                const key = (node as unknown as { catKey?: string }).catKey;
                if (key) onSelect?.(key);
              }}
            >
              {canSee && <Tooltip content={<TreemapTip total={total} />} />}
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-3 grid gap-x-4 gap-y-0.5 sm:grid-cols-2" aria-label={label}>
        {shown.map((s) => {
          const share = total > 0 ? Math.round((s.paise / total) * 100) : 0;
          const active = selected === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect?.(s.key)}
                aria-pressed={active}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-accent/50',
                  active && 'bg-accent',
                  !!selected && !active && 'opacity-60',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="font-figures text-xs text-muted-foreground">{share}%</span>
                <Price paise={s.paise} compact className="w-16 text-right text-xs" />
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <p className="mt-2 text-xs text-muted-foreground">Tap the highlighted category again to show all categories.</p>
      )}
    </div>
  );
}

/** Custom tile renderer — recharts clones this with each node's layout + data fields. */
function TreemapCell(props: Partial<CellDatum> & { x?: number; y?: number; width?: number; height?: number; depth?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, depth, name = '', size = 0, color, dim, canSee } = props;
  if (depth !== 1 || width <= 4 || height <= 4) return <g />;
  const gap = 2;
  const w = width - gap * 2;
  const h = height - gap * 2;
  const maxChars = Math.floor((w - 16) / 7);
  const showLabel = maxChars >= 3 && h >= 26;
  const showAmount = !!canSee && w >= 56 && h >= 46;
  const text = name.length > maxChars ? `${name.slice(0, Math.max(1, maxChars - 1))}…` : name;
  return (
    <g className="cursor-pointer">
      <rect x={x + gap} y={y + gap} width={w} height={h} rx={10} ry={10} fill={color} opacity={dim ? 0.3 : 1} />
      {showLabel && (
        <text x={x + gap + 10} y={y + gap + 20} className="fill-white text-[12px] font-semibold" opacity={dim ? 0.7 : 1}>
          {text}
        </text>
      )}
      {showAmount && (
        <text x={x + gap + 10} y={y + gap + 37} className="font-figures fill-white text-[12px]" opacity={dim ? 0.6 : 0.88}>
          {formatCompact(size)}
        </text>
      )}
    </g>
  );
}

function TreemapTip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload?: Partial<CellDatum> }>; total: number }) {
  const d = payload?.[0]?.payload;
  if (!active || !d || !d.canSee || d.size === undefined) return null;
  const share = total > 0 ? Math.round((d.size / total) * 100) : 0;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-medium">{d.name}</p>
      <p className="font-figures">
        {formatPaise(d.size)} <span className="text-muted-foreground">· {share}%</span>
      </p>
    </div>
  );
}
