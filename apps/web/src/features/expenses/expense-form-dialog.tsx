// Create / edit an expense — amount in rupees, optional project link (billable), repeat schedule,
// receipt, and team contributions (a member covering part of the cost through their pay).
'use client';

import { Info, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatPaise } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAllProjects } from '@/features/projects/projects.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

import {
  EXPENSE_CATEGORIES,
  LEGACY_EXPENSE_CATEGORIES,
  RECURRING_LABEL,
  categoryLabel,
  storedYmd,
} from './expense-meta';
import {
  useCreateExpense,
  useUpdateExpense,
  type CreateExpenseInput,
  type ExpenseRecurring,
  type ExpenseRow,
} from './expenses.hooks';
import { ReceiptField } from './receipt-field';

interface ContributionState {
  key: number;
  userId: string;
  amountPaise: number | undefined;
  note: string;
}

interface Values {
  title: string;
  amountPaise: number | undefined;
  date: string;
  category: string;
  vendor: string;
  description: string;
  receiptRef: string | undefined;
  projectId: string | undefined;
  billable: boolean;
  recurring: ExpenseRecurring;
  contributions: ContributionState[];
}

let keySeq = 0;

const fromExpense = (e?: ExpenseRow, prefill?: Partial<Values>): Values => ({
  title: e?.title ?? '',
  amountPaise: e ? (e.amountPaise > 0 ? e.amountPaise : undefined) : undefined,
  date: e ? storedYmd(e.date) : todayLocal(),
  category: e?.category ?? 'OTHER',
  vendor: e?.vendor ?? '',
  description: e?.description ?? '',
  receiptRef: e?.receiptRef || undefined,
  projectId: e?.projectId,
  billable: !!e?.billable,
  recurring: e?.recurring ?? 'NONE',
  contributions: (e?.contributions ?? []).map((c) => ({
    key: ++keySeq,
    userId: c.userId,
    amountPaise: c.amountPaise,
    note: c.note ?? '',
  })),
  ...prefill,
});

const sameValues = (a: Values, b: Values) =>
  JSON.stringify({ ...a, contributions: a.contributions.map(({ key: _k, ...c }) => c) }) ===
  JSON.stringify({ ...b, contributions: b.contributions.map(({ key: _k, ...c }) => c) });

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Editing when given. */
  expense?: ExpenseRow;
  /** Pre-select a project for new expenses (e.g. when the list is filtered to one). */
  defaultProjectId?: string;
}) {
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const confirm = useConfirm();
  const staff = useStaffDirectory({ enabled: open });
  const projects = useAllProjects({ enabled: open });

  const [initial, setInitial] = useState<Values>(() => fromExpense(expense));
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const start = fromExpense(expense, !expense && defaultProjectId ? { projectId: defaultProjectId } : undefined);
    setInitial(start);
    setV(start);
    setErrors({});
    setServerError(undefined);
  }, [open, expense, defaultProjectId]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setContribution = (key: number, patch: Partial<ContributionState>) => {
    setV((p) => ({ ...p, contributions: p.contributions.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
    setErrors((e) => ({ ...e, contributions: undefined }));
  };

  const recovered = v.contributions.reduce((s, c) => s + (c.amountPaise ?? 0), 0);
  const gross = v.amountPaise ?? 0;
  const net = gross - recovered;
  const overRecovered = recovered > gross && v.contributions.length > 0;

  const isLegacy = (LEGACY_EXPENSE_CATEGORIES as readonly string[]).includes(v.category);
  const categoryOptions = useMemo(() => {
    const list: string[] = [...EXPENSE_CATEGORIES];
    // An older expense saved under a retired category keeps it until changed.
    if (expense && (LEGACY_EXPENSE_CATEGORIES as readonly string[]).includes(expense.category)) list.push(expense.category);
    return list;
  }, [expense]);

  const projectOptions: ComboboxOption[] = useMemo(() => {
    const opts: ComboboxOption[] = (projects.data?.items ?? []).map((p) => ({
      value: p._id,
      label: p.name,
      keywords: p.code,
      description: p.code,
    }));
    if (expense?.projectId && !opts.some((o) => o.value === expense.projectId)) {
      opts.unshift({ value: expense.projectId, label: expense.projectName ? `${expense.projectName} (deleted)` : 'Deleted project' });
    }
    return opts;
  }, [projects.data, expense]);

  const memberOptions: ComboboxOption[] = useMemo(() => {
    const opts: ComboboxOption[] = (staff.data ?? []).map((u) => ({ value: u._id, label: u.name, keywords: u.email }));
    for (const c of expense?.contributions ?? []) {
      if (!opts.some((o) => o.value === c.userId)) opts.push({ value: c.userId, label: c.userName ?? 'Former member' });
    }
    return opts;
  }, [staff.data, expense]);

  const close = async () => {
    if (!sameValues(v, initial)) {
      const ok = await confirm({
        title: 'Discard changes?',
        description: 'What you typed in this expense will be lost.',
        confirmText: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    onOpenChange(false);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!v.title.trim()) e.title = 'Enter what this was for';
    if (v.amountPaise === undefined) e.amountPaise = 'Enter the amount';
    else if (v.amountPaise <= 0) e.amountPaise = 'Must be more than zero';
    if (!v.date) e.date = 'Pick a date';
    if (!v.category) e.category = 'Pick a category';
    else if (isLegacy && (!expense || expense.category !== v.category)) e.category = 'Pick another category';
    const seen = new Set<string>();
    v.contributions.forEach((c, i) => {
      if (!c.userId) e[`contributions.${i}.userId`] = 'Pick a team member';
      else if (seen.has(c.userId)) e[`contributions.${i}.userId`] = 'Already added';
      seen.add(c.userId);
      if (!c.amountPaise || c.amountPaise <= 0) e[`contributions.${i}.amountPaise`] = 'Enter an amount';
    });
    if (overRecovered) e.contributions = `Contributions add up to ${formatPaise(recovered)}, more than the expense.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setServerError(undefined);
    if (!validate()) return;
    const body: CreateExpenseInput = {
      title: v.title.trim(),
      amountPaise: v.amountPaise!,
      date: v.date,
      category: v.category,
      vendor: v.vendor.trim(),
      description: v.description.trim(),
      receiptRef: v.receiptRef ?? '',
      recurring: v.recurring,
      billable: v.projectId ? v.billable : false,
      contributions: v.contributions.map((c) => ({ userId: c.userId, amountPaise: c.amountPaise!, note: c.note.trim() || undefined })),
    };
    if (expense) body.projectId = v.projectId ?? null;
    else if (v.projectId) body.projectId = v.projectId;
    if (!expense) {
      // Don't send empty optional strings on create.
      if (!body.vendor) delete body.vendor;
      if (!body.description) delete body.description;
      if (!body.receiptRef) delete body.receiptRef;
    }
    try {
      if (expense) await update.mutateAsync({ id: expense._id, body });
      else await create.mutateAsync(body);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      }
      setServerError(getErrorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : void close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>Business costs like tools, hosting, marketing and office spend.</DialogDescription>
        </DialogHeader>
        <form
          className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}

          <FormField label="What was it for" required error={errors.title}>
            <Input
              autoFocus
              value={v.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Hetzner VPS"
              aria-invalid={!!errors.title || undefined}
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" required error={errors.amountPaise}>
              <MoneyInput value={v.amountPaise} onChange={(p) => set('amountPaise', p)} invalid={!!errors.amountPaise} placeholder="0" />
            </FormField>
            <FormField label="Date" required error={errors.date}>
              <Input type="date" value={v.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date || undefined} />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Category"
              required
              error={errors.category}
              hint={
                <span className="inline-flex items-start gap-1">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    Team and freelancer payments are logged under{' '}
                    <Link href="/payments" className="underline hover:text-foreground">
                      Payments out
                    </Link>
                    .
                  </span>
                </span>
              }
            >
              <Select value={v.category} onChange={(e) => set('category', e.target.value)}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Vendor" error={errors.vendor}>
              <Input value={v.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. AWS" />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Project" error={errors.projectId} hint="Link a project to count this in its costs.">
              <Combobox
                options={projectOptions}
                value={v.projectId}
                allowClear
                loading={projects.isLoading}
                placeholder="Not for a project"
                searchPlaceholder="Search projects…"
                onChange={(id) => setV((p) => ({ ...p, projectId: id, billable: id ? p.billable : false }))}
              />
            </FormField>
            <FormField label="Repeats" hint={v.recurring !== 'NONE' ? 'Use "Repeat" on the row to add the next one.' : undefined}>
              <Select value={v.recurring} onChange={(e) => set('recurring', e.target.value as ExpenseRecurring)}>
                {(Object.keys(RECURRING_LABEL) as ExpenseRecurring[]).map((r) => (
                  <option key={r} value={r}>
                    {RECURRING_LABEL[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {v.projectId && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                checked={v.billable}
                onChange={(e) => set('billable', e.target.checked)}
              />
              <span>
                Billable to client
                <span className="block text-xs text-muted-foreground">You plan to pass this cost on in an invoice.</span>
              </span>
            </label>
          )}

          <FormField label="Notes">
            <Textarea rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" />
          </FormField>

          <FormField label="Receipt">
            <ReceiptField value={v.receiptRef} onChange={(k) => set('receiptRef', k)} prefix="expenses/receipts" />
          </FormField>

          {/* Team contributions */}
          <div className={cn('space-y-3 rounded-lg border p-3', overRecovered && 'border-destructive/60')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">Team contributions</p>
                <p className="text-xs text-muted-foreground">
                  A team member covering part of this cost through their pay, e.g. a shared subscription.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setV((p) => ({
                    ...p,
                    contributions: [...p.contributions, { key: ++keySeq, userId: '', amountPaise: undefined, note: '' }],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {v.contributions.length > 0 && (
              <div className="space-y-2">
                {v.contributions.map((c, i) => (
                  <div key={c.key} className="grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]">
                    <FormField error={errors[`contributions.${i}.userId`]}>
                      <Combobox
                        options={memberOptions}
                        value={c.userId || undefined}
                        loading={staff.isLoading}
                        placeholder="Team member"
                        searchPlaceholder="Search people…"
                        invalid={!!errors[`contributions.${i}.userId`]}
                        onChange={(id) => setContribution(c.key, { userId: id ?? '' })}
                      />
                    </FormField>
                    <FormField error={errors[`contributions.${i}.amountPaise`]}>
                      <MoneyInput
                        value={c.amountPaise}
                        onChange={(p) => setContribution(c.key, { amountPaise: p })}
                        invalid={!!errors[`contributions.${i}.amountPaise`]}
                        placeholder="0"
                      />
                    </FormField>
                    <Input value={c.note} onChange={(e) => setContribution(c.key, { note: e.target.value })} placeholder="Note (optional)" />
                    <button
                      type="button"
                      aria-label="Remove contribution"
                      className="self-start rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => setV((p) => ({ ...p, contributions: p.contributions.filter((x) => x.key !== c.key) }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Expense</span>
                <span className="tabular-nums">{formatPaise(gross)}</span>
              </div>
              {recovered > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Covered by team</span>
                  <span className="tabular-nums">−{formatPaise(recovered)}</span>
                </div>
              )}
              <div className={cn('flex justify-between font-medium', net < 0 && 'text-destructive')}>
                <span>Net cost to the agency</span>
                <span className="tabular-nums">{formatPaise(net)}</span>
              </div>
              {(errors.contributions || overRecovered) && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.contributions ??
                    `Contributions add up to ${formatPaise(recovered)}, more than the expense. Lower them or raise the amount.`}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
