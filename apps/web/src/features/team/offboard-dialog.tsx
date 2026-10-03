// Offboard (OWNER/ADMIN) — someone leaves: internship completed, resigned, contract ended…
// Records the last working day and reason, marks them as exited (they can no longer sign in), and
// lets the OWNER log a final payment (e.g. an intern's stipend) in the same step.
'use client';

import { useEffect, useState } from 'react';

import { PAYOUT_CATEGORY_LABEL, PAYOUT_METHOD_LABEL, PayeeType, PayoutCategory, PayoutMethod, Role, UserStatus } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { todayLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { useCreatePayout } from '@/features/payouts/payouts.hooks';

import { EXIT_REASON_LABEL, type ExitReason, type UserRow } from './team.api';
import { useAdminUpdateUser } from './team.hooks';

export function OffboardDialog({
  user,
  viewerRole,
  open,
  onOpenChange,
}: {
  user: UserRow;
  viewerRole?: Role;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isIntern = user.role === Role.INTERN;
  const isOwner = viewerRole === Role.OWNER;
  const update = useAdminUpdateUser({ successMessage: `${user.name} is marked as left` });
  const pay = useCreatePayout();

  const [lastDay, setLastDay] = useState(todayLocal());
  const [reason, setReason] = useState<ExitReason>(isIntern ? 'INTERNSHIP_COMPLETED' : 'RESIGNED');
  const [withPayment, setWithPayment] = useState(false);
  const [amount, setAmount] = useState<number | undefined>();
  const [method, setMethod] = useState<PayoutMethod>(PayoutMethod.BANK);
  const [category, setCategory] = useState<PayoutCategory>(isIntern ? PayoutCategory.STIPEND : PayoutCategory.OTHER);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setLastDay(todayLocal());
    setReason(isIntern ? 'INTERNSHIP_COMPLETED' : 'RESIGNED');
    setWithPayment(false);
    setAmount(undefined);
    setError(undefined);
  }, [open, isIntern]);

  const busy = update.isPending || pay.isPending;

  const submit = async () => {
    setError(undefined);
    if (withPayment && !amount) return setError('Enter the amount you paid, or untick the payment.');
    if (user.dateOfJoining && lastDay < user.dateOfJoining.slice(0, 10)) return setError('The last day is before they joined.');
    try {
      // Payment first: if it fails, nothing has changed yet and they can simply retry.
      if (withPayment && amount) {
        await pay.mutateAsync({
          payeeType: PayeeType.MEMBER,
          userId: user._id,
          amountPaise: amount,
          currency: 'INR',
          paidAt: lastDay,
          method,
          category,
          note: EXIT_REASON_LABEL[reason],
        });
      }
      await update.mutateAsync({ id: user._id, body: { status: UserStatus.EXITED, dateOfExit: lastDay as never, exitReason: reason } });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isIntern ? `Complete ${user.name.split(' ')[0]}'s internship` : `${user.name.split(' ')[0]} is leaving`}</DialogTitle>
          <DialogDescription>
            They&apos;ll be marked as left and can no longer sign in. Their profile, projects and payments stay for your records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Last working day" htmlFor="exit-day">
              <Input id="exit-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </FormField>
            <FormField label="Reason" htmlFor="exit-reason">
              <Select id="exit-reason" value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}>
                {(Object.keys(EXIT_REASON_LABEL) as ExitReason[]).map((r) => (
                  <option key={r} value={r}>
                    {EXIT_REASON_LABEL[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {isOwner && (
            <div className="space-y-3 rounded-xl border p-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={withPayment} onChange={(e) => setWithPayment(e.target.checked)} />
                Log a final payment {isIntern ? '(stipend)' : ''}
              </label>
              {withPayment && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Amount" htmlFor="exit-amount" className="sm:col-span-3">
                    <MoneyInput id="exit-amount" value={amount} onChange={setAmount} />
                  </FormField>
                  <FormField label="How" htmlFor="exit-method" className="sm:col-span-2">
                    <Select id="exit-method" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)}>
                      {Object.values(PayoutMethod).map((m) => (
                        <option key={m} value={m}>
                          {PAYOUT_METHOD_LABEL[m]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Type" htmlFor="exit-category">
                    <Select id="exit-category" value={category} onChange={(e) => setCategory(e.target.value as PayoutCategory)}>
                      {[PayoutCategory.STIPEND, PayoutCategory.BONUS, PayoutCategory.OTHER].map((c) => (
                        <option key={c} value={c}>
                          {PAYOUT_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : isIntern ? 'Complete internship' : 'Mark as left'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
