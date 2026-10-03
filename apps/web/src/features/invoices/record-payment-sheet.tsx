// Record a client payment against an invoice. Prefills the balance due and today's date,
// blocks overpayments and future dates before the server has to.
'use client';

import { useEffect, useState } from 'react';

import { INVOICE_PAYMENT_METHODS, INVOICE_PAYMENT_METHOD_LABEL, type InvoicePaymentMethod } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';
import { formatPaise } from '@/lib/formatters';

import { Price, useCanSeePrices } from '@/components/viz';

import { useRecordPayment, type InvoiceRow } from './invoices.hooks';

type Errors = Partial<Record<'amountPaise' | 'paidAt' | 'method' | 'reference', string>>;

export function RecordPaymentSheet({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pay = useRecordPayment();
  const canSeePrices = useCanSeePrices();
  const balance = invoice.balancePaise ?? Math.max(0, invoice.totalPaise - invoice.paidPaise);
  const lastMethod = invoice.payments.at(-1)?.method;

  const [amount, setAmount] = useState<number | undefined>(balance);
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [method, setMethod] = useState<InvoicePaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setAmount(balance);
    setPaidAt(todayLocal());
    setMethod(
      (INVOICE_PAYMENT_METHODS as readonly string[]).includes(lastMethod ?? '')
        ? (lastMethod as InvoicePaymentMethod)
        : 'BANK_TRANSFER',
    );
    setReference('');
    setErrors({});
    setServerError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const after = Math.max(0, balance - (amount ?? 0));

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errors = {};
    if (!amount || amount <= 0) e.amountPaise = 'Enter the amount received';
    else if (amount > balance)
      e.amountPaise = `More than the balance due${canSeePrices ? ` (${formatPaise(balance, invoice.currency)})` : ''}`;
    if (!paidAt) e.paidAt = 'Pick the date it was received';
    else if (paidAt > todayLocal()) e.paidAt = "Can't be in the future";
    setErrors(e);
    setServerError(undefined);
    if (Object.keys(e).length) return;

    pay.mutate(
      {
        id: invoice._id,
        body: { amountPaise: amount!, paidAt: paidAt as unknown as Date, method, reference: reference.trim() || undefined },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          if (err instanceof ApiRequestError) {
            setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])) as Errors);
          }
          setServerError(getErrorMessage(err));
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !pay.isPending && onOpenChange(o)}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>Record payment</SheetTitle>
            <SheetDescription>
              {invoice.number} · {invoice.clientName ?? 'Deleted client'}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <Price paise={invoice.totalPaise} currency={invoice.currency} className="block font-medium" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid so far</p>
                <Price paise={invoice.paidPaise} currency={invoice.currency} className="block font-medium text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance due</p>
                <Price paise={balance} currency={invoice.currency} className="block font-semibold" />
              </div>
            </div>

            <FormField
              label="Amount received"
              required
              error={errors.amountPaise}
              hint={
                amount && amount < balance ? (
                  <>
                    <Price paise={after} currency={invoice.currency} /> will still be due.{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => setAmount(balance)}>
                      Full balance
                    </button>
                  </>
                ) : (
                  'Settles the invoice in full.'
                )
              }
            >
              <MoneyInput
                autoFocus
                currency={invoice.currency}
                value={amount}
                invalid={!!errors.amountPaise}
                onChange={(v) => {
                  setAmount(v);
                  setErrors((x) => ({ ...x, amountPaise: undefined }));
                }}
              />
            </FormField>

            <FormField label="Date received" required error={errors.paidAt}>
              <Input
                type="date"
                value={paidAt}
                max={todayLocal()}
                onChange={(e) => {
                  setPaidAt(e.target.value);
                  setErrors((x) => ({ ...x, paidAt: undefined }));
                }}
              />
            </FormField>

            <FormField label="Method" error={errors.method}>
              <Select value={method} onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}>
                {INVOICE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {INVOICE_PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Reference" hint="UTR, UPI ref, cheque number…" error={errors.reference}>
              <Input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
            </FormField>

            {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pay.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? 'Saving…' : 'Record payment'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
