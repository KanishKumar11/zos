// One payslip in a run: breakdown, attendance, and manual bonuses / deductions (draft runs only).
'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { formatPaise } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { PayslipBreakdown } from './member-payslips';
import { monthTitle, useAddPayslipAdjustment, useRemovePayslipAdjustment, type PayslipRow } from './payroll.hooks';

export function PayslipSheet({
  slip,
  editable,
  onOpenChange,
}: {
  slip: PayslipRow | undefined;
  editable: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const confirm = useConfirm();
  const add = useAddPayslipAdjustment();
  const remove = useRemovePayslipAdjustment();
  const [kind, setKind] = useState<'BONUS' | 'DEDUCTION'>('BONUS');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    setKind('BONUS');
    setReason('');
    setAmount(undefined);
    setErrors({});
    setServerError(undefined);
  }, [slip?._id]);

  if (!slip) return null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (reason.trim().length < 2) e.reason = 'Say what it is for, e.g. Diwali bonus';
    if (!amount || amount <= 0) e.amountPaise = 'Enter an amount';
    if (kind === 'DEDUCTION' && amount && amount > slip.netPaise) e.amountPaise = `More than their net pay (${formatPaise(slip.netPaise, slip.currency)})`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError(undefined);
    try {
      await add.mutateAsync({ payslipId: slip._id, body: { kind, reason: reason.trim(), amountPaise: amount! } });
      setReason('');
      setAmount(undefined);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const onRemove = async (idx: number) => {
    const a = slip.adjustments[idx];
    if (!a) return;
    const ok = await confirm({
      title: `Remove “${a.reason}”?`,
      description: `${a.kind === 'BONUS' ? 'The bonus' : 'The deduction'} of ${formatPaise(a.amountPaise, slip.currency)} is taken off this payslip.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) remove.mutate({ payslipId: slip._id, idx });
  };

  return (
    <Sheet open={!!slip} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{slip.userName ?? 'Payslip'}</SheetTitle>
          <SheetDescription>
            {monthTitle(slip.month)} · net {formatPaise(slip.netPaise, slip.currency)} ·{' '}
            <Link href={`/team/${slip.userId}`} className="text-primary hover:underline">
              Open profile
            </Link>
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <PayslipBreakdown slip={slip} />

          <div className="space-y-2">
            <p className="text-sm font-medium">Bonuses and deductions</p>
            {slip.adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">None on this payslip.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {slip.adjustments.map((a, idx) => (
                  <li key={idx} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1">
                      {a.reason}
                      <span className="block text-xs text-muted-foreground">{a.kind === 'BONUS' ? 'Bonus' : 'Deduction'}</span>
                    </span>
                    <span className={a.kind === 'BONUS' ? 'tabular-nums text-emerald-600' : 'tabular-nums text-destructive'}>
                      {a.kind === 'BONUS' ? '+' : '−'}
                      {formatPaise(a.amountPaise, slip.currency)}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Remove ${a.reason}`}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => void onRemove(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editable ? (
            <form
              className="space-y-3 rounded-md border border-dashed p-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
              <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
                <FormField label="Type">
                  <Select value={kind} onChange={(e) => setKind(e.target.value as 'BONUS' | 'DEDUCTION')}>
                    <option value="BONUS">Bonus</option>
                    <option value="DEDUCTION">Deduction</option>
                  </Select>
                </FormField>
                <FormField label="Amount" required error={errors.amountPaise}>
                  <MoneyInput value={amount} onChange={setAmount} currency={slip.currency} invalid={!!errors.amountPaise} />
                </FormField>
              </div>
              <FormField label="What for" required error={errors.reason}>
                <Input
                  value={reason}
                  maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={kind === 'BONUS' ? 'e.g. Diwali bonus' : 'e.g. Salary advance recovery'}
                />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={add.isPending}>
                  {add.isPending ? 'Adding…' : kind === 'BONUS' ? 'Add bonus' : 'Add deduction'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">This run is locked. Reopen it (owner only) to change payslips.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
