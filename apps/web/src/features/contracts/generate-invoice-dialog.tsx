// Generate a retainer invoice for one month — pick the month and GST, see the total, then confirm.
'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getErrorMessage } from '@/lib/api-client';
import { thisMonthLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Price } from '@/components/viz';

import { billingProblem, defaultGst, monthLabel } from './contract-utils';
import { useGenerateContractInvoice, type ContractRow } from './contracts.hooks';

export function GenerateInvoiceDialog({
  contract,
  open,
  onOpenChange,
  onGenerated,
}: {
  contract: ContractRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGenerated?: (invoice: { _id: string; number: string }) => void;
}) {
  const generate = useGenerateContractInvoice();
  const [month, setMonth] = useState(thisMonthLocal());
  const [gst, setGst] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setMonth(thisMonthLocal());
    setGst(String(defaultGst(contract)));
    setError(undefined);
  }, [open, contract]);

  const gstNum = gst === '' ? 0 : Number(gst);
  const gstInvalid = !Number.isFinite(gstNum) || gstNum < 0 || gstNum > 50;
  const sub = contract.monthlyAmountPaise;
  const gstPaise = gstInvalid ? 0 : Math.round((sub * gstNum) / 100);
  const problem = month ? billingProblem(contract, month) : 'Pick a month';
  const alreadyBilled = !!month && (contract.billing?.billedMonths ?? []).includes(month);

  const submit = async () => {
    setError(undefined);
    try {
      const inv = await generate.mutateAsync({ id: contract._id, month, gstPercent: gstNum });
      onOpenChange(false);
      onGenerated?.(inv);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate invoice</DialogTitle>
          <DialogDescription>
            Creates a draft invoice for {contract.name}. You can review and send it from the invoice page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Month" required>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </FormField>
            <FormField label="GST %" error={gstInvalid ? 'Enter 0–50' : undefined}>
              <Input inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value.replace(/[^\d.]/g, ''))} />
            </FormField>
          </div>

          {(problem || alreadyBilled) && (
            <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {problem ?? `${monthLabel(month)} already has an invoice for this contract. Delete that invoice first if you need to regenerate it.`}
            </p>
          )}

          <dl className="space-y-1.5 rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Retainer{month ? ` · ${monthLabel(month)}` : ''}</dt>
              <dd><Price paise={sub} currency={contract.currency} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST {gstInvalid ? '' : `${gstNum}%`}</dt>
              <dd><Price paise={gstPaise} currency={contract.currency} /></dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <dt>Total</dt>
              <dd><Price paise={sub + gstPaise} currency={contract.currency} /></dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Due date follows the client&apos;s payment terms.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={generate.isPending || !!problem || alreadyBilled || gstInvalid}>
            {generate.isPending ? 'Creating…' : 'Create draft invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
