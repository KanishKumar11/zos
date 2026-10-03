// "Stopped working on it" (OWNER) — someone leaves a project. They stay listed so their history and
// pay add up; their fee is settled one of three ways (see SettleChoice).
'use client';

import { useEffect, useState } from 'react';

import { PayoutMethod, type SettleAction } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { BalanceRow } from '@/features/payouts/payouts.hooks';

import { useReleaseMember, type ProjectRow } from '../projects.hooks';
import { SettleChoice, SettlePaymentFields, settleOptions } from './settle-choice';

export function ReleaseMemberDialog({
  project,
  row,
  open,
  onOpenChange,
}: {
  project: ProjectRow;
  row: BalanceRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const release = useReleaseMember();
  const { nothingOwed } = settleOptions(row.agreedPaise, row.paidPaise);
  const [action, setAction] = useState<SettleAction>('KEEP_OWED');
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [method, setMethod] = useState<PayoutMethod>(PayoutMethod.BANK);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setAction('KEEP_OWED');
      setPaidAt(todayLocal());
      setNote('');
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    setError(undefined);
    try {
      await release.mutateAsync({
        id: project._id,
        userId: row.payeeId,
        body: { action: nothingOwed ? 'KEEP_OWED' : action, paidAt, method, note: note.trim() || undefined },
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.payeeName} stopped working on {project.name}</DialogTitle>
          <DialogDescription>
            They&apos;ll show as &ldquo;left&rdquo; on the project. Their payments stay in the ledger. What should happen to their fee?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SettleChoice
            value={action}
            onChange={setAction}
            agreedPaise={row.agreedPaise}
            paidPaise={row.paidPaise}
            currency={project.currency ?? 'INR'}
            name={row.payeeName}
          />
          {action === 'PAY_REST' && !nothingOwed && (
            <SettlePaymentFields
              paidAt={paidAt}
              method={method}
              onChange={(v) => {
                if (v.paidAt !== undefined) setPaidAt(v.paidAt);
                if (v.method) setMethod(v.method);
              }}
            />
          )}
          <FormField label="Note (optional)" htmlFor="release-note">
            <Input id="release-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Moved to another project" maxLength={500} />
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={release.isPending}>
            {release.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
