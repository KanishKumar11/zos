// Aging bar — what clients owe, split by how late it is, as one clickable SegmentBar + legend.
// Built from open invoices (see `agingBuckets`). Amounts go through <Price>; the segment labels and
// the bar's aria-label are plain strings, so they are only built for viewers allowed to see prices.
'use client';

import { Legend, Price, SegmentBar, formatCompact, useCanSeePrices } from '@/components/viz';
import { cn } from '@/lib/cn';

import { agingBuckets, type AgingInput, type AgingKey } from './invoice-aging';

export function InvoiceAgingBar({
  rows,
  active,
  onSelect,
  className,
}: {
  rows: readonly AgingInput[] | undefined;
  /** The bucket currently filtered on, if any — the other segments are dimmed. */
  active?: AgingKey | null;
  onSelect?: (key: AgingKey) => void;
  className?: string;
}) {
  const canSeePrices = useCanSeePrices();
  const buckets = agingBuckets(rows);

  return (
    <div className={className}>
      <SegmentBar
        height="h-10"
        segments={buckets.map((b) => ({
          value: b.paise,
          color: active && active !== b.key ? `color-mix(in srgb, ${b.color} 35%, transparent)` : b.color,
          label: `${b.label} (${b.count} invoice${b.count === 1 ? '' : 's'})`,
          display: canSeePrices ? formatCompact(b.paise) : '',
          onClick: onSelect ? () => onSelect(b.key) : undefined,
        }))}
      />
      <Legend
        className="mt-2.5"
        items={buckets.map((b) => ({
          color: b.color,
          label: (
            <button
              type="button"
              onClick={onSelect ? () => onSelect(b.key) : undefined}
              disabled={!onSelect}
              className={cn(
                'inline-flex items-center gap-1 rounded hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground',
                active === b.key && 'font-semibold text-foreground',
              )}
              aria-pressed={onSelect ? active === b.key : undefined}
            >
              {b.shortLabel}
              {b.count > 0 && (
                <span className="text-muted-foreground">
                  · <Price paise={b.paise} compact />
                </span>
              )}
            </button>
          ),
        }))}
      />
    </div>
  );
}
