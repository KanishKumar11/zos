import { cn } from '@/lib/cn';

/** Paid-vs-agreed style bar. Turns amber when value exceeds max. */
export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', over ? 'bg-warning' : pct >= 100 ? 'bg-success' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
