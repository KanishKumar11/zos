// Small Studio building blocks shared by the client portal pages and the owner's "Preview as client".
// Everything here is written for a non-technical client: plain words, no internal jargon.
'use client';

import { Download, FileText, Mail } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';

import { Avatar, formatCompact, journeyFromMilestones, Legend, Price, SegmentBar, useCanSeePrices, type JourneyStep } from '@/components/viz';
import { formatBytes } from '@/features/collab/collab.hooks';

import { portalApi, type PortalFile } from './portal.hooks';

/** "12 Oct" — short, friendly dates for journeys and feeds. */
export const shortDate = (d: string | Date) => formatDate(d, { day: 'numeric', month: 'short' });

/** Plain-language project status for clients. */
export function plainProjectStatus(status: string): string {
  switch (status) {
    case 'PLANNING':
      return 'Getting started';
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return 'In progress';
    case 'REVIEW':
      return 'In review';
    case 'ON_HOLD':
      return 'Paused for now';
    case 'COMPLETED':
      return 'Finished';
    default:
      return 'In progress';
  }
}

export const isFinished = (status: string) => status === 'COMPLETED';

type Step = { name: string; dueDate?: string; status: string };

/** Progress through the milestones: reached = invoiced or paid. */
export function progressOf(milestones: Step[]) {
  const total = milestones.length;
  const done = milestones.filter((m) => m.status !== 'PENDING').length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Journey steps with friendly captions, plus the step that's next. */
export function journeyOf(milestones: Step[], keyPrefix = 'm') {
  const mapped = journeyFromMilestones(milestones);
  const steps: JourneyStep[] = mapped.map(({ item, state }, i) => ({
    key: `${keyPrefix}-${i}`,
    title: item.name,
    state,
    caption:
      state === 'done'
        ? item.status === 'COLLECTED'
          ? 'Done · paid'
          : 'Done'
        : state === 'now'
          ? item.dueDate
            ? `Up next · ${shortDate(item.dueDate)}`
            : 'Up next'
          : item.dueDate
            ? shortDate(item.dueDate)
            : 'Later',
  }));
  const next = mapped.find((m) => m.state === 'now')?.item ?? null;
  return { steps, next };
}

/** Paid / due / overdue as one bar with a legend. Amounts go through <Price>. */
export function BalanceMeter({
  paidPaise,
  duePaise,
  overduePaise,
  currency = 'INR',
  onInk = false,
  paidLabel = 'Paid',
}: {
  paidPaise: number;
  /** Due and not yet late. */
  duePaise: number;
  overduePaise: number;
  currency?: string;
  onInk?: boolean;
  paidLabel?: string;
}) {
  const canSee = useCanSeePrices();
  const show = (v: number) => (canSee ? formatCompact(v, currency) : '');
  const segments = [
    { value: paidPaise, color: 'hsl(var(--success))', label: paidLabel, display: show(paidPaise) },
    { value: duePaise, color: 'hsl(var(--primary))', label: 'Due', display: show(duePaise) },
    { value: overduePaise, color: 'hsl(var(--destructive))', label: 'Past due date', display: show(overduePaise) },
  ];
  return (
    <div className="space-y-2.5">
      <SegmentBar segments={segments} height="h-4" showLabels={false} className={onInk ? 'bg-background/15' : undefined} />
      <Legend
        className={onInk ? 'text-background/75' : undefined}
        items={[
          { color: 'hsl(var(--success))', label: <>{paidLabel} <Price paise={paidPaise} currency={currency} compact /></> },
          { color: 'hsl(var(--primary))', label: <>Due <Price paise={duePaise} currency={currency} compact /></> },
          ...(overduePaise > 0
            ? [{ color: 'hsl(var(--destructive))', label: <>Past due date <Price paise={overduePaise} currency={currency} compact /></> }]
            : []),
        ]}
      />
    </div>
  );
}

/** A rubber-stamp "Paid" mark for settled invoices. */
export function PaidStamp({ className, label = 'Paid' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none inline-block -rotate-[8deg] select-none rounded-md border-[2.5px] border-success px-2.5 py-0.5 font-display text-lg font-bold leading-tight text-success opacity-90',
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  );
}

/** Opens a shared file. In the owner's preview it only explains what would happen. */
export function useOpenPortalFile(preview = false) {
  return useCallback(
    async (projectId: string, fileId: string) => {
      if (preview) {
        toast.info('In the client portal this downloads the file.');
        return;
      }
      try {
        const { url } = await portalApi.fileUrl(projectId, fileId);
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    },
    [preview],
  );
}

const extOf = (name: string) => {
  const i = name.lastIndexOf('.');
  return i > 0 && name.length - i <= 6 ? name.slice(i + 1).toUpperCase() : 'FILE';
};

/** Shared files as small cards with a thumbnail tab. */
export function FileCards({
  files,
  onOpen,
  compact = false,
}: {
  files: PortalFile[];
  onOpen: (fileId: string) => void;
  compact?: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <ul className={cn('grid gap-2.5', compact ? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]')}>
      {files.map((f) => (
        <li key={f._id} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(f._id)}
            className="group flex w-full min-w-0 items-center gap-2.5 rounded-xl border bg-card p-2 text-left transition-colors hover:border-foreground/25"
            title={`Download ${f.name}`}
          >
            <span className={cn('relative grid shrink-0 place-items-center rounded-lg bg-brand-wash text-brand-ink', compact ? 'h-9 w-8' : 'h-11 w-10')}>
              <FileText className="h-4 w-4" />
              <span className="absolute -bottom-1 rounded bg-card px-1 font-figures text-[8px] font-semibold text-muted-foreground ring-1 ring-border">{extOf(f.name)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{f.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {[formatBytes(f.sizeBytes), shortDate(f.createdAt)].filter(Boolean).join(' · ')}
              </span>
            </span>
            {!compact && <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Your contact" — the people leading the client's projects. */
export function ContactList({ people }: { people: { name: string; email?: string; title?: string; note?: string }[] }) {
  return (
    <ul className="space-y-3">
      {people.map((p) => (
        <li key={`${p.name}-${p.email ?? ''}`} className="flex items-center gap-3">
          <Avatar name={p.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{[p.title, p.note].filter(Boolean).join(' · ') || 'Your contact at Zlaark'}</p>
          </div>
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium hover:bg-accent"
              aria-label={`Email ${p.name}`}
            >
              <Mail className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Email</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
