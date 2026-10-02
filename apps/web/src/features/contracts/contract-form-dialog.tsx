// Create / edit a retainer contract. Every optional field can be left empty; amounts are typed in ₹.
'use client';

import { useEffect, useMemo, useState } from 'react';

import { ContractStatus } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useClients } from '@/features/clients/clients.hooks';

import { CONTRACT_STATUS_OPTIONS, CURRENCIES } from './contract-utils';
import { useCreateContract, useUpdateContract, type ContractBody, type ContractRow } from './contracts.hooks';

interface Values {
  name: string;
  clientId: string;
  description: string;
  monthlyAmountPaise: number | undefined;
  currency: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  billingDay: string;
  gstPercent: string;
  notes: string;
}

const fromContract = (c?: ContractRow, clientId?: string): Values => ({
  name: c?.name ?? '',
  clientId: c?.clientId ?? clientId ?? '',
  description: c?.description ?? '',
  monthlyAmountPaise: c?.monthlyAmountPaise,
  currency: c?.currency ?? 'INR',
  status: c?.status ?? ContractStatus.ACTIVE,
  startDate: c?.startDate?.slice(0, 10) ?? '',
  endDate: c?.endDate?.slice(0, 10) ?? '',
  billingDay: c?.billingDay ? String(c.billingDay) : '',
  gstPercent: typeof c?.gstPercent === 'number' ? String(c.gstPercent) : '',
  notes: c?.notes ?? '',
});

export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
  defaultClientId,
  defaultName,
  defaultAmountPaise,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract?: ContractRow;
  defaultClientId?: string;
  defaultName?: string;
  defaultAmountPaise?: number;
  onSaved?: (c: ContractRow) => void;
}) {
  const create = useCreateContract();
  const update = useUpdateContract();
  const clients = useClients();
  const [v, setV] = useState<Values>(() => fromContract(contract, defaultClientId));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const base = fromContract(contract, defaultClientId);
    if (!contract) {
      if (defaultName) base.name = defaultName;
      if (defaultAmountPaise !== undefined) base.monthlyAmountPaise = defaultAmountPaise;
    }
    setV(base);
    setErrors({});
    setServerError(undefined);
  }, [open, contract, defaultClientId, defaultName, defaultAmountPaise]);

  const clientOptions = useMemo<ComboboxOption[]>(() => {
    const opts = (clients.data ?? []).map((c) => ({ value: c._id, label: c.name, keywords: c.gstin }));
    // Keep a deleted client visible on old contracts instead of showing an empty picker.
    if (v.clientId && !opts.some((o) => o.value === v.clientId) && !clients.isLoading) {
      opts.unshift({ value: v.clientId, label: 'Deleted client', keywords: '' });
    }
    return opts;
  }, [clients.data, clients.isLoading, v.clientId]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = 'Give the contract a name';
    if (!v.clientId) e.clientId = 'Pick a client';
    if (v.monthlyAmountPaise === undefined) e.monthlyAmountPaise = 'Enter the monthly amount';
    if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = 'End date must be on or after the start date';
    if (v.gstPercent !== '') {
      const g = Number(v.gstPercent);
      if (!Number.isFinite(g) || g < 0 || g > 50) e.gstPercent = 'Enter a rate between 0 and 50';
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: ContractBody = {
      name: v.name.trim(),
      clientId: v.clientId,
      description: v.description.trim(),
      monthlyAmountPaise: v.monthlyAmountPaise ?? 0,
      currency: v.currency,
      status: v.status,
      // null clears a field on edit; the server ignores nulls on create.
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      billingDay: v.billingDay ? Number(v.billingDay) : null,
      gstPercent: v.gstPercent !== '' ? Number(v.gstPercent) : null,
      notes: v.notes,
    };
    try {
      const saved = contract ? await update.mutateAsync({ id: contract._id, body }) : await create.mutateAsync(body);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{contract ? `Edit ${contract.name}` : 'New contract'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" required error={errors.name}>
              <Input autoFocus value={v.name} placeholder="e.g. Monthly development retainer" onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField label="Client" required error={errors.clientId}>
              <Combobox
                options={clientOptions}
                value={v.clientId || undefined}
                onChange={(id) => set('clientId', id ?? '')}
                placeholder="Pick a client"
                searchPlaceholder="Search clients"
                emptyText="No clients — add one on the Clients page"
                loading={clients.isLoading}
                invalid={!!errors.clientId}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_110px_1fr]">
            <FormField label="Monthly amount" required error={errors.monthlyAmountPaise} hint="Before GST">
              <MoneyInput
                value={v.monthlyAmountPaise}
                currency={v.currency}
                onChange={(p) => set('monthlyAmountPaise', p)}
                invalid={!!errors.monthlyAmountPaise}
              />
            </FormField>
            <FormField label="Currency" error={errors.currency}>
              <Select value={v.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="GST %" error={errors.gstPercent} hint={`Empty = ${v.currency === 'INR' ? '18%' : '0%'} when billing`}>
              <Input inputMode="decimal" value={v.gstPercent} placeholder={v.currency === 'INR' ? '18' : '0'} onChange={(e) => set('gstPercent', e.target.value.replace(/[^\d.]/g, ''))} />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Start date" error={errors.startDate}>
              <Input type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </FormField>
            <FormField label="End date" error={errors.endDate} hint="Leave empty if it rolls on">
              <Input type="date" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
            </FormField>
            <FormField label="Status" error={errors.status}>
              <Select value={v.status} onChange={(e) => set('status', e.target.value as ContractStatus)}>
                {CONTRACT_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Billing day" error={errors.billingDay} hint="The dashboard reminds you to invoice on this day each month.">
            <Select value={v.billingDay} onChange={(e) => set('billingDay', e.target.value)} className="sm:w-56">
              <option value="">No reminder</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Description" error={errors.description}>
            <Input value={v.description} placeholder="What the retainer covers" onChange={(e) => set('description', e.target.value)} />
          </FormField>
          <FormField label="Notes" error={errors.notes} hint="Internal — not shown on invoices.">
            <Textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : contract ? 'Save changes' : 'Create contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
