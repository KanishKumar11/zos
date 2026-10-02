// Create / edit a statement of work: client, project, value and payment milestones.
'use client';

import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { MilestoneStatus, SUPPORTED_CURRENCIES } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { formatPaise } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useClients } from '@/features/clients/clients.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

import { useCreateSow, useUpdateSow, type SowBody, type SowRow } from './sow.hooks';

interface MilestoneValues {
  title: string;
  amountPaise: number | undefined;
  dueDate: string;
  status?: MilestoneStatus;
}
interface Values {
  clientId: string;
  projectId: string;
  title: string;
  description: string;
  totalValuePaise: number | undefined;
  currency: string;
  milestones: MilestoneValues[];
}

const fromSow = (s?: SowRow): Values => ({
  clientId: s?.clientId ?? '',
  projectId: s?.projectId ?? '',
  title: s?.title ?? '',
  description: s?.description ?? '',
  totalValuePaise: s?.totalValuePaise,
  currency: s?.currency ?? 'INR',
  milestones: (s?.milestones ?? []).map((m) => ({
    title: m.title,
    amountPaise: m.amountPaise,
    dueDate: m.dueDate?.slice(0, 10) ?? '',
    status: m.status,
  })),
});

export function SowFormDialog({
  open,
  onOpenChange,
  sow,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sow?: SowRow;
  /** Prefill for a new SOW (e.g. from a won deal). */
  defaults?: { clientId?: string; projectId?: string; title?: string; totalValuePaise?: number; currency?: string };
  onSaved?: (s: SowRow) => void;
}) {
  const create = useCreateSow();
  const update = useUpdateSow();
  const clients = useClients();
  const projects = useAllProjects({ enabled: open });
  const [v, setV] = useState<Values>(() => fromSow(sow));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const base = fromSow(sow);
    if (!sow && defaults) {
      base.clientId = defaults.clientId ?? '';
      base.projectId = defaults.projectId ?? '';
      base.title = defaults.title ?? '';
      base.totalValuePaise = defaults.totalValuePaise;
      base.currency = defaults.currency ?? 'INR';
    }
    setV(base);
    setErrors({});
    setServerError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sow]);

  const clientOptions = useMemo<ComboboxOption[]>(() => {
    const opts = (clients.data ?? []).map((c) => ({ value: c._id, label: c.name }));
    if (v.clientId && !clients.isLoading && !opts.some((o) => o.value === v.clientId)) opts.unshift({ value: v.clientId, label: 'Deleted client' });
    return opts;
  }, [clients.data, clients.isLoading, v.clientId]);

  const projectOptions = useMemo<ComboboxOption[]>(
    () =>
      (projects.data?.items ?? [])
        .filter((p) => !v.clientId || p.clientId === v.clientId)
        .map((p) => ({ value: p._id, label: p.name, description: p.code })),
    [projects.data, v.clientId],
  );

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setMilestone = (i: number, patch: Partial<MilestoneValues>) => {
    setV((p) => ({ ...p, milestones: p.milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
    setErrors((e) => ({ ...e, [`milestones.${i}.title`]: undefined, [`milestones.${i}.amountPaise`]: undefined }));
  };

  const msTotal = v.milestones.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
  const mismatch = v.milestones.length > 0 && v.totalValuePaise !== undefined && msTotal !== v.totalValuePaise;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!v.clientId) e.clientId = 'Pick a client';
    if (v.title.trim().length < 2) e.title = 'Give the SOW a title';
    if (v.totalValuePaise === undefined) e.totalValuePaise = 'Enter the total value';
    v.milestones.forEach((m, i) => {
      if (!m.title.trim()) e[`milestones.${i}.title`] = 'Name this milestone';
      if (m.amountPaise === undefined) e[`milestones.${i}.amountPaise`] = 'Enter an amount';
    });
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: SowBody = {
      clientId: v.clientId,
      projectId: v.projectId || (sow ? null : undefined),
      title: v.title.trim(),
      description: v.description,
      totalValuePaise: v.totalValuePaise ?? 0,
      currency: v.currency,
      milestones: v.milestones.map((m) => ({
        title: m.title.trim(),
        amountPaise: m.amountPaise ?? 0,
        dueDate: m.dueDate || undefined,
        status: m.status,
      })),
    };
    try {
      const saved = sow ? await update.mutateAsync({ id: sow._id, body }) : await create.mutateAsync(body);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sow ? `Edit ${sow.title}` : 'New statement of work'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <FormField label="Title" required error={errors.title}>
            <Input autoFocus value={v.title} placeholder="e.g. Website redesign — phase 1" onChange={(e) => set('title', e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Client" required error={errors.clientId}>
              <Combobox
                options={clientOptions}
                value={v.clientId || undefined}
                onChange={(id) => {
                  set('clientId', id ?? '');
                  // A project of another client can't stay linked.
                  const p = projects.data?.items.find((x) => x._id === v.projectId);
                  if (p && p.clientId !== id) set('projectId', '');
                }}
                placeholder="Pick a client"
                searchPlaceholder="Search clients"
                loading={clients.isLoading}
                invalid={!!errors.clientId}
              />
            </FormField>
            <FormField label="Project" error={errors.projectId} hint={v.clientId ? 'Optional — or create one from the SOW later' : 'Pick a client first'}>
              <Combobox
                options={projectOptions}
                value={v.projectId || undefined}
                onChange={(id) => set('projectId', id ?? '')}
                placeholder="No project yet"
                searchPlaceholder="Search projects"
                emptyText="No projects for this client"
                loading={projects.isLoading}
                disabled={!v.clientId}
                allowClear
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <FormField label="Total value" required error={errors.totalValuePaise} hint="Before GST">
              <MoneyInput value={v.totalValuePaise} currency={v.currency} onChange={(p) => set('totalValuePaise', p)} invalid={!!errors.totalValuePaise} />
            </FormField>
            <FormField label="Currency">
              <Select value={v.currency} onChange={(e) => set('currency', e.target.value)}>
                {(SUPPORTED_CURRENCIES as readonly string[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium">Milestones</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setV((p) => ({ ...p, milestones: [...p.milestones, { title: '', amountPaise: undefined, dueDate: '' }] }))}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add milestone
              </Button>
            </div>
            {v.milestones.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No milestones. Add the payment stages agreed with the client, e.g. 40% upfront, 60% on launch.
              </p>
            ) : (
              <div className="space-y-2">
                {v.milestones.map((m, i) => (
                  <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_150px_150px_auto]">
                    <FormField error={errors[`milestones.${i}.title`]}>
                      <Input placeholder="Milestone name" value={m.title} onChange={(e) => setMilestone(i, { title: e.target.value })} />
                    </FormField>
                    <FormField error={errors[`milestones.${i}.amountPaise`]}>
                      <MoneyInput
                        value={m.amountPaise}
                        currency={v.currency}
                        onChange={(p) => setMilestone(i, { amountPaise: p })}
                        invalid={!!errors[`milestones.${i}.amountPaise`]}
                        placeholder="Amount"
                      />
                    </FormField>
                    <Input type="date" aria-label="Due date" value={m.dueDate} onChange={(e) => setMilestone(i, { dueDate: e.target.value })} />
                    <button
                      type="button"
                      aria-label="Remove milestone"
                      className="self-start rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => setV((p) => ({ ...p, milestones: p.milestones.filter((_, idx) => idx !== i) }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div
                  className={
                    mismatch
                      ? 'flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-600/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500'
                      : 'px-1 text-xs text-muted-foreground'
                  }
                >
                  <span className="flex items-center gap-1.5">
                    {mismatch && <AlertTriangle className="h-3.5 w-3.5" />}
                    Milestones add up to {formatPaise(msTotal, v.currency)}
                    {v.totalValuePaise !== undefined && ` of ${formatPaise(v.totalValuePaise, v.currency)}`}
                    {mismatch && v.totalValuePaise !== undefined &&
                      ` — ${formatPaise(Math.abs(v.totalValuePaise - msTotal), v.currency)} ${msTotal > v.totalValuePaise ? 'over' : 'short'}`}
                  </span>
                  {mismatch && (
                    <button type="button" className="font-medium underline" onClick={() => set('totalValuePaise', msTotal)}>
                      Use {formatPaise(msTotal, v.currency)} as the total
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <FormField label="Scope / description" error={errors.description}>
            <Textarea rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : sow ? 'Save changes' : 'Create SOW'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
