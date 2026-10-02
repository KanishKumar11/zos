// Write off an issued invoice (with a reason). Sent invoices can't be deleted — this keeps them
// in the books while removing the balance from what's outstanding.
'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api-client';
import { formatPaise } from '@/lib/formatters';

import { useWriteOffInvoice, type InvoiceRow } from './invoices.hooks';

export function WriteOffDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const writeOff = useWriteOffInvoice();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const balance = invoice.balancePaise ?? Math.max(0, invoice.totalPaise - invoice.paidPaise);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(undefined);
    }
  }, [open]);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (reason.trim().length < 3) {
      setError('Add a short reason, e.g. "Client closed down".');
      return;
    }
    writeOff.mutate(
      { id: invoice._id, reason: reason.trim() },
      { onSuccess: () => onOpenChange(false), onError: (err) => setError(getErrorMessage(err)) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !writeOff.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Write off {invoice.number}?</DialogTitle>
            <DialogDescription>
              {formatPaise(balance, invoice.currency)} will stop counting as outstanding.
              {invoice.paidPaise > 0 && ` The ${formatPaise(invoice.paidPaise, invoice.currency)} already received stays recorded.`}{' '}
              The invoice stays in your records and can be reopened later.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Reason" required error={error} className="my-4">
            <Textarea
              autoFocus
              rows={3}
              maxLength={500}
              placeholder="e.g. Client disputed the second milestone; agreed to settle for the amount paid."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={writeOff.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={writeOff.isPending}>
              {writeOff.isPending ? 'Writing off…' : 'Write off'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
