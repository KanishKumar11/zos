// MilestoneJourney — a horizontal path of steps with a "you are here" node. Amounts only render when
// passed (the caller decides; staff views pass none).
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface JourneyStep {
  key: string;
  title: string;
  /** done = reached, now = current, next = not reached */
  state: 'done' | 'now' | 'next';
  caption?: ReactNode;
}

export function MilestoneJourney({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  if (steps.length === 0) return null;
  return (
    <ol className={cn('grid auto-cols-[minmax(120px,1fr)] grid-flow-col overflow-x-auto pb-1', className)}>
      {steps.map((s, i) => (
        <li key={s.key} className="relative min-w-0 pr-3 pt-9">
          <span
            className={cn(
              'absolute left-0 right-0 top-3 h-1',
              i === steps.length - 1 && 'right-auto w-6',
              s.state === 'done' ? 'bg-brand' : s.state === 'now' ? 'bg-[linear-gradient(90deg,hsl(var(--primary))_50%,hsl(var(--muted))_50%)]' : 'bg-muted',
            )}
          />
          <span
            className={cn(
              'absolute left-0 top-1 h-5 w-5 rounded-full border-4',
              s.state === 'done' && 'border-brand bg-brand',
              s.state === 'now' && 'border-brand bg-card shadow-[0_0_0_6px_hsl(var(--primary)/0.2)]',
              s.state === 'next' && 'border-muted bg-card',
            )}
            aria-hidden
          />
          <p className={cn('truncate text-sm font-semibold', s.state === 'next' && 'text-muted-foreground')}>{s.title}</p>
          {s.caption && <div className="truncate text-xs text-muted-foreground">{s.caption}</div>}
          <span className="sr-only">{s.state === 'done' ? 'done' : s.state === 'now' ? 'current step' : 'upcoming'}</span>
        </li>
      ))}
    </ol>
  );
}

/** Map milestone statuses to journey states: first PENDING after the reached ones is "now". */
export function journeyFromMilestones<T extends { status: string }>(items: T[], reached = (m: T) => m.status !== 'PENDING') {
  let nowAssigned = false;
  return items.map((m) => {
    if (reached(m)) return { item: m, state: 'done' as const };
    if (!nowAssigned) {
      nowAssigned = true;
      return { item: m, state: 'now' as const };
    }
    return { item: m, state: 'next' as const };
  });
}
