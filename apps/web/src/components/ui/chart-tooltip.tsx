// Shared recharts tooltip — value leads (bold), series name follows (muted),
// each row keyed with a short line rather than a filled swatch box.
'use client';

interface ChartTooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
  unit?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (v) => String(v),
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
      {label && (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const num = typeof item.value === 'number' ? item.value : Number(item.value ?? 0);
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-[2px] w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-semibold tabular-nums text-foreground">{formatValue(num)}</span>
              <span className="text-muted-foreground">{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
