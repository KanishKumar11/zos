// Create / edit other income (affiliate payouts, referrals, interest, refunds…).
'use client';

import { useEffect, useState } from 'react';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptField } from '@/features/expenses/receipt-field';

import { INCOME_CATEGORIES, incomeCategoryLabel } from './income-meta';
import { useCreateIncome, useUpdateIncome, type CreateIncomeInput, type IncomeRow } from './income.hooks';

interface Values {
  title: string;
  amountPaise: number | undefined;
  date: string;
  category: string;
  source: string;
  description: string;
  receiptRef: string | undefined;
}

const fromIncome = (r?: IncomeRow): Values => ({
  title: r?.title ?? '',
  amountPaise: r ? (r.amountPaise > 0 ? r.amountPaise : undefined) : undefined,
  date: r ? r.date.slice(0, 10) : todayLocal(),
  category: r?.category ?? 'OTHER',
  source: r?.source ?? '',
  description: r?.description ?? '',
  receiptRef: r?.receiptRef || undefined,
});

export function IncomeFormDialog({
  open,
  onOpenChange,
  income,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  income?: IncomeRow;
}) {
  const create = useCreateIncome();
  const update = useUpdateIncome();
  const confirm = useConfirm();
  const [initial, setInitial] = useState<Values>(() => fromIncome(income));
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const start = fromIncome(income);
    setInitial(start);
    setV(start);
    setErrors({});
    setServerError(undefined);
  }, [open, income]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const close = async () => {
    if (JSON.stringify(v) !== JSON.stringify(initial)) {
      const ok = await confirm({
        title: 'Discard changes?',
        description: 'What you typed here will be lost.',
        confirmText: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    onOpenChange(false);
  };

  const submit = async () => {
    setServerError(undefined);
    const e: Record<string, string> = {};
    if (!v.title.trim()) e.title = 'Enter what this income was';
    if (v.amountPaise === undefined) e.amountPaise = 'Enter the amount';
    else if (v.amountPaise <= 0) e.amountPaise = 'Must be more than zero';
    if (!v.date) e.date = 'Pick a date';
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: CreateIncomeInput = {
      title: v.title.trim(),
      amountPaise: v.amountPaise!,
      date: v.date,
      category: v.category,
      source: v.source.trim(),
      description: v.description.trim(),
      receiptRef: v.receiptRef ?? '',
    };
    if (!income) {
      if (!body.source) delete body.source;
      if (!body.description) delete body.description;
      if (!body.receiptRef) delete body.receiptRef;
    }
    try {
      if (income) await update.mutateAsync({ id: income._id, body });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{income ? 'Edit income' : 'Add income'}</DialogTitle>
          <DialogDescription>Money in that isn&apos;t a client invoice — affiliate payouts, referrals, interest, refunds.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <FormField label="What was it" required error={errors.title}>
            <Input
              autoFocus
              value={v.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Hostinger affiliate payout"
              aria-invalid={!!errors.title || undefined}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" required error={errors.amountPaise}>
              <MoneyInput value={v.amountPaise} onChange={(p) => set('amountPaise', p)} invalid={!!errors.amountPaise} placeholder="0" />
            </FormField>
            <FormField label="Date received" required error={errors.date}>
              <Input type="date" value={v.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date || undefined} />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Category" error={errors.category}>
              <Select value={v.category} onChange={(e) => set('category', e.target.value)}>
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {incomeCategoryLabel(c)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Source" error={errors.source}>
              <Input value={v.source} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Hostinger" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" />
          </FormField>
          <FormField label="Receipt or statement">
            <ReceiptField value={v.receiptRef} onChange={(k) => set('receiptRef', k)} prefix="income/receipts" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : income ? 'Save changes' : 'Add income'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
