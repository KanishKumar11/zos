// Create / edit a retainer contract. Every optional field can be left empty; amounts are typed in ₹.
'use client';

import { Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ContractStatus, Role } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Price } from '@/components/viz';
import { useClients } from '@/features/clients/clients.hooks';
import { useFreelancers } from '@/features/freelancers/freelancers.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

import { CONTRACT_STATUS_OPTIONS, CURRENCIES } from './contract-utils';
import { useCreateContract, useUpdateContract, type ContractBody, type ContractRow } from './contracts.hooks';

interface FormMember {
  userId: string;
  monthlyAmountPaise?: number;
  role?: string;
}

interface FormFreelancer {
  freelancerId: string;
  monthlyAmountPaise?: number;
  scope?: string;
}

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
  members: FormMember[];
  freelancers: FormFreelancer[];
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
  members: (c?.members ?? []).map((m) => ({
    userId: m.userId,
    monthlyAmountPaise: m.monthlyAmountPaise,
    role: m.role ?? '',
  })),
  freelancers: (c?.freelancers ?? []).map((f) => ({
    freelancerId: f.freelancerId,
    monthlyAmountPaise: f.monthlyAmountPaise,
    scope: f.scope ?? '',
  })),
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
  const staff = useStaffDirectory();
  const freelancers = useFreelancers();

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
    if (v.clientId && !opts.some((o) => o.value === v.clientId) && !clients.isLoading) {
      opts.unshift({ value: v.clientId, label: 'Deleted client', keywords: '' });
    }
    return opts;
  }, [clients.data, clients.isLoading, v.clientId]);

  const memberOptions = useMemo<ComboboxOption[]>(() => {
    return (staff.data ?? [])
      .filter((u) => u.role !== Role.CLIENT)
      .map((u) => ({
        value: u._id,
        label: u.name,
        description: u.role ? `${u.role.charAt(0)}${u.role.slice(1).toLowerCase()}` : undefined,
        keywords: u.email,
      }));
  }, [staff.data]);

  const freelancerOptions = useMemo<ComboboxOption[]>(() => {
    return (freelancers.data ?? []).map((f) => ({
      value: f._id,
      label: f.name,
      description: f.skill || 'Freelancer',
      keywords: f.email,
    }));
  }, [freelancers.data]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const totalContractorPayPaise =
    v.members.reduce((sum, m) => sum + (m.monthlyAmountPaise ?? 0), 0) +
    v.freelancers.reduce((sum, f) => sum + (f.monthlyAmountPaise ?? 0), 0);
  const netMarginPaise = (v.monthlyAmountPaise ?? 0) - totalContractorPayPaise;
  const marginPercent =
    v.monthlyAmountPaise && v.monthlyAmountPaise > 0
      ? Math.round((netMarginPaise / v.monthlyAmountPaise) * 100)
      : undefined;

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
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      billingDay: v.billingDay ? Number(v.billingDay) : null,
      gstPercent: v.gstPercent !== '' ? Number(v.gstPercent) : null,
      notes: v.notes,
      members: v.members
        .filter((m) => m.userId)
        .map((m) => ({
          userId: m.userId,
          monthlyAmountPaise: m.monthlyAmountPaise ?? 0,
          role: m.role?.trim() || undefined,
        })),
      freelancers: v.freelancers
        .filter((f) => f.freelancerId)
        .map((f) => ({
          freelancerId: f.freelancerId,
          monthlyAmountPaise: f.monthlyAmountPaise ?? 0,
          scope: f.scope?.trim() || undefined,
        })),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{contract ? `Edit ${contract.name}` : 'New contract'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[76vh] gap-4 overflow-y-auto pr-1"
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

          {/* Contractors & Monthly Payouts binding */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" /> Contractors & Monthly Pay
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bind team members or freelancers not on a fixed pay to this contract retainer.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    set('members', [...v.members, { userId: '', monthlyAmountPaise: undefined, role: '' }])
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Team member
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    set('freelancers', [
                      ...v.freelancers,
                      { freelancerId: '', monthlyAmountPaise: undefined, scope: '' },
                    ])
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Freelancer
                </Button>
              </div>
            </div>

            {v.members.length === 0 && v.freelancers.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No contractors linked yet. Click above to add team members or external freelancers.
              </p>
            )}

            {/* Team Members */}
            {v.members.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Team Members</p>
                {v.members.map((m, idx) => (
                  <div key={`m-${idx}`} className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2.5">
                    <div className="min-w-[170px] flex-1">
                      <Combobox
                        options={memberOptions}
                        value={m.userId || undefined}
                        onChange={(id) => {
                          const updated = [...v.members];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, userId: id ?? '' };
                          set('members', updated);
                        }}
                        placeholder="Pick team member"
                        searchPlaceholder="Search team…"
                        loading={staff.isLoading}
                      />
                    </div>
                    <div className="w-36">
                      <MoneyInput
                        value={m.monthlyAmountPaise}
                        onChange={(p) => {
                          const updated = [...v.members];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, monthlyAmountPaise: p };
                          set('members', updated);
                        }}
                        placeholder="₹ Monthly pay"
                        currency={v.currency}
                      />
                    </div>
                    <div className="min-w-[130px] flex-1">
                      <Input
                        value={m.role ?? ''}
                        onChange={(e) => {
                          const updated = [...v.members];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, role: e.target.value };
                          set('members', updated);
                        }}
                        placeholder="Role / responsibility"
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const updated = v.members.filter((_, i) => i !== idx);
                        set('members', updated);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Freelancers */}
            {v.freelancers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Freelancers</p>
                {v.freelancers.map((f, idx) => (
                  <div key={`f-${idx}`} className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2.5">
                    <div className="min-w-[170px] flex-1">
                      <Combobox
                        options={freelancerOptions}
                        value={f.freelancerId || undefined}
                        onChange={(id) => {
                          const updated = [...v.freelancers];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, freelancerId: id ?? '' };
                          set('freelancers', updated);
                        }}
                        placeholder="Pick freelancer"
                        searchPlaceholder="Search freelancers…"
                        loading={freelancers.isLoading}
                      />
                    </div>
                    <div className="w-36">
                      <MoneyInput
                        value={f.monthlyAmountPaise}
                        onChange={(p) => {
                          const updated = [...v.freelancers];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, monthlyAmountPaise: p };
                          set('freelancers', updated);
                        }}
                        placeholder="₹ Monthly pay"
                        currency={v.currency}
                      />
                    </div>
                    <div className="min-w-[130px] flex-1">
                      <Input
                        value={f.scope ?? ''}
                        onChange={(e) => {
                          const updated = [...v.freelancers];
                          const cur = updated[idx];
                          if (!cur) return;
                          updated[idx] = { ...cur, scope: e.target.value };
                          set('freelancers', updated);
                        }}
                        placeholder="Scope / deliverables"
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const updated = v.freelancers.filter((_, i) => i !== idx);
                        set('freelancers', updated);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Live Monthly Margin Summary */}
            {(v.members.length > 0 || v.freelancers.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground">Retainer: </span>
                    <Price paise={v.monthlyAmountPaise ?? 0} currency={v.currency} className="font-semibold" />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contractor Pay: </span>
                    <Price paise={totalContractorPayPaise} currency={v.currency} className="font-semibold text-warning" />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Monthly Margin: </span>
                  <Price
                    paise={netMarginPaise}
                    currency={v.currency}
                    className={cn('font-bold', netMarginPaise >= 0 ? 'text-success' : 'text-destructive')}
                  />
                  {marginPercent !== undefined && (
                    <span className={cn('ml-1 font-semibold', marginPercent >= 0 ? 'text-success' : 'text-destructive')}>
                      ({marginPercent}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

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

