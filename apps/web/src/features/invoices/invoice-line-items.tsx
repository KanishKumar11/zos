// Line-item editor shared by the invoice create + edit forms.
// Each row can be linked to a project (and optionally the milestone it bills),
// which is what lets a single invoice cover several projects at once.
'use client';

import { useState } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPaise, toPaise, toRupees } from '@/lib/formatters';

import type { ProjectRow } from '@/features/projects/projects.hooks';

/** Encodes a row's project/milestone link into a single <select> value. */
const linkValue = (projectId?: string, milestoneId?: string): string =>
  projectId ? (milestoneId ? `${projectId}:${milestoneId}` : projectId) : '';

/**
 * `register` coercions for optional fields. An empty <input> otherwise submits
 * `''` (or `NaN` under `valueAsNumber`), both of which the invoice schema rejects
 * — which reads as the form silently refusing to submit.
 */
export const emptyToUndefined = (v: unknown): string | undefined =>
  v === '' || v === null || v === undefined ? undefined : String(v);

export const emptyToUndefinedNumber = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

interface Props {
  /** The invoice create or edit form. Must have a `lineItems` field array. */
  form: UseFormReturn<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  projects: ProjectRow[];
  /** Edit form exposes qty; the create form bills whole amounts at qty 1. */
  showQty?: boolean;
}

export function InvoiceLineItems({ form, projects, showQty = false }: Props) {
  const fields = useFieldArray({ control: form.control, name: 'lineItems' as never });
  const items = (form.watch('lineItems') ?? []) as {
    qty?: number;
    unitPaise?: number;
    projectId?: string;
  }[];

  const subTotal = items.reduce(
    (sum, li) => sum + Math.round((li?.qty ?? 1) * (li?.unitPaise ?? 0)),
    0,
  );

  // Per-project breakdown — the reason a combined invoice is safe to send.
  const byProject = new Map<string, number>();
  items.forEach((li) => {
    const key = li?.projectId ?? '';
    byProject.set(key, (byProject.get(key) ?? 0) + Math.round((li?.qty ?? 1) * (li?.unitPaise ?? 0)));
  });

  const onLinkChange = (idx: number, raw: string) => {
    const [projectId, milestoneId] = raw.split(':');
    form.setValue(`lineItems.${idx}.projectId`, projectId || undefined);
    form.setValue(`lineItems.${idx}.milestoneId`, milestoneId || undefined);
    if (!milestoneId) return;

    // Pulling in a milestone should carry its name and amount across —
    // without clobbering anything already typed.
    const project = projects.find((p) => p._id === projectId);
    const ms = project?.milestones?.find((m) => m._id === milestoneId);
    if (!ms) return;
    if (!form.getValues(`lineItems.${idx}.description`))
      form.setValue(`lineItems.${idx}.description`, `${project!.name} — ${ms.name}`);
    if (!form.getValues(`lineItems.${idx}.unitPaise`))
      form.setValue(`lineItems.${idx}.unitPaise`, ms.amountPaise);
  };

  return (
    <div className="space-y-2">
      <Label>Line items</Label>

      <div className="hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:grid" style={{ gridTemplateColumns: showQty ? '1fr 190px 60px 120px 44px' : '1fr 190px 120px 44px' }}>
        <span>Description</span>
        <span>Project / milestone</span>
        {showQty && <span>Qty</span>}
        <span>Amount (₹)</span>
        <span />
      </div>

      {fields.fields.map((field, idx) => (
        <LineItemRow
          key={field.id}
          form={form}
          idx={idx}
          projects={projects}
          showQty={showQty}
          onLinkChange={onLinkChange}
          onRemove={fields.fields.length > 1 ? () => fields.remove(idx) : undefined}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() =>
            fields.append({ description: '', qty: 1, unitPaise: 0 } as never)
          }
          className="text-xs font-medium text-primary hover:underline"
        >
          + Add line item
        </button>
        <span className="text-sm tabular-nums">
          Subtotal <span className="font-semibold">{formatPaise(subTotal, 'INR')}</span>
        </span>
      </div>

      {byProject.size > 1 && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <p className="mb-1 font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Split across projects
          </p>
          {[...byProject.entries()].map(([projectId, paise]) => (
            <div key={projectId || 'unassigned'} className="flex justify-between py-0.5">
              <span className="text-muted-foreground">
                {projects.find((p) => p._id === projectId)?.name ?? 'Not linked to a project'}
              </span>
              <span className="tabular-nums font-medium">{formatPaise(paise, 'INR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LineItemRow({
  form,
  idx,
  projects,
  showQty,
  onLinkChange,
  onRemove,
}: {
  form: UseFormReturn<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  idx: number;
  projects: ProjectRow[];
  showQty: boolean;
  onLinkChange: (idx: number, raw: string) => void;
  onRemove?: () => void;
}) {
  const projectId = form.watch(`lineItems.${idx}.projectId`) as string | undefined;
  const milestoneId = form.watch(`lineItems.${idx}.milestoneId`) as string | undefined;
  const unitPaise = form.watch(`lineItems.${idx}.unitPaise`) as number | undefined;

  // Rupees are held as text so partial input ("25.", "") survives keystrokes;
  // the form itself always stores paise.
  const [rupees, setRupees] = useState(() => (unitPaise ? String(toRupees(unitPaise)) : ''));
  const displayed = toPaise(rupees) === (unitPaise ?? 0) ? rupees : String(toRupees(unitPaise ?? 0));

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: showQty ? '1fr 190px 60px 120px 44px' : '1fr 190px 120px 44px' }}
    >
      <Input
        placeholder="Description"
        className="h-9 text-sm"
        {...form.register(`lineItems.${idx}.description` as never)}
      />

      <select
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={linkValue(projectId, milestoneId)}
        onChange={(e) => onLinkChange(idx, e.target.value)}
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <optgroup key={p._id} label={p.name}>
            <option value={p._id}>{p.name} — general</option>
            {(p.milestones ?? [])
              // Show open milestones, plus whichever one this row already holds.
              .filter((m) => m.status !== 'COLLECTED' || m._id === milestoneId)
              .map((m) => (
                <option key={m._id} value={`${p._id}:${m._id}`}>
                  {m.name} · {formatPaise(m.amountPaise, 'INR')}
                  {m.status === 'INVOICED' && m._id !== milestoneId ? ' (invoiced)' : ''}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      {showQty && (
        <Input
          type="number"
          placeholder="Qty"
          className="h-9 text-sm"
          {...form.register(`lineItems.${idx}.qty` as never, { valueAsNumber: true })}
        />
      )}

      <Input
        type="number"
        step="0.01"
        min="0"
        placeholder="0"
        className="h-9 text-sm"
        value={displayed}
        onChange={(e) => {
          setRupees(e.target.value);
          form.setValue(`lineItems.${idx}.unitPaise`, toPaise(e.target.value), {
            shouldValidate: true,
          });
        }}
      />

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove line item"
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
