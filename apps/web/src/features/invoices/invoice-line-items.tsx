// Line-item editor shared by the invoice create + edit forms (controlled).
// Each row can be linked to a project (and optionally the milestone it bills),
// which is what lets a single invoice cover several projects at once.
'use client';

import { Trash2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { cn } from '@/lib/cn';
import { emptyToUndefined, emptyToUndefinedNumber } from '@/lib/form';
import { formatPaise } from '@/lib/formatters';

import { Price, useCanSeePrices } from '@/components/viz';
import type { ProjectRow } from '@/features/projects/projects.hooks';

// Kept as re-exports for existing imports; new code should import from '@/lib/form'.
export { emptyToUndefined, emptyToUndefinedNumber };

export interface LineDraft {
  /** Local React key only — never sent. */
  key: string;
  description: string;
  qty: number;
  unitPaise: number | undefined;
  projectId?: string;
  milestoneId?: string;
  contractId?: string;
}

let seq = 0;
export const newLine = (patch: Partial<LineDraft> = {}): LineDraft => ({
  key: `li-${Date.now()}-${seq++}`,
  description: '',
  qty: 1,
  unitPaise: undefined,
  ...patch,
});

export const lineTotal = (li: Pick<LineDraft, 'qty' | 'unitPaise'>): number =>
  Math.round((Number.isFinite(li.qty) ? li.qty : 0) * (li.unitPaise ?? 0));

/** Per-row problems, keyed by row index. */
export type LineErrors = Record<number, { description?: string; qty?: string; unitPaise?: string }>;

export function validateLines(lines: LineDraft[]): LineErrors {
  const errs: LineErrors = {};
  lines.forEach((li, i) => {
    const e: LineErrors[number] = {};
    if (!li.description.trim()) e.description = 'Describe the work';
    if (!(li.qty > 0)) e.qty = 'Qty must be more than 0';
    if (li.unitPaise === undefined) e.unitPaise = 'Enter an amount';
    if (Object.keys(e).length) errs[i] = e;
  });
  return errs;
}

/** Encodes a row's project/milestone link into a single <select> value. */
const linkValue = (projectId?: string, milestoneId?: string): string =>
  projectId ? (milestoneId ? `${projectId}:${milestoneId}` : projectId) : '';

interface Props {
  value: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  projects: ProjectRow[];
  currency?: string;
  /** Show a quantity column (otherwise each line bills a whole amount at qty 1). */
  showQty?: boolean;
  errors?: LineErrors;
  disabled?: boolean;
}

export function InvoiceLineItems({ value, onChange, projects, currency = 'INR', showQty = false, errors = {}, disabled }: Props) {
  const subTotal = value.reduce((sum, li) => sum + lineTotal(li), 0);
  // <option> text can only be a string, so the milestone amount is built only for viewers allowed to see it.
  const canSeePrices = useCanSeePrices();

  // Per-project breakdown — the reason a combined invoice is safe to send.
  const byProject = new Map<string, number>();
  value.forEach((li) => {
    const key = li.projectId ?? '';
    byProject.set(key, (byProject.get(key) ?? 0) + lineTotal(li));
  });

  const patch = (idx: number, p: Partial<LineDraft>) => onChange(value.map((li, i) => (i === idx ? { ...li, ...p } : li)));

  const onLinkChange = (idx: number, raw: string) => {
    const [projectId, milestoneId] = raw.split(':');
    const next: Partial<LineDraft> = { projectId: projectId || undefined, milestoneId: milestoneId || undefined };
    // Pulling in a milestone carries its name and amount across — without clobbering typed values.
    if (milestoneId) {
      const project = projects.find((p) => p._id === projectId);
      const ms = project?.milestones?.find((m) => m._id === milestoneId);
      const row = value[idx]!;
      if (ms && project) {
        if (!row.description.trim()) next.description = `${project.name} — ${ms.name}`;
        if (!row.unitPaise) next.unitPaise = ms.amountPaise ?? undefined;
      }
    }
    patch(idx, next);
  };

  const cols = showQty ? 'sm:grid-cols-[1fr_190px_70px_140px_36px]' : 'sm:grid-cols-[1fr_190px_140px_36px]';

  return (
    <div className="space-y-2">
      <Label className="text-[13px]">Line items</Label>

      <div className={cn('hidden gap-2 px-1 text-xs text-muted-foreground sm:grid', cols)}>
        <span>Description</span>
        <span>Project / milestone</span>
        {showQty && <span>Qty</span>}
        <span>{showQty ? 'Unit price' : 'Amount'}</span>
        <span />
      </div>

      {value.map((li, idx) => {
        const e = errors[idx] ?? {};
        return (
          <div key={li.key} className="space-y-1">
            <div className={cn('grid grid-cols-1 gap-2', cols)}>
              <Input
                aria-label="Description"
                placeholder="Description"
                className={cn('h-9 text-sm', e.description && 'border-destructive')}
                value={li.description}
                disabled={disabled}
                onChange={(ev) => patch(idx, { description: ev.target.value })}
              />
              <select
                aria-label="Project or milestone"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                value={linkValue(li.projectId, li.milestoneId)}
                disabled={disabled}
                onChange={(ev) => onLinkChange(idx, ev.target.value)}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <optgroup key={p._id} label={p.name}>
                    <option value={p._id}>{p.name} — general</option>
                    {(p.milestones ?? [])
                      // Open milestones, plus whichever one this row already holds.
                      .filter((m) => m.status !== 'COLLECTED' || m._id === li.milestoneId)
                      .map((m) => (
                        <option key={m._id} value={`${p._id}:${m._id}`}>
                          {m.name}
                          {canSeePrices ? ` · ${formatPaise(m.amountPaise ?? 0, currency)}` : ''}
                          {m.status === 'INVOICED' && m._id !== li.milestoneId ? ' (invoiced)' : ''}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {showQty && (
                <Input
                  aria-label="Quantity"
                  type="number"
                  min="0"
                  step="any"
                  className={cn('h-9 text-sm', e.qty && 'border-destructive')}
                  value={Number.isFinite(li.qty) ? li.qty : ''}
                  disabled={disabled}
                  onChange={(ev) => patch(idx, { qty: ev.target.value === '' ? NaN : Number(ev.target.value) })}
                />
              )}
              <MoneyInput
                aria-label="Amount"
                currency={currency}
                placeholder="0"
                value={li.unitPaise}
                invalid={!!e.unitPaise}
                disabled={disabled}
                onChange={(paise) => patch(idx, { unitPaise: paise })}
              />
              {value.length > 1 && !disabled ? (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== idx))}
                  aria-label="Remove line item"
                  className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
            {(e.description || e.qty || e.unitPaise) && (
              <p role="alert" className="text-xs text-destructive">
                {[e.description, e.qty, e.unitPaise].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {!disabled ? (
          <button
            type="button"
            onClick={() => onChange([...value, newLine()])}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Add line item
          </button>
        ) : (
          <span />
        )}
        <span className="text-sm tabular-nums">
          Subtotal <Price paise={subTotal} currency={currency} className="font-semibold" />
        </span>
      </div>

      {byProject.size > 1 && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <p className="mb-1 font-medium text-muted-foreground">Split across projects</p>
          {[...byProject.entries()].map(([projectId, paise]) => (
            <div key={projectId || 'unassigned'} className="flex justify-between py-0.5">
              <span className="text-muted-foreground">
                {projectId ? (projects.find((p) => p._id === projectId)?.name ?? 'Deleted project') : 'Not linked to a project'}
              </span>
              <Price paise={paise} currency={currency} className="font-medium" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
