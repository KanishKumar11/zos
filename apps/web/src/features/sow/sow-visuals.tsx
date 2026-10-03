// SOW visuals — milestone progress bar (by amount, coloured by status) and the milestone journey.
'use client';

import { MilestoneStatus } from '@agency/shared';

import { formatDate } from '@/lib/formatters';

import { journeyFromMilestones, MilestoneJourney, Price, SegmentBar, formatCompact, useCanSeePrices } from '@/components/viz';

import type { SowMilestoneRow } from './sow.hooks';

export const MILESTONE_COLOR: Record<MilestoneStatus, string> = {
  [MilestoneStatus.PENDING]: 'hsl(var(--muted-foreground) / 0.3)',
  [MilestoneStatus.INVOICED]: 'hsl(var(--primary))',
  [MilestoneStatus.COLLECTED]: 'hsl(var(--success))',
};

export const MILESTONE_LABEL: Record<MilestoneStatus, string> = {
  [MilestoneStatus.PENDING]: 'Not billed',
  [MilestoneStatus.INVOICED]: 'Invoiced',
  [MilestoneStatus.COLLECTED]: 'Collected',
};

/** How far a SOW's milestones have got: collected / invoiced / not billed, by value. */
export function milestoneProgress(milestones: SowMilestoneRow[]) {
  const by = (s: MilestoneStatus) => milestones.filter((m) => m.status === s);
  const sum = (xs: SowMilestoneRow[]) => xs.reduce((t, m) => t + m.amountPaise, 0);
  return {
    collected: sum(by(MilestoneStatus.COLLECTED)),
    invoiced: sum(by(MilestoneStatus.INVOICED)),
    pending: sum(by(MilestoneStatus.PENDING)),
    reached: milestones.filter((m) => m.status !== MilestoneStatus.PENDING).length,
  };
}

/**
 * Thin bar with one segment per milestone, sized by amount and coloured by status. Tooltips carry
 * amounts only for viewers who may see prices; otherwise just the milestone name and state.
 */
export function SowMilestoneBar({ milestones, currency, height = 'h-2', className }: { milestones: SowMilestoneRow[]; currency: string; height?: string; className?: string }) {
  const canSee = useCanSeePrices();
  if (milestones.length === 0) return null;
  // Equal widths when every amount is zero, so the bar still shows the stages.
  const allZero = milestones.every((m) => m.amountPaise <= 0);
  return (
    <SegmentBar
      height={height}
      showLabels={false}
      className={className}
      segments={milestones.map((m, i) => ({
        value: allZero ? 1 : Math.max(0, m.amountPaise),
        color: MILESTONE_COLOR[m.status],
        // SegmentBar keys by label, so keep them unique.
        label: `${i + 1}. ${m.title}`,
        display: canSee ? `${MILESTONE_LABEL[m.status]} · ${formatCompact(m.amountPaise, currency)}` : MILESTONE_LABEL[m.status],
      }))}
    />
  );
}

/** Journey of the SOW's milestones: reached ones done, the first not-yet-billed one is "now". */
export function SowJourney({ milestones, currency }: { milestones: SowMilestoneRow[]; currency: string }) {
  const steps = journeyFromMilestones(milestones).map(({ item, state }, i) => ({
    key: `${i}-${item.title}`,
    title: item.title,
    state,
    caption: (
      <>
        <Price paise={item.amountPaise} currency={currency} compact />
        {' · '}
        {item.status === MilestoneStatus.PENDING ? (item.dueDate ? formatDate(item.dueDate) : 'No date') : MILESTONE_LABEL[item.status].toLowerCase()}
      </>
    ),
  }));
  return <MilestoneJourney steps={steps} />;
}
